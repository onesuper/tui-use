/**
 * termlink/src/session.ts
 *
 * Wraps a node-pty IPty instance.
 * Uses @xterm/headless as a VT renderer — all PTY output is written into
 * the terminal emulator, and `snapshot()` reads back the rendered screen.
 * This makes ANSI escape sequences, colors, and cursor movement transparent.
 */
import * as pty from "node-pty";
import { Terminal } from "@xterm/headless";
import { SessionInfo } from "./protocol";
import { extractHighlights, Highlight } from "./highlights";

// Special key name → escape sequence mapping
export const KEY_MAP: Record<string, string> = {
  "ctrl+a": "\x01", "ctrl+b": "\x02", "ctrl+c": "\x03", "ctrl+d": "\x04",
  "ctrl+e": "\x05", "ctrl+f": "\x06", "ctrl+k": "\x0b", "ctrl+l": "\x0c",
  "ctrl+u": "\x15", "ctrl+w": "\x17", "ctrl+z": "\x1a",
  "arrow_up": "\x1b[A", "arrow_down": "\x1b[B",
  "arrow_right": "\x1b[C", "arrow_left": "\x1b[D",
  "page_up": "\x1b[5~", "page_down": "\x1b[6~",
  "home": "\x1b[H", "end": "\x1b[F",
  "enter": "\r", "tab": "\t", "escape": "\x1b",
  "backspace": "\x7f", "delete": "\x1b[3~",
  "f1": "\x1bOP", "f2": "\x1bOQ", "f3": "\x1bOR", "f4": "\x1bOS",
  "f5": "\x1b[15~", "f6": "\x1b[17~", "f7": "\x1b[18~", "f8": "\x1b[19~",
  "f9": "\x1b[20~", "f10": "\x1b[21~",
};

export class Session {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly startTime: number;

  private ptyProcess: pty.IPty;
  private terminal: Terminal;
  private _status: "running" | "exited" = "running";
  private _exitCode: number | null = null;
  private lastSnapshot: string = "";

  // Listeners notified on any PTY data or exit
  private changeListeners: Array<() => void> = [];

  constructor(
    id: string,
    command: string,
    options: { cwd?: string; label?: string; cols?: number; rows?: number }
  ) {
    this.id = id;
    this.command = command;
    this.label = options.label ?? command.slice(0, 40);
    this.startTime = Date.now();

    const cols = options.cols ?? 120;
    const rows = options.rows ?? 30;

    this.terminal = new Terminal({ cols, rows, allowProposedApi: true });

    const shell = process.env.SHELL ?? "/bin/sh";
    this.ptyProcess = pty.spawn(shell, ["-c", command], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: options.cwd ?? process.cwd(),
      env: process.env as { [key: string]: string },
    });

    this.ptyProcess.onData((data: string) => {
      this.terminal.write(data);
      this.notifyListeners();
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      this._status = "exited";
      this._exitCode = exitCode ?? null;
      this.notifyListeners();
    });
  }

  get status(): "running" | "exited" {
    return this._status;
  }

  get exitCode(): number | null {
    return this._exitCode;
  }

  get cols(): number {
    return this.terminal.cols;
  }

  get rows(): number {
    return this.terminal.rows;
  }

  /** Send input to the PTY. Supports special key names and \n \r \t escapes. */
  send(input: string): void {
    if (this._status === "exited") {
      throw new Error(`Session ${this.id} has already exited`);
    }
    const mapped = KEY_MAP[input.toLowerCase()];
    if (mapped !== undefined) {
      this.ptyProcess.write(mapped);
      return;
    }
    const interpreted = input
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t");
    this.ptyProcess.write(interpreted);
  }

  /**
   * Return the current rendered screen as raw lines + cursor.
   * Trailing empty lines and per-line trailing spaces are removed.
   * Updates lastSnapshot for change detection.
   */
  snapshot(): { lines: string[]; cursor: { x: number; y: number }; changed: boolean; highlights: Highlight[] } {
    const buf = this.terminal.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < this.terminal.rows; i++) {
      lines.push((buf.getLine(i)?.translateToString(true) ?? "").trimEnd());
    }
    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }
    // Remove leading empty lines (TUI apps like fzf render from bottom)
    while (lines.length > 0 && lines[0] === "") {
      lines.shift();
    }
    const screen = lines.join("\n");
    const changed = screen !== this.lastSnapshot;
    this.lastSnapshot = screen;
    const highlights = extractHighlights(buf, this.terminal.rows);
    return {
      lines,
      cursor: { x: buf.cursorX, y: buf.cursorY },
      changed,
      highlights,
    };
  }

  /**
   * Wait until the screen changes (or until pattern matches), then return snapshot.
   * If process exits, returns immediately.
   */
  async wait(
    timeoutMs: number = 3000,
    until?: string
  ): Promise<{ lines: string[]; cursor: { x: number; y: number }; changed: boolean; highlights: ReturnType<typeof extractHighlights> }> {
    const beforeScreen = this.lastSnapshot;

    if (this._status === "exited") {
      return this.snapshot();
    }

    await new Promise<void>((resolve) => {
      let resolved = false;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      const done = () => {
        if (!resolved) {
          resolved = true;
          if (idleTimer) clearTimeout(idleTimer);
          clearTimeout(deadlineTimer);
          resolve();
        }
      };

      const deadlineTimer = setTimeout(done, timeoutMs);

      const check = () => {
        if (resolved) return;
        if (this._status === "exited") { done(); return; }

        // Get current rendered screen (don't update lastSnapshot yet)
        const buf = this.terminal.buffer.active;
        const lines: string[] = [];
        for (let i = 0; i < this.terminal.rows; i++) {
          lines.push((buf.getLine(i)?.translateToString(true) ?? "").trimEnd());
        }
        while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
        while (lines.length > 0 && lines[0] === "") lines.shift();
        const currentScreen = lines.join("\n");

        if (until) {
          // Pattern mode: resolve when pattern appears in screen
          if (new RegExp(until).test(currentScreen)) { done(); return; }
        } else {
          // Change mode: resolve when screen differs from before AND has been idle
          if (currentScreen !== beforeScreen) {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(done, 100);
          }
        }
      };

      this.changeListeners.push(check);
      check(); // check immediately in case already changed
    });

    this.changeListeners = this.changeListeners.filter((l) => typeof l === "function");
    return this.snapshot();
  }

  kill(): void {
    if (this._status === "running") {
      this.ptyProcess.kill();
    }
  }

  toInfo(): SessionInfo {
    return {
      session_id: this.id,
      label: this.label,
      command: this.command,
      status: this._status,
      exit_code: this._exitCode,
      start_time: this.startTime,
    };
  }

  private notifyListeners(): void {
    const listeners = [...this.changeListeners];
    this.changeListeners = [];
    for (const l of listeners) l();
  }
}
