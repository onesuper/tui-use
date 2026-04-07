<div align="center">

# tui-use

**Like BrowserUse, but for the terminal.**

tui-use gives agents access to the parts of the terminal that bash can't reach — every REPL, installer, and TUI app built for humans.

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Node](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)

</div>

## What is tui-use?

AI agents can run shell commands, read files, and call APIs. But they stall the moment a program asks for input — because most CLI tools were built for humans, not agents.

tui-use fills that gap. Spawn any program in a PTY, observe its screen as plain text, send keystrokes — all from the command line. If a human can operate it in a terminal, an agent can too.

**Use cases:**

- **REPL sessions** — Run code in Python, Node, psql, or redis-cli, inspect the output, and keep going. No more one-shot scripts when you need an interactive session.
- **Interactive scaffolding tools** — Step through `npm create`, `cargo new`, `create-react-app`, and any other CLI wizard that asks questions before doing anything.
- **Database CLIs** — Connect to psql or mysql, run queries, check schemas, without needing a separate API or ORM layer.
- **SSH + remote interactive programs** — SSH into a server and keep operating interactive programs on the other end, not just run one-off commands.
- **TUI applications** — Navigate vim, lazygit, htop, fzf, and other full-screen programs that were never designed to be scripted.

Perfect for **Claude Code**, **Cursor**, **Codex**, **Gemini CLI**, **OpenCode** and other AI coding agents.

## Features

- **🖥️ Full VT Rendering** — PTY output is processed by a headless xterm emulator. ANSI escape sequences, cursor movement, and screen clearing all work correctly. The `screen` field is always clean plain text.
- **📸 Snapshot Model** — Interacting with a terminal program is just a loop: read what's on screen, decide what to type, repeat. tui-use makes that loop explicit — no async streams, no timing guesswork, no partial output to reassemble.
- **🔍 Highlights** — Every snapshot includes a `highlights` field listing the inverse-video spans on screen — the standard way TUI programs indicate selected items. Agents can read which menu option, tab, or button is currently active without parsing text or guessing from cursor position.
- **⌨️ Rich Key Support** — Send text, Enter, Ctrl+C, arrow keys, F-keys, and more. Run `tui-use keys` to see the full list.
- **🔌 Daemon Architecture** — A background daemon owns all PTY sessions and auto-exits after 5 minutes of inactivity. No manual process management.

## Installation

### Claude Code

**Option 1: Install from official marketplace (recommended)**

In Claude Code, run:
```
/plugin install tui-use
```

**Option 2: Install from self-hosted marketplace**

In Claude Code, register the marketplace first:
```
/plugin marketplace add onesuper/tui-use
```
Then install the plugin from this marketplace:
```
/plugin install tui-use@tui-use
```

**Option 3: Manual installation**

Copy the skill file to your Claude Code skills directory:
```bash
git clone https://github.com/onesuper/tui-use.git
cd tui-use
npm install
npm run build
npm link
cp skills/tui-use.md ~/.claude/skills/
```

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

## CLI Interface

| Command                     | Description                                                |
| --------------------------- | ---------------------------------------------------------- |
| `tui-use start <cmd>`       | Start program in PTY, returns `session_id`                 |
| `tui-use wait <id>`         | Wait for screen to change, return snapshot                 |
| `tui-use screen <id>`       | Return current screen immediately                          |
| `tui-use type <id> <input>` | Send text or a special key                                 |
| `tui-use keys`              | List all supported special key names (e.g. `escape`/`tab`) |
| `tui-use list`              | List active sessions                                       |
| `tui-use kill <id>`         | Terminate session                                          |

## Limitations

- **TUI color/style info is mostly lost** — `screen` contains plain text only; colors and most formatting are stripped. Selected items and active elements are captured in the `highlights` field via inverse-video detection.
- **Windows not supported** — requires Unix PTY (macOS/Linux). Windows support via ConPTY is planned.

## Development

```bash
git clone <repo_url>
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

### Integration Tests

A Claude Code skill is included for running the full integration test suite.

Run the following command in Claude Code:

```
/tui-use-integration-test
```

Claude will execute all five test cases in order and report `PASS / FAIL` for each, with actual screen output on any failure.

## License

[MIT License](LICENSE)
