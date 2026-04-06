#!/usr/bin/env node
/**
 * termlink/src/cli.ts
 *
 * Entry point for the `termlink` CLI command.
 *
 *   termlink start "command"          → session_id
 *   termlink send <id> "input"        → ok
 *   termlink read <id>                → JSON output
 *   termlink kill <id>                → ok
 *   termlink list                     → JSON session list
 */
import { Command } from "commander";
import { sendRequest } from "./client";
import { Response, ErrorResponse } from "./protocol";

const program = new Command();

program
  .name("termlink")
  .description("Interactive CLI bridge for AI coding agents")
  .version("0.1.0");

// ---- start ----
program
  .command("start <command>")
  .description("Start an interactive program in a PTY session")
  .option("--cwd <dir>", "Working directory for the command")
  .option("--label <name>", "Human-readable label for this session")
  .option("--cols <n>", "Terminal width (default: 120)", "120")
  .option("--rows <n>", "Terminal height (default: 30)", "30")
  .action(async (command: string, opts) => {
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

// ---- send ----
program
  .command("send <session_id> <input>")
  .description("Send input to a session (use \\n for Enter, \\t for Tab)")
  .action(async (session_id: string, input: string) => {
    const res = await sendRequest({ type: "send", session_id, input });
    handleResponse(res, (r) => {
      if (r.type === "send") {
        console.log(JSON.stringify({ ok: r.ok }));
      }
    });
  });

// ---- read ----
program
  .command("read <session_id>")
  .description("Read buffered output from a session")
  .option("--timeout <ms>", "Max wait time in ms (default: 1500)", "1500")
  .option("--wait-for <pattern>", "Block until output matches regex pattern")
  .action(async (session_id: string, opts) => {
    const res = await sendRequest({
      type: "read",
      session_id,
      timeout_ms: parseInt(opts.timeout, 10),
      wait_for: opts.waitFor,
    });
    handleResponse(res, (r) => {
      if (r.type === "read") {
        console.log(
          JSON.stringify(
            {
              session_id: r.session_id,
              output: r.output,
              status: r.status,
              exit_code: r.exit_code,
            },
            null,
            2
          )
        );
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
