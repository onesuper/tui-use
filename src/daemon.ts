/**
 * tui-use/src/daemon.ts
 *
 * Background daemon process. Manages PTY sessions, listens on Unix socket.
 * Auto-exits when all sessions have been dead for IDLE_TIMEOUT_MS.
 *
 * Run directly: node dist/daemon.js
 * Usually auto-started by client.ts when needed.
 */
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Session } from "./session";
import {
  Request,
  Response,
  StartRequest,
  SnapshotRequest,
  WaitRequest,
  TypeRequest,
  PressRequest,
  KillRequest,
  UseRequest,
} from "./protocol";

const TERMLINK_DIR = path.join(os.homedir(), ".tui-use");
export const SOCKET_PATH = path.join(TERMLINK_DIR, "daemon.sock");
export const PID_PATH = path.join(TERMLINK_DIR, "daemon.pid");

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ---- Session registry ----

const sessions = new Map<string, Session>();
let idleTimer: NodeJS.Timeout | null = null;
let currentSession: string | null = null;

function setCurrentSession(id: string | null): void {
  currentSession = id;
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const allDead = [...sessions.values()].every(
      (s) => s.status === "exited"
    );
    if (allDead) {
      process.exit(0);
    }
  }, IDLE_TIMEOUT_MS);
  idleTimer.unref(); // don't prevent process exit if nothing else is running
}

const ADJECTIVES = [
  "brave", "calm", "eager", "fancy", "gentle", "happy", "jolly", "kind",
  "lively", "merry", "nice", "proud", "quiet", "rapid", "silly", "tidy",
  "witty", "zesty", "bold", "crisp", "dusty", "early", "faint", "grand",
  "heavy", "icy", "jazzy", "keen", "lazy", "misty", "noble", "odd",
  "pale", "quirky", "rosy", "salty", "tangy", "urban", "vivid", "warm",
];

const NOUNS = [
  "panda", "koala", "otter", "crane", "finch", "gecko", "heron", "ibis",
  "jaguar", "kiwi", "lemur", "mink", "newt", "okapi", "puffin", "quail",
  "raven", "stoat", "tapir", "urial", "viper", "wombat", "xerus", "yak",
  "zebra", "bison", "capybara", "dingo", "elk", "ferret", "gibbon", "hawk",
  "impala", "jackal", "kudu", "lynx", "marmot", "narwhal", "ocelot", "python",
];

