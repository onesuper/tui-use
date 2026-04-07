---
name: tui-use
description: Operate interactive terminal programs (REPLs, installers, TUI apps) using PTY automation. Use when you need to interact with programs that require keyboard input.
---

# tui-use — TUI Automation for AI Agents

Use `tui-use` to operate interactive terminal programs that require keyboard input.
Works with prompt-based CLIs, REPLs, interactive installers, and TUI apps (htop, vim, fzf, etc.).

## Core Workflow

```
start → wait → send → wait → send → wait → ... → kill
```

Think of it like browser automation: `wait` is your screenshot, `send` is your click/type.

## Commands

### Start a session
```bash
SID=$(tui-use start python3 myapp.py)
SID=$(tui-use start -- python3 -c 'name=input("Name: "); print("Hi", name)')
SID=$(tui-use start htop)
```

Options: `--cwd <dir>`, `--label <name>`, `--cols <n>`, `--rows <n>`

---

### Wait for screen to change
```bash
tui-use wait $SID
```

Returns JSON with current screen content after the screen settles:
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

Options:
- `--until <pattern>` — wait until screen contains regex pattern
- `--timeout <ms>` — max wait time (default: 3000ms)

**Always call `wait` before sending input** — it ensures the program is ready.

---

### Take an immediate screen capture
```bash
tui-use screen $SID
```

Returns the current screen without waiting. Same JSON format as `wait`.
Use when you want to check the current state without blocking.

---

### Type input or send a key
```bash
tui-use type $SID "hello\n"        # text + Enter
tui-use type $SID "ctrl+c"         # interrupt
tui-use type $SID "arrow_down"     # navigate
tui-use type $SID "q"              # single key
```

**Supported special keys:**
`ctrl+c`, `ctrl+d`, `ctrl+z`, `ctrl+a/b/e/f/k/l/u/w`
`arrow_up`, `arrow_down`, `arrow_left`, `arrow_right`
`page_up`, `page_down`, `home`, `end`
`enter`, `tab`, `escape`, `backspace`, `delete`
`f1`–`f10`

To get the full up-to-date list: `tui-use keys`

**Text escapes:** `\n` = Enter, `\r` = carriage return, `\t` = Tab

---

### List sessions
```bash
tui-use list
```

### Kill a session
```bash
tui-use kill $SID
```

---

## Rules for AI Agents

1. **wait before send** — always call `wait` first to confirm the program is ready
2. **check `status`** — if `"exited"`, don't send more input
3. **use `--until`** for slow-starting programs — `tui-use wait $SID --until "pattern"`
4. **kill when done** — always clean up sessions

---

## Example: Prompt-based CLI

```bash
SID=$(tui-use start python3 examples/ask.py)

tui-use wait $SID                    # wait for first prompt
tui-use type $SID "Alice\n"
tui-use wait $SID                    # wait for next prompt
tui-use type $SID "30\n"
tui-use wait $SID                    # get final output
tui-use kill $SID
```

---

## Example: Python REPL

```bash
SID=$(tui-use start python3)

tui-use wait $SID --until ">>>"
tui-use type $SID "x = 42\n"
tui-use wait $SID --until ">>>"
tui-use type $SID "print(x * 2)\n"
tui-use wait $SID --until ">>>"
# screen will contain "84"

tui-use type $SID "exit()\n"
tui-use wait $SID
tui-use kill $SID
```

---

## Example: TUI app (htop)

```bash
SID=$(tui-use start htop --rows 40 --cols 200)

tui-use wait $SID --until "PID"     # wait for htop to fully load
tui-use screen $SID               # inspect current screen

tui-use type $SID "arrow_down"      # navigate
tui-use wait $SID

tui-use type $SID "q"               # quit
tui-use wait $SID
tui-use kill $SID
```

---

## Example: Interactive installer

```bash
SID=$(tui-use start bash install.sh)

tui-use wait $SID --until "Install\?"
tui-use type $SID "y\n"

tui-use wait $SID --until "install path"
tui-use type $SID "/usr/local\n"

tui-use wait $SID --timeout 10000   # installation may take a while
tui-use kill $SID
```
