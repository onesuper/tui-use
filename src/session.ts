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

// ---- ANSI re-encoding helpers ----

interface CellStyle {
  fg: number; fgMode: "default" | "palette" | "rgb";
  bg: number; bgMode: "default" | "palette" | "rgb";
  bold: boolean; dim: boolean; italic: boolean;
  underline: boolean; blink: boolean; inverse: boolean; strikethrough: boolean;
}

function getCellStyle(cell: { getFgColor(): number; getBgColor(): number; isFgDefault(): boolean; isFgPalette(): boolean; isFgRGB(): boolean; isBgDefault(): boolean; isBgPalette(): boolean; isBgRGB(): boolean; isBold(): number; isDim(): number; isItalic(): number; isUnderline(): number; isBlink(): number; isInverse(): number; isStrikethrough(): number }): CellStyle {
  return {
    fg: cell.getFgColor(),
    fgMode: cell.isFgDefault() ? "default" : cell.isFgPalette() ? "palette" : "rgb",
    bg: cell.getBgColor(),
    bgMode: cell.isBgDefault() ? "default" : cell.isBgPalette() ? "palette" : "rgb",
    bold: cell.isBold() !== 0,
    dim: cell.isDim() !== 0,
    italic: cell.isItalic() !== 0,
    underline: cell.isUnderline() !== 0,
    blink: cell.isBlink() !== 0,
    inverse: cell.isInverse() !== 0,
    strikethrough: cell.isStrikethrough() !== 0,
  };
}

function stylesEqual(a: CellStyle, b: CellStyle): boolean {
  return a.fg === b.fg && a.fgMode === b.fgMode &&
    a.bg === b.bg && a.bgMode === b.bgMode &&
    a.bold === b.bold && a.dim === b.dim && a.italic === b.italic &&
    a.underline === b.underline && a.blink === b.blink &&
    a.inverse === b.inverse && a.strikethrough === b.strikethrough;
}

function isDefaultStyle(s: CellStyle): boolean {
  return s.fgMode === "default" && s.bgMode === "default" &&
    !s.bold && !s.dim && !s.italic && !s.underline && !s.blink && !s.inverse && !s.strikethrough;
}

function styleToAnsi(s: CellStyle): string {
  const codes: string[] = [];
  if (s.bold) codes.push("1");
  if (s.dim) codes.push("2");
  if (s.italic) codes.push("3");
  if (s.underline) codes.push("4");
  if (s.blink) codes.push("5");
  if (s.inverse) codes.push("7");
  if (s.strikethrough) codes.push("9");
  if (s.fgMode === "palette") {
    if (s.fg < 8) codes.push(String(30 + s.fg));
    else if (s.fg < 16) codes.push(String(90 + s.fg - 8));
    else codes.push(`38;5;${s.fg}`);
  } else if (s.fgMode === "rgb") {
    codes.push(`38;2;${(s.fg >> 16) & 0xff};${(s.fg >> 8) & 0xff};${s.fg & 0xff}`);
  }
  if (s.bgMode === "palette") {
    if (s.bg < 8) codes.push(String(40 + s.bg));
    else if (s.bg < 16) codes.push(String(100 + s.bg - 8));
    else codes.push(`48;5;${s.bg}`);
  } else if (s.bgMode === "rgb") {
    codes.push(`48;2;${(s.bg >> 16) & 0xff};${(s.bg >> 8) & 0xff};${s.bg & 0xff}`);
  }
  if (codes.length === 0) return "";
  return `\x1b[${codes.join(";")}m`;
}

/** Minimal interface for an xterm buffer line (avoids importing concrete types). */
interface ColorBufferLine {
  getCell(x: number): { getChars(): string; getWidth(): number; getFgColor(): number; getBgColor(): number; isFgDefault(): boolean; isFgPalette(): boolean; isFgRGB(): boolean; isBgDefault(): boolean; isBgPalette(): boolean; isBgRGB(): boolean; isBold(): number; isDim(): number; isItalic(): number; isUnderline(): number; isBlink(): number; isInverse(): number; isStrikethrough(): number } | undefined;
  length: number;
}

