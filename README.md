# termlink

**Interactive CLI bridge for AI coding agents.**

Drive any interactive terminal program programmatically — prompts, REPLs, TUI apps, interactive installers. Language agnostic.

```bash
# Start an interactive program
SID=$(termlink start "python myapp.py")

# Wait for prompt, then send input
termlink read $SID --wait-for "Enter your name"
termlink send $SID "Alice\n"

# Read response
termlink read $SID --timeout 2000

# Clean up
termlink kill $SID
```

## Installation

```bash
git clone https://github.com/your-repo/termlink.git
cd termlink
npm install
npm run build
npm link   # makes `termlink` available globally
```

## How It Works

```
termlink start "gunicorn app:app"
      │
      └── Sends request to local daemon (auto-starts if needed)
              │
              ├── Daemon spawns command in a PTY (via node-pty)
              ├── Buffers all output in memory
              └── Returns session_id

termlink read <id> --wait-for "pattern"
      │
      └── Daemon returns buffered output (waits until pattern matches or timeout)

termlink send <id> "input\n"
      │
      └── Daemon writes to PTY stdin
```

The **daemon** runs in the background (`~/.termlink/daemon.sock`), owns all PTY sessions, and auto-exits after 5 minutes of inactivity.

## Commands

| Command | Description |
|---------|-------------|
| `termlink start <cmd>` | Start program in PTY, returns `session_id` |
| `termlink send <id> <input>` | Send input (`\n` = Enter, `\t` = Tab) |
| `termlink read <id>` | Read buffered output as JSON |
| `termlink list` | List active sessions |
| `termlink kill <id>` | Terminate session |

### `termlink read` options

- `--timeout <ms>` — max wait time (default: 1500ms)
- `--wait-for <pattern>` — block until output matches regex

### `termlink start` options

- `--cwd <dir>` — working directory
- `--label <name>` — human-readable label
- `--cols <n>` — terminal width (default: 120)
- `--rows <n>` — terminal height (default: 30)

## Output Format

All commands output JSON. Errors go to stderr with non-zero exit code.

`termlink read` output:
```json
{
  "session_id": "abc12345",
  "output": "Welcome!\nEnter your name: ",
  "status": "running",
  "exit_code": null
}
```

## For AI Agents

Copy `skills/termlink.md` to your Claude Code skills directory:

```bash
cp skills/termlink.md ~/.claude/skills/
```

Claude Code will then know how to use `termlink` to operate interactive programs.

## Architecture

```
~/.termlink/
  daemon.sock   # Unix socket
  daemon.pid    # PID file

src/
  cli.ts        # Entry point, Commander-based CLI
  daemon.ts     # Background process, PTY session manager
  client.ts     # Auto-starts daemon, sends IPC requests
  session.ts    # node-pty wrapper + output buffer
  protocol.ts   # IPC message types
```

## Requirements

- Node.js 18+
- macOS / Linux (Windows support planned via ConPTY)

## License

MIT
