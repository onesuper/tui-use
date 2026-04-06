# termlink

**Interactive CLI bridge for AI coding agents.**

Drive any interactive terminal program programmatically — prompt-based CLIs, REPLs, TUI apps (htop, fzf, vim), interactive installers. Language agnostic.

The interface mirrors browser automation: `wait` is your screenshot, `type` is your action.

```bash
SID=$(termlink start python3 ask.py)
termlink wait $SID                    # get first prompt
termlink type $SID "Alice\n"
termlink wait $SID                    # get response + next prompt
termlink type $SID "30\n"
termlink wait $SID                    # get final output
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
termlink start "python3 app.py"
      │
      └── Sends request to local daemon (auto-starts if needed)
              │
              ├── Daemon spawns command in a PTY (node-pty)
              ├── PTY output fed into xterm headless VT renderer
              └── Returns session_id

termlink wait <id>
      │
      └── Waits for screen to change, renders to plain text, returns JSON

termlink type <id> "input\n"
      │
      └── Writes to PTY stdin
```

The **daemon** runs in the background (`~/.termlink/daemon.sock`), owns all PTY sessions, and auto-exits after 5 minutes of inactivity.

PTY output is rendered by **`@xterm/headless`** — a full VT100/xterm emulator. This means ANSI colors, cursor movement, and screen clearing all work correctly. The `screen` field in responses is always clean plain text.

## Commands

| Command | Description |
|---------|-------------|
| `termlink start <cmd>` | Start program in PTY, returns `session_id` |
| `termlink wait <id>` | Wait for screen to change, return snapshot |
| `termlink snapshot <id>` | Return current screen immediately |
| `termlink type <id> <input>` | Send input or special key |
| `termlink keys` | List all supported special key names |
| `termlink list` | List active sessions |
| `termlink kill <id>` | Terminate session |

### `termlink wait` options

- `--until <pattern>` — wait until screen contains regex pattern
- `--timeout <ms>` — max wait time (default: 3000ms)

### `termlink start` options

- `--cwd <dir>` — working directory
- `--label <name>` — human-readable label
- `--cols <n>` — terminal width (default: 120)
- `--rows <n>` — terminal height (default: 30)

### Special keys for `termlink type`

`ctrl+c`, `ctrl+d`, `ctrl+z`, `ctrl+a/b/e/f/k/l/u/w`
`arrow_up`, `arrow_down`, `arrow_left`, `arrow_right`
`page_up`, `page_down`, `home`, `end`
`enter`, `tab`, `escape`, `backspace`, `delete`, `f1`–`f10`

Run `termlink keys` for the full up-to-date list.

## Output Format

`termlink wait` and `termlink snapshot` return JSON:

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

- `screen` — rendered plain text, trailing spaces and empty lines removed
- `cursor` — current cursor position in the terminal grid
- `changed` — whether screen changed since last `wait`/`snapshot`
- `status` — `"running"` or `"exited"`

## For AI Agents

Copy `skills/termlink.md` to your Claude Code skills directory:

```bash
cp skills/termlink.md ~/.claude/skills/
```

Claude Code will then know how to use termlink to operate interactive programs.

## Limitations

- **TUI color/style info is lost** — `screen` contains plain text only; colors and formatting are stripped. The content is readable but not visually identical to the terminal.
- **Windows not supported** — requires Unix PTY (macOS/Linux). Windows support via ConPTY is planned.

## Architecture

```
~/.termlink/
  daemon.sock   # Unix socket
  daemon.pid    # PID file

src/
  cli.ts        # Entry point, Commander-based CLI
  daemon.ts     # Background process, PTY session manager
  client.ts     # Auto-starts daemon, sends IPC requests
  session.ts    # node-pty + @xterm/headless VT renderer
  protocol.ts   # IPC message types
```

## Requirements

- Node.js 18+
- macOS / Linux

## License

MIT
