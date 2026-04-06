<div align="center">

# tui-use

**Like BrowserUse, but for the terminal.**

TUI automation for AI agents — drive any program that requires keyboard input.

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)

</div>

## What is tui-use?

AI coding assistants can read and write files, run shell commands, and parse output. But they hit a wall the moment a program asks for input:

- ✅ Run non-interactive commands (`npm install`, `git commit`, etc.)
- ✅ Read and parse terminal output
- ✅ Operate on files and APIs

But they cannot:

- ❌ Respond to interactive prompts (`Are you sure? [y/n]`)
- ❌ Drive REPLs (Python, Node, psql, redis-cli)
- ❌ Navigate TUI apps (htop, fzf, vim, lazygit)
- ❌ Step through interactive installers

**tui-use solves this by giving AI agents hands in the terminal.**

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
git clone https://github.com/your-repo/tui-use.git
cd tui-use && npm install && npm run build && npm link

# Start a program
SID=$(tui-use start python3 examples/ask.py)

# Drive it
tui-use wait $SID                    # get first prompt
tui-use type $SID "Alice\n"
tui-use wait $SID                    # get next prompt
tui-use type $SID "30\n"
tui-use wait $SID                    # get final output
tui-use kill $SID
```

### Example Output

`tui-use wait $SID` returns:

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
git clone https://github.com/your-repo/tui-use.git
cd tui-use
npm install
npm run build
npm link   # makes `tui-use` available globally
```

## Agent Setup

### Claude Code

Copy the skill file to your Claude Code skills directory:

```bash
cp skills/tui-use.md ~/.claude/skills/
```

Claude Code will automatically know how to use `tui-use` to operate interactive programs.

### Other agents

- **Cursor** — coming soon
- **Copilot CLI** — coming soon
- **Gemini CLI** — coming soon

## Usage

### Basic: drive a prompt-based CLI

```bash
SID=$(tui-use start python3 examples/ask.py)

tui-use wait $SID
tui-use type $SID "Alice\n"
tui-use wait $SID
tui-use type $SID "30\n"
tui-use wait $SID
tui-use kill $SID
```

### REPL: interact with Python

```bash
SID=$(tui-use start python3)

tui-use wait $SID --until ">>>"
tui-use type $SID "x = 42\n"
tui-use wait $SID --until ">>>"
tui-use type $SID "print(x * 2)\n"
tui-use wait $SID --until ">>>"
# screen contains "84"

tui-use type $SID "exit()\n"
tui-use kill $SID
```

### TUI: navigate htop

```bash
SID=$(tui-use start htop --rows 40 --cols 200)

tui-use wait $SID --until "PID"     # wait for htop to fully load
tui-use screen $SID                 # inspect current screen

tui-use type $SID "arrow_down"      # navigate
tui-use wait $SID

tui-use type $SID "q"               # quit
tui-use kill $SID
```

### Interactive installer

```bash
SID=$(tui-use start bash install.sh)

tui-use wait $SID --until "Install\?"
tui-use type $SID "y\n"

tui-use wait $SID --until "install path"
tui-use type $SID "/usr/local\n"

tui-use wait $SID --timeout 10000   # installation may take a while
tui-use kill $SID
```

## Commands

| Command | Description |
|---------|-------------|
| `tui-use start <cmd>` | Start program in PTY, returns `session_id` |
| `tui-use wait <id>` | Wait for screen to change, return snapshot |
| `tui-use screen <id>` | Return current screen immediately |
| `tui-use type <id> <input>` | Send text or a special key |
| `tui-use keys` | List all supported special key names |
| `tui-use list` | List active sessions |
| `tui-use kill <id>` | Terminate session |

### `tui-use wait` options

- `--until <pattern>` — wait until screen contains regex pattern
- `--timeout <ms>` — max wait time (default: 3000ms)

### `tui-use start` options

- `--cwd <dir>` — working directory
- `--label <name>` — human-readable label
- `--cols <n>` — terminal width (default: 120)
- `--rows <n>` — terminal height (default: 30)

### Special keys for `tui-use type`

`ctrl+c`, `ctrl+d`, `ctrl+z`, `ctrl+a/b/e/f/k/l/u/w`
`arrow_up`, `arrow_down`, `arrow_left`, `arrow_right`
`page_up`, `page_down`, `home`, `end`
`enter`, `tab`, `escape`, `backspace`, `delete`, `f1`–`f10`

Run `tui-use keys` for the full up-to-date list.

## Output Format

`tui-use wait` and `tui-use screen` return JSON:

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

## How It Works

```
tui-use start "python3 app.py"
      │
      └── Sends request to local daemon (auto-starts if needed)
              │
              ├── Daemon spawns command in a PTY (node-pty)
              ├── PTY output fed into @xterm/headless VT renderer
              └── Returns session_id

tui-use wait <id>
      │
      └── Waits for screen to settle, renders buffer to plain text, returns JSON

tui-use type <id> "input\n"
      │
      └── Translates text/key name → bytes, writes to PTY stdin
```

The **daemon** runs in the background (`~/.tui-use/daemon.sock`), owns all PTY sessions, and auto-exits after 5 minutes of inactivity.

PTY output is rendered by **`@xterm/headless`** — a full VT100/xterm emulator. This means ANSI colors, cursor movement, and screen clearing all work correctly. The `screen` field in responses is always clean plain text.

## Limitations

- **TUI color/style info is lost** — `screen` contains plain text only; colors and formatting are stripped. The content is readable but not visually identical to the terminal.
- **Windows not supported** — requires Unix PTY (macOS/Linux). Windows support via ConPTY is planned.

## Requirements

- Node.js 18+
- macOS / Linux

## Development

```bash
git clone https://github.com/your-repo/tui-use.git
cd tui-use
npm install
npm run build
npm link

# Try it
SID=$(tui-use start python3 examples/ask.py)
tui-use wait $SID
tui-use type $SID "Alice\n"
tui-use wait $SID
tui-use kill $SID
```

## License

[MIT License](LICENSE)
