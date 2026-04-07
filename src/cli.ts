#!/usr/bin/env node
/**
 * tui-use/src/cli.ts
 *
 * Entry point for the `tui-use` CLI command.
 *
 *   tui-use start <cmd>      → session_id (becomes current)
 *   tui-use use <id>         → set current session
 *   tui-use snapshot         → JSON screen snapshot (current session)
 *   tui-use wait             → JSON screen snapshot after change (current session)
 *   tui-use type <text>      → type text to current session
 *   tui-use press <key>      → press key in current session
 *   tui-use kill             → terminate current session
 *   tui-use list             → JSON session list (with current)
 *   tui-use daemon status    → check daemon status
 *   tui-use daemon stop      → stop the daemon
 *   tui-use daemon restart   → restart the daemon
 */
import { Command } from "commander";
import { sendRequest, checkDaemonStatus, stopDaemon, restartDaemon } from "./client";
import { Response, ErrorResponse, ScreenResponse, ScreenFormat } from "./protocol";
import { KEY_MAP } from "./session";

const program = new Command();

program
  .name("tui-use")
  .description("TUI automation for AI agents — like BrowserUse, but for the terminal")
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
        // Print just the session_id for easy shell capture: SID=$(tui-use start ...)
        console.log(r.session_id);
      }
    });
  });

// ---- snapshot ----
program
  .command("snapshot")
  .description("Return the current rendered screen snapshot (requires: tui-use use <id> first)")
  .option("--format <fmt>", "Output format: text, lines, numbered, pretty (default: text)", "text")
  .action(async (opts) => {
    const res = await sendRequest({ type: "snapshot" });
    handleResponse(res, (r) => printScreen(r as ScreenResponse, opts.format as ScreenFormat));
  });

// ---- wait ----
program
  .command("wait [duration]")
  .description(
    "Wait for screen to change or timeout.\n" +
    "  wait           → wait for screen to change (default 3000ms)\n" +
    "  wait 5000      → wait for 5000ms\n" +
    "  wait --text \"pattern\"  → wait until screen contains text"
  )
  .option("--text <pattern>", "Wait until screen contains text (substring or regex)")
  .option("--format <fmt>", "Output format: text, lines, numbered, pretty (default: text)", "text")
  .action(async (duration: string | undefined, opts) => {
    // Parse duration (position arg) or use default
    let timeoutMs = 3000;
    if (duration) {
      const parsed = parseInt(duration, 10);
      if (!isNaN(parsed)) {
        timeoutMs = parsed;
      }
    }
    const res = await sendRequest({
      type: "wait",
      timeout_ms: timeoutMs,
      text: opts.text,
    });
    handleResponse(res, (r) => printScreen(r as ScreenResponse, opts.format as ScreenFormat));
  });

// ---- type ----
program
  .command("type <input...>")
  .description(
    "Type text to the current session.\n" +
    "  Use \\n for Enter, \\t for Tab\n" +
    "  To specify a different session: tui-use use <id> first"
  )
  .action(async (inputParts: string[]) => {
    const input = inputParts.join(" ");
    const res = await sendRequest({ type: "send", input });
    handleResponse(res, (r) => {
      if (r.type === "send") {
        console.log(JSON.stringify({ ok: r.ok }));
      }
    });
  });

// ---- press ----
program
  .command("press <key>")
  .description(
    "Press a key in the current session.\n" +
    "  Keys: ctrl+c, ctrl+d, arrow_up, arrow_down, enter, escape, tab, etc.\n" +
    "  Run `tui-use keys` for the full key list"
  )
  .action(async (key: string) => {
    const res = await sendRequest({ type: "send", input: key });
    handleResponse(res, (r) => {
      if (r.type === "send") {
        console.log(JSON.stringify({ ok: r.ok }));
      }
    });
  });

// ---- kill ----
program
  .command("kill")
  .description("Terminate the current session (requires: tui-use use <id> first)")
  .action(async () => {
    const res = await sendRequest({ type: "kill" });
    handleResponse(res, (r) => {
      if (r.type === "kill") {
        console.log(JSON.stringify({ ok: r.ok }));
      }
    });
  });

// ---- use ----
program
  .command("use <session_id>")
  .description("Set the current session for subsequent commands")
  .action(async (session_id: string) => {
    const res = await sendRequest({ type: "use", session_id });
    handleResponse(res, (r) => {
      if (r.type === "use") {
        console.log(JSON.stringify({ ok: r.ok, session_id: r.session_id }));
      }
    });
  });

// ---- keys ----
program
  .command("keys")
  .description("List all supported special key names for use with `press`")
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
        const output = {
          sessions: r.sessions,
          current: r.current,
        };
        console.log(JSON.stringify(output, null, 2));
      }
    });
  });

// ---- daemon ----
const daemonCmd = program
  .command("daemon")
  .description("Manage the tui-use daemon (background service)");

daemonCmd
  .command("status")
  .description("Check if the daemon is running")
  .action(() => {
    const status = checkDaemonStatus();
    if (status.running) {
      console.log(JSON.stringify({ status: "running", pid: status.pid }, null, 2));
    } else {
      console.log(JSON.stringify({ status: "stopped" }, null, 2));
    }
  });

daemonCmd
  .command("stop")
  .description("Stop the daemon")
  .action(() => {
    const stopped = stopDaemon();
    console.log(JSON.stringify({ ok: stopped, message: stopped ? "Daemon stopped" : "Daemon was not running" }, null, 2));
  });

daemonCmd
  .command("restart")
  .description("Restart the daemon")
  .action(async () => {
    try {
      await restartDaemon();
      const status = checkDaemonStatus();
      console.log(JSON.stringify({ ok: true, pid: status.pid }, null, 2));
    } catch (e: unknown) {
      console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    }
  });

// ---- helpers ----

function formatScreen(lines: string[], format: ScreenFormat): string | string[] {
  switch (format) {
    case "text":
      return lines.join("\n");
    case "lines":
      return lines;
    case "numbered":
      return lines.map((line, i) => `${i}: ${line}`).join("\n");
    case "pretty":
      return lines.join("\n"); // rendered below outside JSON
    default:
      return lines.join("\n");
  }
}

function printScreen(r: ScreenResponse, format: ScreenFormat = "text"): void {
  if (format === "pretty") {
    const width = 50;
    const header = `─── ${r.session_id} ${"─".repeat(Math.max(0, width - r.session_id.length - 5))}`;
    const footer = `─── ${r.status} | cursor (${r.cursor.x},${r.cursor.y}) ${"─".repeat(Math.max(0, width - r.status.length - 20))}`;
    process.stdout.write(header + "\n");
    for (const line of r.lines) process.stdout.write(line + "\n");
    process.stdout.write(footer + "\n");
    return;
  }

  const screen = formatScreen(r.lines, format);
  console.log(
    JSON.stringify(
      {
        session_id: r.session_id,
        screen,
        cursor: r.cursor,
        changed: r.changed,
        status: r.status,
        exit_code: r.exit_code,
        title: r.title,
        is_fullscreen: r.is_fullscreen,
        highlights: r.highlights,
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
