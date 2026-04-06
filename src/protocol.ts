/**
 * termlink/src/protocol.ts
 *
 * IPC message types for CLI ↔ daemon communication over Unix socket.
 * All messages are newline-delimited JSON.
 */

// ---- Requests ----

export type Request =
  | StartRequest
  | SendRequest
  | ReadRequest
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

export interface SendRequest {
  type: "send";
  session_id: string;
  input: string;
}

export interface ReadRequest {
  type: "read";
  session_id: string;
  timeout_ms?: number;      // default 1500
  wait_for?: string;        // regex pattern — block until matched or timeout
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
  | SendResponse
  | ReadResponse
  | KillResponse
  | ListResponse
  | ErrorResponse;

export interface StartResponse {
  type: "start";
  session_id: string;
}

export interface SendResponse {
  type: "send";
  ok: boolean;
}

export interface ReadResponse {
  type: "read";
  session_id: string;
  output: string;
  status: "running" | "exited";
  exit_code: number | null;
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
  start_time: number;   // unix timestamp ms
}

export interface ErrorResponse {
  type: "error";
  message: string;
}
