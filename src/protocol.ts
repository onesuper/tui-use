/**
 * termlink/src/protocol.ts
 *
 * IPC message types for CLI ↔ daemon communication over Unix socket.
 * All messages are newline-delimited JSON.
 */

// ---- Requests ----

export type Request =
  | StartRequest
  | SnapshotRequest
  | WaitRequest
  | SendRequest
  | KillRequest
  | ListRequest;

export interface StartRequest {
  type: "start";
  command: string;
  cwd?: string;
  label?: string;
  cols?: number;
  rows?: number;
}

export type ScreenFormat = "text" | "lines" | "numbered" | "pretty";

export interface SnapshotRequest {
  type: "snapshot";
  session_id: string;
}

export interface WaitRequest {
  type: "wait";
  session_id: string;
  timeout_ms?: number;   // default 3000
  until?: string;        // regex — block until screen contains pattern
}

export interface SendRequest {
  type: "send";
  session_id: string;
  input: string;
}

export interface KillRequest {
  type: "kill";
  session_id: string;
}

export interface ListRequest {
  type: "list";
}

// ---- Responses ----

export type Response =
  | StartResponse
  | ScreenResponse
  | SendResponse
  | KillResponse
  | ListResponse
  | ErrorResponse;

export interface StartResponse {
  type: "start";
  session_id: string;
}

/** Returned by both `snapshot` and `wait` */
export interface ScreenResponse {
  type: "snapshot" | "wait";
  session_id: string;
  lines: string[];                  // raw screen lines, trailing empty lines removed
  cursor: { x: number; y: number };
  changed: boolean;                // true if screen changed since last snapshot/wait
  status: "running" | "exited";
  exit_code: number | null;
}

export interface SendResponse {
  type: "send";
  ok: boolean;
}

export interface KillResponse {
  type: "kill";
  ok: boolean;
}

export interface ListResponse {
  type: "list";
  sessions: SessionInfo[];
}

export interface SessionInfo {
  session_id: string;
  label: string;
  command: string;
  status: "running" | "exited";
  exit_code: number | null;
  start_time: number;
}

export interface ErrorResponse {
  type: "error";
  message: string;
}
