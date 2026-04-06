/**
 * termlink/src/client.ts
 *
 * CLI → daemon IPC client.
 * Auto-starts the daemon if it's not running.
 */
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import { SOCKET_PATH, PID_PATH } from "./daemon";
import { Request, Response } from "./protocol";

const DAEMON_START_TIMEOUT_MS = 3000;
const DAEMON_POLL_INTERVAL_MS = 100;

/** Send one request to daemon, return response. Auto-starts daemon if needed. */
export async function sendRequest(req: Request): Promise<Response> {
  if (!isDaemonRunning()) {
    await startDaemon();
  }
  return sendToDaemon(req);
}

function isDaemonRunning(): boolean {
  if (!fs.existsSync(SOCKET_PATH)) return false;
  if (!fs.existsSync(PID_PATH)) return false;
  try {
    const pid = parseInt(fs.readFileSync(PID_PATH, "utf-8").trim(), 10);
    process.kill(pid, 0); // throws if process doesn't exist
    return true;
  } catch {
    return false;
  }
}

async function startDaemon(): Promise<void> {
  const daemonScript = path.join(__dirname, "daemon.js");

  const child = child_process.spawn(process.execPath, [daemonScript], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  // Wait for socket to appear
  const deadline = Date.now() + DAEMON_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (fs.existsSync(SOCKET_PATH)) return;
    await sleep(DAEMON_POLL_INTERVAL_MS);
  }
  throw new Error("Daemon failed to start within timeout");
}

function sendToDaemon(req: Request): Promise<Response> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(SOCKET_PATH);
    let buffer = "";
    let responded = false;

    socket.on("connect", () => {
      socket.write(JSON.stringify(req) + "\n");
    });

    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        if (!responded) {
          responded = true;
          try {
            resolve(JSON.parse(line) as Response);
          } catch (e) {
            reject(new Error(`Invalid response JSON: ${line}`));
          }
          socket.destroy();
        }
      }
    });

    socket.on("error", reject);
    socket.on("close", () => {
      if (!responded) {
        reject(new Error("Connection closed before response"));
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