function generateId(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}`;
}

// ---- Request handlers ----

async function handleRequest(req: Request): Promise<Response> {
  switch (req.type) {
    case "start": {
      const r = req as StartRequest;
      const id = generateId();
      const session = new Session(id, r.command, {
        cwd: r.cwd,
        label: r.label,
        cols: r.cols,
        rows: r.rows,
      });
      sessions.set(id, session);
      setCurrentSession(id);  // 新启动的 session 自动设为当前
      resetIdleTimer();
      return { type: "start", session_id: id };
    }

    case "use": {
      const r = req as UseRequest;
      if (!sessions.has(r.session_id)) {
        return { type: "error", message: `Session not found: ${r.session_id}` };
      }
      setCurrentSession(r.session_id);
      return { type: "use", session_id: r.session_id, ok: true };
    }

    case "snapshot": {
      if (!currentSession) {
        return { type: "error", message: "No current session. Run 'tui-use use <session_id>' first." };
      }
      const session = sessions.get(currentSession);
      if (!session) {
        return { type: "error", message: `Session not found: ${currentSession}` };
      }
      const { lines, cursor, changed, highlights, title, is_fullscreen } = session.snapshot({ color: (req as SnapshotRequest).color });
      return {
        type: "snapshot",
        session_id: currentSession,
        lines,
        cursor,
        changed,
        highlights,
        title,
        is_fullscreen,
        cols: session.cols,
        rows: session.rows,
        status: session.status,
        exit_code: session.exitCode,
      };
    }

    case "wait": {
      if (!currentSession) {
        return { type: "error", message: "No current session. Run 'tui-use use <session_id>' first." };
      }
      const session = sessions.get(currentSession);
      if (!session) {
        return { type: "error", message: `Session not found: ${currentSession}` };
      }
      const waitReq = req as WaitRequest;
      const { lines, cursor, changed, highlights, title, is_fullscreen } = await session.wait(waitReq.timeout_ms ?? 3000, waitReq.text, { color: waitReq.color });
      return {
        type: "wait",
        session_id: currentSession,
        lines,
        cursor,
        changed,
        highlights,
        title,
        is_fullscreen,
        cols: session.cols,
        rows: session.rows,
        status: session.status,
        exit_code: session.exitCode,
      };
    }

    case "type": {
      const r = req as TypeRequest;
      if (!currentSession) {
        return { type: "error", message: "No current session. Run 'tui-use use <session_id>' first." };
      }
      const session = sessions.get(currentSession);
      if (!session) {
        return { type: "error", message: `Session not found: ${currentSession}` };
      }
      try {
        session.send(r.input);
        return { type: "type", ok: true };
      } catch (e: unknown) {
        return {
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        };
      }
    }

    case "press": {
      const r = req as PressRequest;
      if (!currentSession) {
        return { type: "error", message: "No current session. Run 'tui-use use <session_id>' first." };
      }
      const session = sessions.get(currentSession);
      if (!session) {
        return { type: "error", message: `Session not found: ${currentSession}` };
      }
      try {
        session.press(r.key);
        return { type: "press", ok: true };
      } catch (e: unknown) {
        return {
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        };
      }
    }

    case "kill": {
      if (!currentSession) {
        return { type: "error", message: "No current session. Run 'tui-use use <session_id>' first." };
      }
      const session = sessions.get(currentSession);
      if (!session) {
        return { type: "error", message: `Session not found: ${currentSession}` };
      }
      session.kill();
      sessions.delete(currentSession);
      setCurrentSession(null);
      resetIdleTimer();
      return { type: "kill", ok: true };
    }

    case "list": {
      const list = [...sessions.values()].map((s) => s.toInfo());
      return { type: "list", sessions: list, current: currentSession ?? undefined };
    }

    case "paste": {
      if (!currentSession) {
        return { type: "error", message: "No current session. Run 'tui-use use <session_id>' first." };
      }
      const session = sessions.get(currentSession);
      if (!session) {
        return { type: "error", message: `Session not found: ${currentSession}` };
      }
      const r = req as import("./protocol").PasteRequest;
      // Send text with line-by-line delay for stability
      const lines = r.text.split("\n");
      for (const line of lines) {
        session.send(line);
        session.press("enter");
      }
      return { type: "paste", ok: true };
    }

    case "find": {
      if (!currentSession) {
        return { type: "error", message: "No current session. Run 'tui-use use <session_id>' first." };
      }
      const session = sessions.get(currentSession);
      if (!session) {
        return { type: "error", message: `Session not found: ${currentSession}` };
      }
      const r = req as import("./protocol").FindRequest;
      const matches = session.find(r.pattern);
      return { type: "find", matches };
    }

    case "scroll": {
      if (!currentSession) {
        return { type: "error", message: "No current session. Run 'tui-use use <session_id>' first." };
      }
      const session = sessions.get(currentSession);
      if (!session) {
        return { type: "error", message: `Session not found: ${currentSession}` };
      }
      const r = req as import("./protocol").ScrollRequest;
      const ok = session.scroll(r.lines);
      return { type: "scroll", lines: r.lines, ok };
    }

    case "info": {
      if (!currentSession) {
        return { type: "error", message: "No current session. Run 'tui-use use <session_id>' first." };
      }
      const session = sessions.get(currentSession);
      if (!session) {
        return { type: "error", message: `Session not found: ${currentSession}` };
      }
      return {
        type: "info",
        session_id: session.id,
        label: session.label,
        command: session.command,
        status: session.status,
        exit_code: session.exitCode,
        start_time: session.startTime,
        cols: session.cols,
        rows: session.rows,
      };
    }

    case "rename": {
      if (!currentSession) {
        return { type: "error", message: "No current session. Run 'tui-use use <session_id>' first." };
      }
      const session = sessions.get(currentSession);
      if (!session) {
        return { type: "error", message: `Session not found: ${currentSession}` };
      }
      const r = req as import("./protocol").RenameRequest;
      session.rename(r.label);
      return { type: "rename", ok: true, label: r.label };
    }

    default: {
      return { type: "error", message: "Unknown request type" };
    }
  }
}

// ---- Socket server ----

function startServer() {
  fs.mkdirSync(TERMLINK_DIR, { recursive: true });

  // Clean up stale socket
  if (fs.existsSync(SOCKET_PATH)) {
    fs.unlinkSync(SOCKET_PATH);
  }

  const server = net.createServer((socket) => {
    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let req: Request;
        try {
          req = JSON.parse(line) as Request;
        } catch {
          socket.write(
            JSON.stringify({ type: "error", message: "Invalid JSON" }) + "\n"
          );
          continue;
        }

        handleRequest(req).then((res) => {
          socket.write(JSON.stringify(res) + "\n");
        }).catch((err) => {
          process.stderr.write(`[daemon] handleRequest error: ${err?.stack ?? err}\n`);
          socket.write(JSON.stringify({ type: "error", message: String(err?.message ?? err) }) + "\n");
        });
      }
    });

    socket.on("error", () => {
      /* ignore client disconnects */
    });
  });

  server.listen(SOCKET_PATH, () => {
    // Write PID file
    fs.writeFileSync(PID_PATH, String(process.pid));
    process.stderr.write(`tui-use daemon started (pid=${process.pid})\n`);
  });

  server.on("error", (err) => {
    process.stderr.write(`daemon error: ${err.message}\n`);
    process.exit(1);
  });

  // Cleanup on exit
  process.on("exit", () => {
    try {
      fs.unlinkSync(SOCKET_PATH);
      fs.unlinkSync(PID_PATH);
    } catch {
      /* ignore */
    }
  });

  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, () => process.exit(0));
  }

  resetIdleTimer();
}

// ---- Entry point (when run directly) ----
if (require.main === module) {
  startServer();
}
