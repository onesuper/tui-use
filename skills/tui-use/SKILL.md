---
name: tui-use
description: Operate interactive terminal programs (REPLs, installers, TUI apps) using PTY automation. Use when you need to interact with programs that require keyboard input.
---

# tui-use — TUI Automation for AI Agents

Use `tui-use` to operate interactive terminal programs that require keyboard input.
Works with prompt-based CLIs, REPLs, interactive installers, and TUI apps (htop, vim, fzf, etc.).

## Core Workflow

```
start → use → wait → type/press → wait → ... → kill
```

**Always call `use` first** to set the current session, then all other commands work on that session.

## Commands

### Core Commands

```
tui-use start <cmd>      # Start program, returns session_id (becomes current)
tui-use use <id>         # Set current session
tui-use wait [ms]        # Wait for screen to change (default: 3000ms)
tui-use type <text>      # Type text (\n for Enter, \t for Tab)
tui-use press <key>      # Press key (ctrl+c, arrow_up, enter, etc.)
tui-use snapshot         # Get current screen immediately
tui-use kill             # Kill current session
tui-use list             # List all sessions
```

#### Start a session

```bash
tui-use start python3 myapp.py
tui-use start -- python3 -c 'name=input("Name: "); print("Hi", name)'
tui-use start htop
```

Returns `session_id` and automatically sets it as **current session**.

Options: `--cwd <dir>`, `--label <name>`, `--cols <n>`, `--rows <n>`

---

#### Waiting

`wait` is the primary way to observe the terminal state. It blocks until the screen changes or a timeout occurs.

```bash
tui-use wait              # wait for screen to change (default 3000ms)
tui-use wait 5000         # wait up to 5000ms
tui-use wait --text ">>>" # wait until screen contains pattern (regex supported)
```

Returns JSON with screen content:
```json
{
  "session_id": "abc12345",
  "screen": "What is your name?\n> ",
  "cursor": { "x": 2, "y": 1 },
  "changed": true,
  "status": "running",
  "exit_code": null
}
```

**Always call `wait` before type/press** — ensures program is ready.

---

#### Type text

```bash
tui-use type "hello world"
tui-use type "hello\n"         # with Enter
```

Escapes: `\n` = Enter, `\t` = Tab

---

#### Press key

```bash
tui-use press ctrl+c
tui-use press arrow_down
tui-use press enter
tui-use press q
```

Keys: `ctrl+c`, `ctrl+d`, `arrow_up/down/left/right`, `enter`, `escape`, `tab`, `f1-f10`, etc.

Full list: `tui-use keys`

---

### Daemon Management

The daemon auto-starts on first command and auto-exits after 5 minutes of inactivity. Usually you don't need to manage it manually.

```bash
tui-use daemon status    # check if daemon is running
tui-use daemon stop      # stop the daemon
tui-use daemon restart   # restart the daemon
```

---

## Rules

1. **use first** — always set current session before other commands
2. **wait before type/press** — confirms program is ready
3. **check status** — if `"exited"`, don't send more input
4. **kill when done** — clean up sessions

---

## Example

```bash
# Start (automatically becomes current session)
tui-use start python3 examples/ask.py

# Interact
tui-use wait                    # wait for prompt
tui-use type "Alice"
tui-use press enter
tui-use wait                    # wait for output
tui-use kill                    # cleanup
```

---

## Multiple Sessions

```bash
# Start two sessions
SID1=$(tui-use start htop --label monitor)
SID2=$(tui-use start python3)

# Work with first
tui-use use $SID1
tui-use wait --text "PID"
tui-use press q
tui-use kill

# Work with second
tui-use use $SID2
tui-use wait --text ">>>"
tui-use type "print(1+1)"
tui-use press enter
tui-use wait --text ">>>"
tui-use type "exit()"
tui-use press enter
tui-use kill
```
