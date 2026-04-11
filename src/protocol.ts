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
  | TypeRequest
  | PressRequest
  | KillRequest
  | ListRequest
  | UseRequest
  | PasteRequest
  | FindRequest
  | ScrollRequest
  | InfoRequest
  | RenameRequest;

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
  color?: boolean;       // when true, lines contain ANSI escape sequences
}

export interface WaitRequest {
  type: "wait";
  timeout_ms?: number;   // default 3000
  text?: string;         // substring or regex — block until screen contains text
  debounce_ms?: number;  // idle time after last change before resolving (default 100ms)
  color?: boolean;       // when true, lines contain ANSI escape sequences
}

/** Send literal text to the PTY. Supports \n \r \t escape sequences. */
export interface TypeRequest {
  type: "type";
  input: string;
}

/** Press a named key (must exist in KEY_MAP, e.g. "ctrl+r", "enter", "escape"). */
export interface PressRequest {
  type: "press";
  key: string;
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

export interface PasteRequest {
  type: "paste";
  text: string;
}

export interface FindRequest {
  type: "find";
  pattern: string;
}

export interface ScrollRequest {
  type: "scroll";
  lines: number;  // positive = down, negative = up
}

export interface InfoRequest {
  type: "info";
}

export interface RenameRequest {
  type: "rename";
  label: string;
}

// ---- Responses ----

export type Response =
  | StartResponse
  | ScreenResponse
  | TypeResponse
  | PressResponse
  | KillResponse
  | ListResponse
  | UseResponse
  | PasteResponse
  | FindResponse
  | ScrollResponse
  | InfoResponse
  | RenameResponse
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
  cols: number;                    // terminal width (PTY cols)
  rows: number;                    // terminal height (PTY rows)
  highlights: Array<{              // inverse-video spans (selected items, highlights)
    line: number;
    col_start: number;
    col_end: number;
    text: string;
  }>;
}

export interface TypeResponse {
  type: "type";
  ok: boolean;
}

export interface PressResponse {
  type: "press";
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

export interface PasteResponse {
  type: "paste";
  ok: boolean;
}

export interface FindResponse {
  type: "find";
  matches: Array<{
    line: number;
    col_start: number;
    col_end: number;
    text: string;
  }>;
}

export interface ScrollResponse {
  type: "scroll";
  lines: number;
  ok: boolean;
}

export interface InfoResponse {
  type: "info";
  session_id: string;
  label: string;
  command: string;
  status: "running" | "exited";
  exit_code: number | null;
  start_time: number;
  cols: number;
  rows: number;
}

export interface RenameResponse {
  type: "rename";
  ok: boolean;
  label: string;
}

export interface ErrorResponse {
  type: "error";
  message: string;
}
