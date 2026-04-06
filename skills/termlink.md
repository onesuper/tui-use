# termlink — Interactive CLI Bridge

Use `termlink` to operate interactive terminal programs that require keyboard input.
This lets you drive prompts, REPLs, interactive installers, and TUI programs.

## Core Workflow

```
start → read (wait for prompt) → send → read → send → ... → kill
```

## Commands

### Start a session
```bash
SID=$(termlink start "python myapp.py")
# SID is now e.g. "abc12345"
```

Options:
- `--cwd <dir>` — working directory
- `--label <name>` — human-readable label

### Read output
```bash
termlink read $SID --wait-for "pattern"
```

Returns JSON:
```json
{
  "session_id": "abc12345",
  "output": "Welcome!\nEnter your name: ",
  "status": "running",
  "exit_code": null
}
```

**Always use `--wait-for` before sending input** — wait until the prompt appears:
```bash
termlink read $SID --wait-for "Enter your name"
```

`--timeout <ms>` — max wait time (default 1500ms).

### Send input
```bash
termlink send $SID "Alice\n"
```

- Use `\n` for Enter key
- Use `\t` for Tab
- Use `\r` for carriage return (some programs need this instead of `\n`)

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

1. **Always read before sending** — use `--wait-for` to ensure the program is waiting for input
2. **Check `status`** — if `"exited"`, do not send more input; read remaining output instead
3. **One interaction at a time** — send input, then read response before sending again
4. **Use `\n` for Enter** — literal newline in the `send` argument
5. **Kill when done** — always clean up sessions

---

## Example: Interactive Python script

```bash
# Script prompts: "Enter your name: " then "Enter your age: "
SID=$(termlink start "python ask_user.py")

# Wait for first prompt
termlink read $SID --wait-for "Enter your name"

# Send name
termlink send $SID "Alice\n"

# Wait for second prompt
termlink read $SID --wait-for "Enter your age"

# Send age
termlink send $SID "30\n"

# Read final output
termlink read $SID --timeout 2000

# Clean up
termlink kill $SID
```

---

## Example: Python REPL

```bash
SID=$(termlink start "python3")

# Wait for >>> prompt
termlink read $SID --wait-for ">>>"

# Send a statement
termlink send $SID "x = 42\n"
termlink read $SID --wait-for ">>>"

termlink send $SID "print(x * 2)\n"
termlink read $SID --wait-for ">>>"
# output will contain "84"

termlink send $SID "exit()\n"
termlink read $SID --timeout 1000

termlink kill $SID
```

---

## Example: Bash interactive script

```bash
SID=$(termlink start "bash setup.sh")

termlink read $SID --wait-for "Install\? \[y/n\]"
termlink send $SID "y\n"

termlink read $SID --wait-for "Enter install path"
termlink send $SID "/usr/local\n"

termlink read $SID --timeout 5000
termlink kill $SID
```
