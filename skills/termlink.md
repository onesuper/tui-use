# termlink — Interactive CLI Bridge for AI Agents

Use `termlink` to operate interactive terminal programs that require keyboard input.
Works with prompt-based CLIs, REPLs, interactive installers, and TUI apps (htop, vim, fzf, etc.).

## Core Workflow

```
start → wait → send → wait → send → wait → ... → kill
```

Think of it like browser automation: `wait` is your screenshot, `send` is your click/type.

## Commands

### Start a session
```bash
SID=$(termlink start python3 myapp.py)
SID=$(termlink start -- python3 -c 'name=input("Name: "); print("Hi", name)')
SID=$(termlink start htop)
```

Options: `--cwd <dir>`, `--label <name>`, `--cols <n>`, `--rows <n>`

---

### Wait for screen to change
```bash
termlink wait $SID
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

### Take an immediate snapshot
```bash
termlink snapshot $SID
```

Returns the current screen without waiting. Same JSON format as `wait`.
Use when you want to check the current state without blocking.

---

### Send input
```bash
termlink send $SID "hello\n"        # text + Enter
termlink send $SID "ctrl+c"         # interrupt
termlink send $SID "arrow_down"     # navigate
termlink send $SID "q"              # single key
```

**Supported special keys:**
`ctrl+c`, `ctrl+d`, `ctrl+z`, `ctrl+a/b/e/f/k/l/u/w`
`arrow_up`, `arrow_down`, `arrow_left`, `arrow_right`
`page_up`, `page_down`, `home`, `end`
`enter`, `tab`, `escape`, `backspace`, `delete`
`f1`–`f10`

**Text escapes:** `\n` = Enter, `\r` = carriage return, `\t` = Tab

---

### List sessions
```bash
termlink list
```

### Kill a session
```bash
termlink kill $SID
```

---

## Rules for AI Agents

1. **wait before send** — always call `wait` first to confirm the program is ready
2. **check `status`** — if `"exited"`, don't send more input
3. **use `--until`** for slow-starting programs — `termlink wait $SID --until "pattern"`
4. **kill when done** — always clean up sessions

---

## Example: Prompt-based CLI

```bash
SID=$(termlink start python3 examples/ask.py)

termlink wait $SID                    # wait for first prompt
termlink send $SID "Alice\n"
termlink wait $SID                    # wait for next prompt
termlink send $SID "30\n"
termlink wait $SID                    # get final output
termlink kill $SID
```

---

## Example: Python REPL

```bash
SID=$(termlink start python3)

termlink wait $SID --until ">>>"
termlink send $SID "x = 42\n"
termlink wait $SID --until ">>>"
termlink send $SID "print(x * 2)\n"
termlink wait $SID --until ">>>"
# screen will contain "84"

termlink send $SID "exit()\n"
termlink wait $SID
termlink kill $SID
```

---

## Example: TUI app (htop)

```bash
SID=$(termlink start htop --rows 40 --cols 200)

termlink wait $SID --until "PID"     # wait for htop to fully load
termlink snapshot $SID               # inspect current screen

termlink send $SID "arrow_down"      # navigate
termlink wait $SID

termlink send $SID "q"               # quit
termlink wait $SID
termlink kill $SID
```

---

## Example: Interactive installer

```bash
SID=$(termlink start bash install.sh)

termlink wait $SID --until "Install\?"
termlink send $SID "y\n"

termlink wait $SID --until "install path"
termlink send $SID "/usr/local\n"

termlink wait $SID --timeout 10000   # installation may take a while
termlink kill $SID
```