/** Render a buffer line with ANSI escape sequences preserved. */
function renderLineWithColor(line: ColorBufferLine): string {
  // First pass: find the rightmost cell with non-default style or non-space content.
  // This lets us trim trailing default-styled whitespace without breaking styled spans.
  let lastStyledOrContent = -1;
  for (let x = 0; x < line.length; x++) {
    const cell = line.getCell(x);
    if (!cell) break;
    if (cell.getWidth() === 0) continue;
    const chars = cell.getChars();
    if (!isDefaultStyle(getCellStyle(cell)) || (chars !== "" && chars !== " ")) {
      lastStyledOrContent = x;
    }
  }

  if (lastStyledOrContent < 0) return ""; // entirely empty/default line

  let result = "";
  let currentStyle: CellStyle | null = null;

  for (let x = 0; x <= lastStyledOrContent; x++) {
    const cell = line.getCell(x);
    if (!cell) break;
    if (cell.getWidth() === 0) continue; // wide char continuation cell

    const chars = cell.getChars();
    const style = getCellStyle(cell);

    if (!currentStyle || !stylesEqual(currentStyle, style)) {
      // Style changed — always reset before switching
      if (currentStyle !== null && !isDefaultStyle(currentStyle)) {
        result += "\x1b[0m";
      }
      if (!isDefaultStyle(style)) {
        result += styleToAnsi(style);
      }
      currentStyle = style;
    }

    // Empty cells (width=1, no chars) are spaces — preserve them for background color
    result += chars || " ";
  }

  // Reset at end of line if we had styling
  if (currentStyle && !isDefaultStyle(currentStyle)) {
    result += "\x1b[0m";
  }

  return result;
}

// ---- Pure helper functions (exported for testing) ----

/** Extract title from a raw title string (or undefined). */
export function extractTitle(raw: string | undefined): string {
  return raw ?? "";
}

/** Extract fullscreen status from the xterm IBufferNamespace. */
export function extractIsFullscreen(bufferNamespace: { active: { type: string } }): boolean {
  return bufferNamespace.active.type === "alternate";
}

/** Check if any observable state has changed between two snapshots. */
export function hasChanged(
  before: { screen: string; title: string; is_fullscreen: boolean },
  current: { screen: string; title: string; is_fullscreen: boolean }
): boolean {
  return (
    current.screen !== before.screen ||
    current.title !== before.title ||
    current.is_fullscreen !== before.is_fullscreen
  );
}

