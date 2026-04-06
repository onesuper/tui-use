<div align="center">

# termlink

**Give your AI agent hands in the terminal.**

Interactive CLI bridge for AI coding agents — drive any program that requires keyboard input.

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)

</div>

## What is termlink?

AI coding assistants can read and write files, run shell commands, and parse output. But they hit a wall the moment a program asks for input:

- ✅ Run non-interactive commands (`npm install`, `git commit`, etc.)
- ✅ Read and parse terminal output
- ✅ Operate on files and APIs

But they cannot:

- ❌ Respond to interactive prompts (`Are you sure? [y/n]`)
- ❌ Drive REPLs (Python, Node, psql, redis-cli)
- ❌ Navigate TUI apps (htop, fzf, vim, lazygit)
- ❌ Step through interactive installers

**termlink solves this by giving AI agents hands in the terminal.**

Spawn any program in a PTY, observe its screen as rendered plain text, and send keystrokes — all from the command line. Language agnostic. Works with any interactive program.

Perfect for enhancing **Claude Code**, **Cursor**, **Continue**, and other AI coding workflows.

## Features

- **🖥️ Full VT Rendering** — PTY output is processed by a headless xterm emulator. ANSI escape sequences, cursor movement, and screen clearing all work correctly. The `screen` field is always clean plain text.
- **📸 Snapshot Model** — Inspired by browser automation: `wait` is your screenshot, `type` is your action. No polling, no raw byte streams.
- **⌨️ Rich Key Support** — Send text, Enter, Ctrl+C, arrow keys, F-keys, and more. Run `termlink keys` to see the full list.
- **🔌 Daemon Architecture** — A background daemon owns all PTY sessions and auto-exits after 5 minutes of inactivity. No manual process management.
- **🤖 AI-Friendly** — Structured JSON output. Includes a ready-to-use Claude Code skill file.

## Quick Start

```bash
# Install
git clone https://github.com/your-repo/termlink.git
cd termlink && npm install && npm run build && npm link

# Start a program
SID=$(termlink start python3 examples/ask.py)

# Drive it
termlink wait $SID                    # get first prompt
termlink type $SID "Alice\n"
termlink wait $SID                    # get next prompt
termlink type $SID "30\n"
termlink wait $SID                    # get final output
termlink kill $SID
```

### Example Output

`termlink wait $SID` returns:

```json
{
  "session_id": "misty-xerus",
  "screen": "What is your name?\n> ",
  "cursor": { "x": 2, "y": 1 },
  "changed": true,
  "status": "running",
  "exit_code": null
}
```

Your AI agent now sees exactly what the terminal shows — and knows the program is waiting for input at cursor position `(2, 1)`.

## Installation

```bash
git clone https://github.com/your-repo/termlink.git
cd termlink
npm install
npm run build
npm link   # makes `termlink` available globally
```

## Usage

### Basic: drive a prompt-based CLI

```bash
SID=$(termlink start python3 examples/ask.py)

termlink wait $SID
termlink type $SID "Alice\n"
termlink wait $SID
termlink type $SID "30\n"
termlink wait $SID
termlink kill $SID
```

### REPL: interact with Python

```bash
SID=$(termlink start python3)

termlink wait $SID --until ">>>"
termlink type $SID "x = 42\n"
termlink wait $SID --until ">>>"
termlink type $SID "print(x * 2)\n"
termlink wait $SID --until ">>>"
# screen contains "84"

termlink type $SID "exit()\n"
termlink kill $SID
```

### TUI: navigate htop

```bash
SID=$(termlink start htop --rows 40 --cols 200)

termlink wait $SID --until "PID"     # wait for htop to fully load
termlink screen $SID                 # inspect current screen

termlink type $SID "arrow_down"      # navigate
termlink wait $SID

termlink type $SID "q"               # quit
termlink kill $SID
```

### Interactive installer

```bash
SID=$(termlink start bash install.sh)

termlink wait $SID --until "Install\?"
termlink type $SID "y\n"

termlink wait $SID --until "install path"
termlink type $SID "/usr/local\n"

termlink wait $SID --timeout 10000   # installation may take a while
termlink kill $SID
```

## Commands

| Command | Description |
|---------|-------------|
| `termlink start <cmd>` | Start program in PTY, returns `session_id` |
| `termlink wait <id>` | Wait for screen to change, return snapshot |
| `termlink screen <id>` | Return current screen immediately |
| `termlink type <id> <input>` | Send text or a special key |
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

`termlink wait` and `termlink screen` return JSON:

```json
{
  "session_id": "misty-xerus",
  "screen": "What is your name?\n> ",
  "cursor": { "x": 2, "y": 1 },
  "changed": true,
  "status": "running",
  "exit_code": null
}
```

- `screen` — rendered plain text; trailing spaces and empty lines removed
- `cursor` — current cursor position in the terminal grid
- `changed` — whether screen changed since last `wait`/`screen`
- `status` — `"running"` or `"exited"`
- `exit_code` — process exit code, or `null` if still running

## For AI Agents

Copy `skills/termlink.md` to your Claude Code skills directory:

```bash
cp skills/termlink.md ~/.claude/skills/
```

Claude Code will then know how to use termlink to operate interactive programs.

## How It Works

```
termlink start "python3 app.py"
      │
      └── Sends request to local daemon (auto-starts if needed)
              │
              ├── Daemon spawns command in a PTY (node-pty)
              ├── PTY output fed into @xterm/headless VT renderer
              └── Returns session_id

termlink wait <id>
      │
      └── Waits for screen to settle, renders buffer to plain text, returns JSON

termlink type <id> "input\n"
      │
      └── Translates text/key name → bytes, writes to PTY stdin
```

The **daemon** runs in the background (`~/.termlink/daemon.sock`), owns all PTY sessions, and auto-exits after 5 minutes of inactivity.

PTY output is rendered by **`@xterm/headless`** — a full VT100/xterm emulator. This means ANSI colors, cursor movement, and screen clearing all work correctly. The `screen` field in responses is always clean plain text.

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

## Limitations

- **TUI color/style info is lost** — `screen` contains plain text only; colors and formatting are stripped. The content is readable but not visually identical to the terminal.
- **Windows not supported** — requires Unix PTY (macOS/Linux). Windows support via ConPTY is planned.

## Requirements

- Node.js 18+
- macOS / Linux

## Development

```bash
git clone https://github.com/your-repo/termlink.git
cd termlink
npm install
npm run build
npm link

# Try it
SID=$(termlink start python3 examples/ask.py)
termlink wait $SID
termlink type $SID "Alice\n"
termlink wait $SID
termlink kill $SID
```

## License

[MIT License](LICENSE)
