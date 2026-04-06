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
  SendRequest,
  KillRequest,
} from "./protocol";

const TERMLINK_DIR = path.join(os.homedir(), ".tui-use");
export const SOCKET_PATH = path.join(TERMLINK_DIR, "daemon.sock");
export const PID_PATH = path.join(TERMLINK_DIR, "daemon.pid");

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ---- Session registry ----

const sessions = new Map<string, Session>();
let idleTimer: NodeJS.Timeout | null = null;

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
      resetIdleTimer();
      return { type: "start", session_id: id };
    }

    case "snapshot": {
      const r = req as SnapshotRequest;
      const session = sessions.get(r.session_id);
      if (!session) {
        return { type: "error", message: `Session not found: ${r.session_id}` };
      }
      const { screen, cursor, changed } = session.snapshot();
      return {
        type: "snapshot",
        session_id: r.session_id,
        screen,
        cursor,
        changed,
        status: session.status,
        exit_code: session.exitCode,
      };
    }

    case "wait": {
      const r = req as WaitRequest;
      const session = sessions.get(r.session_id);
      if (!session) {
        return { type: "error", message: `Session not found: ${r.session_id}` };
      }
      const { screen, cursor, changed } = await session.wait(r.timeout_ms ?? 3000, r.until);
      return {
        type: "wait",
        session_id: r.session_id,
        screen,
        cursor,
        changed,
        status: session.status,
        exit_code: session.exitCode,
      };
    }

    case "send": {
      const r = req as SendRequest;
      const session = sessions.get(r.session_id);
      if (!session) {
        return { type: "error", message: `Session not found: ${r.session_id}` };
      }
      try {
        session.send(r.input);
        return { type: "send", ok: true };
      } catch (e: unknown) {
        return {
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        };
      }
    }

    case "kill": {
      const r = req as KillRequest;
      const session = sessions.get(r.session_id);
      if (!session) {
        return { type: "error", message: `Session not found: ${r.session_id}` };
      }
      session.kill();
      sessions.delete(r.session_id);
      resetIdleTimer();
      return { type: "kill", ok: true };
    }

    case "list": {
      const list = [...sessions.values()].map((s) => s.toInfo());
      return { type: "list", sessions: list };
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
