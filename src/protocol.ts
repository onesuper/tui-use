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
  | ListRequest
  | UseRequest;

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
}

export interface WaitRequest {
  type: "wait";
  timeout_ms?: number;   // default 3000
  text?: string;         // substring or regex — block until screen contains text
}

export interface SendRequest {
  type: "send";
  input: string;
}

export interface KillRequest {
  type: "kill";
}

export interface ListRequest {
  type: "list";
}

export interface UseRequest {
  type: "use";
  session_id: string;
}

// ---- Responses ----

export type Response =
  | StartResponse
  | ScreenResponse
  | SendResponse
  | KillResponse
  | ListResponse
  | UseResponse
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
  title: string;                   // OSC 0/2 window title set by the process
  is_fullscreen: boolean;          // true when app is using the alternate buffer
  highlights: Array<{              // inverse-video spans (selected items, highlights)
    line: number;
    col_start: number;
    col_end: number;
    text: string;
  }>;
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
  current?: string;  // current window session_id
}

export interface UseResponse {
  type: "use";
  session_id: string;
  ok: boolean;
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
