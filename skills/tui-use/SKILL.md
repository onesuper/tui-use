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
tui-use start <cmd>                            # Start a program
tui-use start --cwd <dir> <cmd>                # Start in specific directory
tui-use start --label <name> <cmd>             # Start with label
tui-use start --cols <n> --rows <n> <cmd>      # Custom terminal size (default: 120x30)
tui-use use <session_id>                       # Switch to a session
tui-use type <text>                            # Type text
tui-use type "<text>\n"                        # Type with Enter
tui-use type "<text>\t"                        # Type with Tab
tui-use paste "<text>\n<text>\n"               # Multi-line paste (each line + Enter)
tui-use press <key>                            # Press a key
tui-use snapshot                               # Get current screen
tui-use snapshot --format json                 # JSON output
tui-use scrollup <n>                           # Scroll up to older content
tui-use scrolldown <n>                         # Scroll down to newer content
tui-use find <pattern>                         # Search in screen (regex)
tui-use wait                                   # Wait for screen change
tui-use wait <ms>                              # Custom timeout (default: 3000ms)
tui-use wait --text <pattern>                  # Wait until screen contains pattern
tui-use wait --format json                     # JSON output
tui-use list                                   # List all sessions
tui-use info                                   # Show session details
tui-use rename <label>                         # Rename session
tui-use kill                                   # Kill current session
```

### Daemon Commands

```
tui-use daemon status                          # Check if daemon is running
tui-use daemon stop                            # Stop the daemon
tui-use daemon restart                         # Restart the daemon
```

---

#### Waiting

`wait` is the primary way to observe the terminal state. It blocks until the screen changes or a timeout occurs.

**Always call `wait` before type/press** — ensures program is ready.

Default output (pretty format):
```
─── session-id ────────────────────────────────────────────
What is your name?
> Alice
─── running | cursor(2,8) | fullscreen:false | title:"" ────
highlights(0):
```

JSON output (`--format json`):
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
