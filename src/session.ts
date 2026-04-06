/**
 * termlink/src/session.ts
 *
 * Wraps a node-pty IPty instance. Buffers all output, tracks exit status.
 */
import * as pty from "node-pty";
import { SessionInfo } from "./protocol";

export class Session {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly startTime: number;

  private ptyProcess: pty.IPty;
  private outputBuffer: string = "";
  private readCursor: number = 0;
  private _status: "running" | "exited" = "running";
  private _exitCode: number | null = null;

  // Listeners waiting for new output
  private outputListeners: Array<() => void> = [];

  constructor(
    id: string,
    command: string,
    options: { cwd?: string; label?: string; cols?: number; rows?: number }
  ) {
    this.id = id;
    this.command = command;
    this.label = options.label ?? command.slice(0, 40);
    this.startTime = Date.now();

    const shell = process.env.SHELL ?? "/bin/sh";
    this.ptyProcess = pty.spawn(shell, ["-c", command], {
      name: "xterm-256color",
      cols: options.cols ?? 120,
      rows: options.rows ?? 30,
      cwd: options.cwd ?? process.cwd(),
      env: process.env as { [key: string]: string },
    });

    this.ptyProcess.onData((data: string) => {
      this.outputBuffer += data;
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

  /** Send raw input to the PTY. Interprets \n and \r escape sequences. */
  send(input: string): void {
    if (this._status === "exited") {
      throw new Error(`Session ${this.id} has already exited`);
    }
    // Interpret escape sequences
    const interpreted = input
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t");
    this.ptyProcess.write(interpreted);
  }

  /**
   * Read new output since last read call.
   * If wait_for pattern provided, waits until output matches or timeout.
   */
  async read(timeoutMs: number = 1500, waitFor?: string): Promise<string> {
    const startCursor = this.readCursor;

    const getNewOutput = (): string => {
      const newOutput = this.outputBuffer.slice(this.readCursor);
      this.readCursor = this.outputBuffer.length;
      return newOutput;
    };

    // If we already have output and no wait_for, return immediately
    if (!waitFor && this.outputBuffer.length > this.readCursor) {
      return getNewOutput();
    }

    // If process has exited, return whatever is buffered
    if (this._status === "exited") {
      return getNewOutput();
    }

    // Wait for output with timeout
    await new Promise<void>((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, timeoutMs);

      const check = () => {
        if (resolved) return;
        const newOutput = this.outputBuffer.slice(startCursor);
        const shouldResolve =
          this._status === "exited" ||
          (waitFor
            ? new RegExp(waitFor).test(newOutput)
            : newOutput.length > 0);
        if (shouldResolve) {
          resolved = true;
          clearTimeout(timer);
          resolve();
        }
      };

      this.outputListeners.push(check);
    });

    // Clean up stale listeners
    this.outputListeners = this.outputListeners.filter(
      (l) => typeof l === "function"
    );

    return getNewOutput();
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
    const listeners = [...this.outputListeners];
    this.outputListeners = [];
    for (const l of listeners) l();
  }
}