// Special key name → escape sequence mapping
const KEY_MAP: Record<string, string> = {
  "ctrl+a": "\x01", "ctrl+b": "\x02", "ctrl+c": "\x03", "ctrl+d": "\x04",
  "ctrl+e": "\x05", "ctrl+f": "\x06", "ctrl+g": "\x07", "ctrl+h": "\x08",
  "ctrl+i": "\x09", "ctrl+j": "\x0a", "ctrl+k": "\x0b", "ctrl+l": "\x0c",
  "ctrl+m": "\x0d", "ctrl+n": "\x0e", "ctrl+o": "\x0f", "ctrl+p": "\x10",
  "ctrl+q": "\x11", "ctrl+r": "\x12", "ctrl+s": "\x13", "ctrl+t": "\x14",
  "ctrl+u": "\x15", "ctrl+v": "\x16", "ctrl+w": "\x17", "ctrl+x": "\x18",
  "ctrl+y": "\x19", "ctrl+z": "\x1a",
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

/** List of all supported key names for use with `press`. */
export const SUPPORTED_KEYS: string[] = Object.keys(KEY_MAP);

export class Session {
  readonly id: string;
  label: string;
  readonly command: string;
  readonly startTime: number;

  private ptyProcess: pty.IPty;
  private terminal: Terminal;
  private _status: "running" | "exited" = "running";
  private _exitCode: number | null = null;
  private lastSnapshot: string = "";
  private _title: string = "";
  private _isFullscreen: boolean;

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

    this.terminal = new Terminal({ cols, rows, allowProposedApi: true, scrollback: 10000 });

    // Initialize fullscreen status immediately (onBufferChange only fires on changes)
    this._isFullscreen = extractIsFullscreen(this.terminal.buffer);

    this.terminal.onTitleChange((title: string) => {
      this._title = extractTitle(title);
      this.notifyListeners();
    });

    this.terminal.buffer.onBufferChange(() => {
      this._isFullscreen = extractIsFullscreen(this.terminal.buffer);
      this.notifyListeners();
    });

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

  /** Send literal text to the PTY. Supports \n \r \t escape sequences. */
  send(input: string): void {
    if (this._status === "exited") {
      throw new Error(`Session ${this.id} has already exited`);
    }
    const interpreted = input
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t");
    this.ptyProcess.write(interpreted);
  }

  /** Press a named key. Throws a descriptive error if the key name is unknown. */
  press(key: string): void {
    if (this._status === "exited") {
      throw new Error(`Session ${this.id} has already exited`);
    }
    const mapped = KEY_MAP[key.toLowerCase()];
    if (mapped === undefined) {
      const supported = Object.keys(KEY_MAP).join(", ");
      throw new Error(
        `Unknown key: "${key}". Run \`tui-use keys\` to see all supported key names.\nSupported keys: ${supported}`
      );
    }
    this.ptyProcess.write(mapped);
  }

  /**
   * Return the current rendered screen as raw lines + cursor.
   * Trailing empty lines and per-line trailing spaces are removed.
   * Updates lastSnapshot for change detection.
   */
  snapshot(options?: { color?: boolean }): { lines: string[]; cursor: { x: number; y: number }; changed: boolean; highlights: Highlight[]; title: string; is_fullscreen: boolean } {
    const buf = this.terminal.buffer.active;
    const useColor = options?.color ?? false;
    const plainLines: string[] = [];
    const startY = buf.viewportY;
    for (let i = 0; i < this.terminal.rows; i++) {
      plainLines.push((buf.getLine(startY + i)?.translateToString(true) ?? "").trimEnd());
    }
    // Remove trailing empty lines
    while (plainLines.length > 0 && plainLines[plainLines.length - 1] === "") {
      plainLines.pop();
    }
    // Remove leading empty lines (TUI apps like fzf render from bottom)
    while (plainLines.length > 0 && plainLines[0] === "") {
      plainLines.shift();
    }
    // Change detection always uses plain text
    const plainScreen = plainLines.join("\n");
    const changed = plainScreen !== this.lastSnapshot;
    this.lastSnapshot = plainScreen;

    // Build color lines if requested
    let lines: string[];
    if (useColor) {
      lines = [];
      for (let i = 0; i < this.terminal.rows; i++) {
        const bufLine = buf.getLine(startY + i);
        lines.push(bufLine ? renderLineWithColor(bufLine) : "");
      }
      // Trim trailing empty lines (match plain text trimming)
      while (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
      while (lines.length > 0 && lines[0] === "") {
        lines.shift();
      }
    } else {
      lines = plainLines;
    }
    const highlights = extractHighlights(buf, this.terminal.rows, startY);
    return {
      lines,
      cursor: { x: buf.cursorX, y: buf.cursorY },
      changed,
      highlights,
      title: this._title,
      is_fullscreen: this._isFullscreen,
    };
  }

  /**
   * Wait until the screen changes (or until pattern matches), then return snapshot.
   * If process exits, returns immediately.
   */
  async wait(
    timeoutMs: number = 3000,
    text?: string,
    options?: { color?: boolean }
  ): Promise<{ lines: string[]; cursor: { x: number; y: number }; changed: boolean; highlights: ReturnType<typeof extractHighlights>; title: string; is_fullscreen: boolean }> {
    const beforeScreen = this.lastSnapshot;
    const beforeTitle = this._title;
    const beforeFullscreen = this._isFullscreen;

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
        const startY = buf.viewportY;
        for (let i = 0; i < this.terminal.rows; i++) {
          lines.push((buf.getLine(startY + i)?.translateToString(true) ?? "").trimEnd());
        }
        while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
        while (lines.length > 0 && lines[0] === "") lines.shift();
        const currentScreen = lines.join("\n");

        if (text) {
          // Pattern mode: resolve when pattern appears in screen
          if (new RegExp(text).test(currentScreen)) { done(); return; }
        } else {
          // Change mode: resolve when any observable state differs from before AND has been idle
          if (hasChanged(
            { screen: beforeScreen, title: beforeTitle, is_fullscreen: beforeFullscreen },
            { screen: currentScreen, title: this._title, is_fullscreen: this._isFullscreen }
          )) {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(done, 100);
          }
        }
      };

      this.changeListeners.push(check);
      check(); // check immediately in case already changed
    });

    this.changeListeners = this.changeListeners.filter((l) => typeof l === "function");
    return this.snapshot(options);
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

  /** Find text pattern in the current screen */
  find(pattern: string): Array<{ line: number; col_start: number; col_end: number; text: string }> {
    const matches: Array<{ line: number; col_start: number; col_end: number; text: string }> = [];
    const buf = this.terminal.buffer.active;
    const regex = new RegExp(pattern);

    for (let y = 0; y < this.terminal.rows; y++) {
      const line = buf.getLine(y);
      if (line) {
        const lineText = line.translateToString(true);
        const match = regex.exec(lineText);
        if (match) {
          matches.push({
            line: y,
            col_start: match.index,
            col_end: match.index + match[0].length,
            text: match[0],
          });
        }
      }
    }
    return matches;
  }

  /** Scroll the terminal buffer (for non-fullscreen apps like less/cat) */
  scroll(lines: number): boolean {
    // Scroll the viewport to view buffer history
    // positive lines = scroll down (view older content)
    // negative lines = scroll up (view newer content)
    try {
      this.terminal.scrollLines(lines);
      return true;
    } catch {
      return false;
    }
  }

  /** Rename the session */
  rename(newLabel: string): void {
    (this as any).label = newLabel;
  }

  private notifyListeners(): void {
    const listeners = [...this.changeListeners];
    this.changeListeners = [];
    for (const l of listeners) l();
  }
}
