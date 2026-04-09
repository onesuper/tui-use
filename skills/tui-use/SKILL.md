---
name: tui-use
description: Operate interactive terminal programs (REPLs, debuggers, TUI apps) using PTY automation. Use when you need to interact with programs that require keyboard input.
---

# tui-use — TUI Automation for AI Agents

Operate interactive terminal programs that require keyboard input — REPLs, debuggers, TUI apps, anything bash can't reach.

## Core Workflow

```
start → wait → type/press → wait → ... → kill
```

`start` automatically makes the new session current. Only call `use` when switching between multiple existing sessions.

## Commands

```
tui-use start <cmd>                            # Start a program (becomes current session)
tui-use start --cwd <dir> "<cmd> -flags"       # Start in directory, quote full command for flags
tui-use start --label <name> <cmd>             # Start with label
tui-use start --cols <n> --rows <n> <cmd>      # Custom terminal size (default: 120x30)
tui-use use <session_id>                       # Switch to a session
tui-use type <text>                            # Type text (any characters, strings)
tui-use type "<text>\n"                        # Type with Enter
tui-use paste "<text>\n<text>\n"               # Multi-line paste (each line + Enter)
tui-use press <key>                            # Press a named key (enter, escape, ctrl+r, arrow_up…)
tui-use wait                                   # Wait for screen to stabilize (default timeout: 3000ms)
tui-use wait <ms>                              # Custom timeout
tui-use wait --text <pattern>                  # Wait until screen contains pattern (preferred)
tui-use wait --debounce <ms>                   # Idle window before resolving (default: 100ms)
tui-use snapshot                               # Get current screen
tui-use snapshot --format json                 # JSON output
tui-use find <pattern>                         # Search in screen (regex)
tui-use scrollup <n>                           # Scroll up to older content
tui-use scrolldown <n>                         # Scroll down to newer content
tui-use list                                   # List all sessions
tui-use info                                   # Show session details
tui-use rename <label>                         # Rename session
tui-use kill                                   # Kill current session
tui-use daemon status/stop/restart             # Manage daemon
```

---

## type vs press

- **`type <text>`** — sends printable characters: letters, numbers, symbols, vim commands (`i`, `u`, `:wq`)
- **`press <key>`** — sends a named control key: `enter`, `escape`, `tab`, `backspace`, `arrow_up`, `ctrl+r`, `ctrl+c`, `f1`–`f10`

Run `tui-use keys` to see all valid key names.

---

## wait

`wait` blocks until the screen has been stable for 100ms (debounce), then resolves. No need for `sleep`.

- **timeout** (positional, default 3000ms) — deadline; `wait` returns regardless when this expires
- **`--debounce <ms>`** (default 100ms) — how long screen must be idle before resolving; increase for slow programs

**Prefer `--text <pattern>`** for the most reliable results — it waits for a semantic signal, not just silence:

```bash
tui-use wait --text ">>>"       # Python REPL ready
tui-use wait --text "(Pdb)"     # pdb at prompt
tui-use wait --text "\\$"       # shell prompt
```

---

## wait output

Pretty format:

```
─── session-id ──────────────────────────────────────
What is your name?
> Alice
─── running | cursor(2,8) | fullscreen:false | title:"" ─
highlights(0):
```

JSON (`--format json`):

```json
{
  "session_id": "abc12345",
  "screen": "What is your name?\n> Alice",
  "cursor": { "x": 2, "y": 1 },
  "changed": true,
  "status": "running",
  "exit_code": null,
  "title": "",
  "is_fullscreen": false,
  "cols": 120,
  "rows": 30,
  "highlights": []
}
```

---

## Rules

1. **use only when switching** — `start` sets current session automatically
2. **wait before type/press** — confirms program is ready
3. **prefer `--text` over plain wait** — semantic signal beats silence detection
4. **check status** — if `"exited"`, don't send more input
5. **kill when done** — clean up sessions

---

## Example

```bash
tui-use start python3
tui-use wait --text ">>>"
tui-use type "x = 42"
tui-use press enter
tui-use wait --text ">>>"
tui-use type "print(x * 2)"
tui-use press enter
tui-use wait --text ">>>"
tui-use kill
```

---

## Multiple Sessions

```bash
SID1=$(tui-use start htop --label monitor)
SID2=$(tui-use start python3)

tui-use use $SID1
tui-use wait --text "PID"
tui-use type "q"
tui-use kill

tui-use use $SID2
tui-use wait --text ">>>"
tui-use type "print(1+1)"
tui-use press enter
tui-use wait --text ">>>"
tui-use type "exit()"
tui-use press enter
tui-use kill
```
