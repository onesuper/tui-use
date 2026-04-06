#!/usr/bin/env node
/**
 * termlink/src/cli.ts
 *
 * Entry point for the `termlink` CLI command.
 *
 *   termlink start <cmd>           → session_id
 *   termlink snapshot <id>         → JSON screen snapshot
 *   termlink wait <id>             → JSON screen snapshot (after change)
 *   termlink send <id> <input>     → ok
 *   termlink kill <id>             → ok
 *   termlink list                  → JSON session list
 */
import { Command } from "commander";
import { sendRequest } from "./client";
import { Response, ErrorResponse, ScreenResponse } from "./protocol";
import { KEY_MAP } from "./session";

const program = new Command();

program
  .name("termlink")
  .description("Interactive CLI bridge for AI coding agents")
  .version("0.1.0");

// ---- start ----
program
  .command("start [args...]")
  .description("Start an interactive program in a PTY session")
  .option("--cwd <dir>", "Working directory for the command")
  .option("--label <name>", "Human-readable label for this session")
  .option("--cols <n>", "Terminal width (default: 120)", "120")
  .option("--rows <n>", "Terminal height (default: 30)", "30")
  .action(async (args: string[], opts) => {
    const command = args.join(" ");
    if (!command.trim()) {
      process.stderr.write("Error: no command specified\n");
      process.exit(1);
    }
    const res = await sendRequest({
      type: "start",
      command,
      cwd: opts.cwd,
      label: opts.label,
      cols: parseInt(opts.cols, 10),
      rows: parseInt(opts.rows, 10),
    });
    handleResponse(res, (r) => {
      if (r.type === "start") {
        // Print just the session_id for easy shell capture: SID=$(termlink start ...)
        console.log(r.session_id);
      }
    });
  });

// ---- snapshot ----
program
  .command("snapshot <session_id>")
  .description("Return the current rendered screen content")
  .action(async (session_id: string) => {
    const res = await sendRequest({ type: "snapshot", session_id });
    handleResponse(res, (r) => printScreen(r as ScreenResponse));
  });

// ---- wait ----
program
  .command("wait <session_id>")
  .description("Wait for screen to change, then return snapshot")
  .option("--until <pattern>", "Wait until screen contains regex pattern")
  .option("--timeout <ms>", "Max wait time in ms (default: 3000)", "3000")
  .action(async (session_id: string, opts) => {
    const res = await sendRequest({
      type: "wait",
      session_id,
      timeout_ms: parseInt(opts.timeout, 10),
      until: opts.until,
    });
    handleResponse(res, (r) => printScreen(r as ScreenResponse));
  });

// ---- type ----
program
  .command("type <session_id> <input>")
  .description(
    "Type text or send a key to a session.\n" +
    "  Text: use \\n for Enter, \\t for Tab\n" +
    "  Keys: ctrl+c, ctrl+d, arrow_up, arrow_down, arrow_left, arrow_right,\n" +
    "        enter, escape, tab, backspace, page_up, page_down, f1-f10\n" +
    "  Run `termlink keys` for the full key list"
  )
  .action(async (session_id: string, input: string) => {
    const res = await sendRequest({ type: "send", session_id, input });
    handleResponse(res, (r) => {
      if (r.type === "send") {
        console.log(JSON.stringify({ ok: r.ok }));
      }
    });
  });

// ---- kill ----
program
  .command("kill <session_id>")
  .description("Terminate a session")
  .action(async (session_id: string) => {
    const res = await sendRequest({ type: "kill", session_id });
    handleResponse(res, (r) => {
      if (r.type === "kill") {
        console.log(JSON.stringify({ ok: r.ok }));
      }
    });
  });

// ---- keys ----
program
  .command("keys")
  .description("List all supported special key names for use with `send`")
  .action(() => {
    console.log(JSON.stringify(Object.keys(KEY_MAP), null, 2));
  });

// ---- list ----
program
  .command("list")
  .description("List all active sessions")
  .action(async () => {
    const res = await sendRequest({ type: "list" });
    handleResponse(res, (r) => {
      if (r.type === "list") {
        console.log(JSON.stringify(r.sessions, null, 2));
      }
    });
  });

// ---- helpers ----

function printScreen(r: ScreenResponse): void {
  console.log(
    JSON.stringify(
      {
        session_id: r.session_id,
        screen: r.screen,
        cursor: r.cursor,
        changed: r.changed,
        status: r.status,
        exit_code: r.exit_code,
      },
      null,
      2
    )
  );
}

function handleResponse(res: Response, onSuccess: (r: Response) => void): void {
  if (res.type === "error") {
    process.stderr.write(`Error: ${(res as ErrorResponse).message}\n`);
    process.exit(1);
  }
  onSuccess(res);
}

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
