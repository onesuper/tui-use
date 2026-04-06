/**
 * termlink/src/daemon.ts
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
  SendRequest,
  ReadRequest,
  KillRequest,
} from "./protocol";

const TERMLINK_DIR = path.join(os.homedir(), ".termlink");
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

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
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

    case "read": {
      const r = req as ReadRequest;
      const session = sessions.get(r.session_id);
      if (!session) {
        return { type: "error", message: `Session not found: ${r.session_id}` };
      }
      const output = await session.read(r.timeout_ms ?? 1500, r.wait_for);
      return {
        type: "read",
        session_id: r.session_id,
        output,
        status: session.status,
        exit_code: session.exitCode,
      };
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
    process.stderr.write(`termlink daemon started (pid=${process.pid})\n`);
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
