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
 *   tui-use list             → session list (with current)
 *   tui-use daemon status    → check daemon status
 *   tui-use daemon stop      → stop the daemon
 *   tui-use daemon restart   → restart the daemon
 */
import { Command } from "commander";
import { sendRequest, checkDaemonStatus, stopDaemon, restartDaemon } from "./client";
import { Response, ErrorResponse, ScreenResponse } from "./protocol";
import { SUPPORTED_KEYS } from "./session";
import { version } from "../package.json";

const program = new Command();

program
  .name("tui-use")
  .description("TUI automation for AI agents — like BrowserUse, but for the terminal")
  .version(version);

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
  .option("--format <fmt>", "Output format: pretty, json (default: pretty)", "pretty")
  .option("--color", "Preserve ANSI color/style escape sequences in output lines")
  .action(async (opts) => {
    const res = await sendRequest({ type: "snapshot", color: opts.color ?? false });
    handleResponse(res, (r) => printScreen(r as ScreenResponse, opts.format as "pretty" | "json"));
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
  .option("--format <fmt>", "Output format: pretty, json (default: pretty)", "pretty")
  .option("--color", "Preserve ANSI color/style escape sequences in output lines")
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
      color: opts.color ?? false,
    });
    handleResponse(res, (r) => printScreen(r as ScreenResponse, opts.format as "pretty" | "json"));
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
    const res = await sendRequest({ type: "type", input });
    handleResponse(res, (r) => {
      if (r.type === "type") {
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
    const res = await sendRequest({ type: "press", key });
    handleResponse(res, (r) => {
      if (r.type === "press") {
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
    console.log(JSON.stringify(SUPPORTED_KEYS, null, 2));
  });

// ---- paste ----
program
  .command("paste <text...>")
  .description(
    "Paste multi-line text to the current session. Each line is sent followed by Enter."
  )
  .action(async (textParts: string[]) => {
    const text = textParts.join(" ");
    const res = await sendRequest({ type: "paste", text });
    handleResponse(res, (r) => {
      if (r.type === "paste") {
        console.log(JSON.stringify({ ok: r.ok }));
      }
    });
  });

// ---- find ----
program
  .command("find <pattern>")
  .description("Search for text pattern in the current screen (regex supported)")
  .action(async (pattern: string) => {
    const res = await sendRequest({ type: "find", pattern });
    handleResponse(res, (r) => {
      if (r.type === "find") {
        // Pretty output
        if (r.matches.length === 0) {
          console.log("No matches found");
        } else {
          console.log(`Found ${r.matches.length} match(es):`);
          for (const m of r.matches) {
            console.log(`  L${m.line},C${m.col_start}-${m.col_end}: "${m.text}"`);
          }
        }
      }
    });
  });

// ---- scrollup ----
program
  .command("scrollup <lines>")
  .description("Scroll up to view older content (move viewport up). Note: Limited by scrollback buffer.")
  .action(async (lines: string) => {
    const numLines = parseInt(lines, 10);
    if (isNaN(numLines) || numLines < 0) {
      process.stderr.write("Error: lines must be a positive number\n");
      process.exit(1);
    }
    const res = await sendRequest({ type: "scroll", lines: -numLines });
    handleResponse(res, (r) => {
      if (r.type === "scroll") {
        console.log(JSON.stringify({ ok: r.ok, direction: "up", lines: numLines }));
      }
    });
  });

// ---- scrolldown ----
program
  .command("scrolldown <lines>")
  .description("Scroll down to view newer content (move viewport down). Note: Limited by scrollback buffer.")
  .action(async (lines: string) => {
    const numLines = parseInt(lines, 10);
    if (isNaN(numLines) || numLines < 0) {
      process.stderr.write("Error: lines must be a positive number\n");
      process.exit(1);
    }
    const res = await sendRequest({ type: "scroll", lines: numLines });
    handleResponse(res, (r) => {
      if (r.type === "scroll") {
        console.log(JSON.stringify({ ok: r.ok, direction: "down", lines: numLines }));
      }
    });
  });

// ---- info ----
program
  .command("info")
  .description("Show detailed information about the current session")
  .action(async () => {
    const res = await sendRequest({ type: "info" });
    handleResponse(res, (r) => {
      if (r.type === "info") {
        // Pretty format
        console.log(`Session ID: ${r.session_id}`);
        console.log(`Label: ${r.label}`);
        console.log(`Command: ${r.command}`);
        console.log(`Status: ${r.status}`);
        if (r.exit_code !== null) {
          console.log(`Exit Code: ${r.exit_code}`);
        }
        console.log(`Size: ${r.cols}x${r.rows}`);
        console.log(`Started: ${new Date(r.start_time).toISOString()}`);
      }
    });
  });

// ---- rename ----
program
  .command("rename <label>")
  .description("Rename the current session with a new label")
  .action(async (label: string) => {
    const res = await sendRequest({ type: "rename", label });
    handleResponse(res, (r) => {
      if (r.type === "rename") {
        console.log(JSON.stringify({ ok: r.ok, label: r.label }));
      }
    });
  });

// ---- list ----
program
  .command("list")
  .description("List all active sessions")
  .option("--format <fmt>", "Output format: pretty, json (default: pretty)", "pretty")
  .action(async (opts) => {
    const res = await sendRequest({ type: "list" });
    handleResponse(res, (r) => {
      if (r.type === "list") {
        const format = opts.format as "pretty" | "json";
        if (format === "json") {
          const output = {
            sessions: r.sessions,
            current: r.current,
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          // Pretty format: table-like output
          if (r.sessions.length === 0) {
            console.log("No active sessions");
            return;
          }

          // Calculate column widths
          const idWidth = Math.max(10, ...r.sessions.map((s) => s.session_id.length));
          const labelWidth = Math.max(5, ...r.sessions.map((s) => s.label.length));
          const cmdWidth = Math.max(7, ...r.sessions.map((s) => s.command.length));

          // Header
          const header = `${"SESSION ID".padEnd(idWidth)}  ${"LABEL".padEnd(labelWidth)}  ${"COMMAND".padEnd(cmdWidth)}  STATUS`;
          console.log(header);
          console.log("-".repeat(header.length));

          // Rows
          for (const s of r.sessions) {
            const currentMark = s.session_id === r.current ? " [current]" : "";
            const status = s.status + currentMark;
            console.log(
              `${s.session_id.padEnd(idWidth)}  ${s.label.padEnd(labelWidth)}  ${s.command.padEnd(cmdWidth)}  ${status}`
            );
          }
        }
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

function printScreen(r: ScreenResponse, format: "pretty" | "json" = "pretty"): void {
  if (format === "json") {
    console.log(
      JSON.stringify(
        {
          session_id: r.session_id,
          screen: r.lines.join("\n"),
          cursor: r.cursor,
          changed: r.changed,
          status: r.status,
          exit_code: r.exit_code,
          title: r.title,
          is_fullscreen: r.is_fullscreen,
          cols: r.cols,
          rows: r.rows,
          highlights: r.highlights,
        },
        null,
        2
      )
    );
    return;
  }

  // pretty format - use PTY width (matches the actual screen width)
  const width = r.cols;
  const header = `─── ${r.session_id} ${"─".repeat(Math.max(0, width - r.session_id.length - 5))}`;

  const info = `${r.status} | cursor(${r.cursor.x},${r.cursor.y}) | fullscreen:${r.is_fullscreen} | title:"${r.title || ""}"`;
  const footer = `─── ${info} ${"─".repeat(Math.max(0, width - info.length - 5))}`;

  process.stdout.write(header + "\n");
  for (const line of r.lines) process.stdout.write(line + "\n");
  process.stdout.write(footer + "\n");

  // Highlights section
  if (r.highlights.length > 0) {
    process.stdout.write(`highlights(${r.highlights.length}):\n`);
    for (const h of r.highlights) {
      const text = h.text.slice(0, 40) + (h.text.length > 40 ? "..." : "");
      process.stdout.write(`  L${h.line}: "${text}"\n`);
    }
  }
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
