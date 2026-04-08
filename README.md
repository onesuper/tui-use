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
- **🏷️ Title Tracking** — Every snapshot includes a `title` field with the current window title set by the process via OSC sequences. Vim shows the filename, htop shows the process name — no screen parsing needed.
- **🖥️ Fullscreen Detection** — Every snapshot includes an `is_fullscreen` field that is `true` when the process is using the alternate buffer (vim, htop, lazygit, etc.), giving agents immediate context on the terminal mode.
- **⌨️ Rich Key Support** — Send text, Enter, Ctrl+C, arrow keys, F-keys, and more. Run `tui-use keys` to see the full list.
- **🔌 Daemon Architecture** — A background daemon owns all PTY sessions and auto-exits after 5 minutes of inactivity. No manual process management.

## Installation

**From npm (recommended):**

```bash
npm install -g tui-use
```

**From source:**

```bash
git clone https://github.com/onesuper/tui-use.git
cd tui-use
npm install
npm run build
npm link
```

## Claude Code Plugin

**Note:** You must install the CLI (see Installation section above) before using the plugin — the plugin only provides skill definitions, the CLI provides the actual PTY functionality.

### Install from self-hosted marketplace

#### Step 1: Add the marketplace

```
/plugin marketplace add onesuper/tui-use
```

#### Step 2: Install the plugin

```
/plugin install tui-use@tui-use
```

#### Step 3: Reload plugins

```
/reload-plugins
```

**More agents coming soon...**

## How It Works

Behind the scenes, tui-use runs a daemon that manages PTY sessions:

```
┌─────────────┐     HTTP      ┌─────────────┐     PTY      ┌─────────────┐
│  tui-use    │ ◄───────────► │   Daemon    │ ◄─────────►  │   Program   │
│   (CLI)     │               │ (background)│              │  (vim/htop) │
└─────────────┘               └─────────────┘              └─────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │  @xterm/    │
                              │  headless   │
                              │ (xterm emu) │
                              └─────────────┘
```

**The rendering pipeline:**

1. Target program outputs ANSI escape sequences (colors, cursor moves, screen clears)
2. `@xterm/headless` renders them into a complete terminal screen state
3. `snapshot` returns clean plain text `screen` content, plus metadata like `highlights` (inverse-video regions), `title` (window title), and `is_fullscreen` (alternate buffer detection)

Agents get the a "polaroid" snapshot of the terminal — not a raw byte stream you need to reassemble.

## CLI Interface

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
tui-use use <session_id>                       # Switch to a session
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

## Limitations

- **TUI color/style info is mostly lost** — `screen` contains plain text only; colors and most formatting are stripped. Selected items and active elements are captured in `highlights` via inverse-video detection. Window title and fullscreen mode are captured in `title` and `is_fullscreen`.
- **Windows not supported** — requires Unix PTY (macOS/Linux). Windows support via ConPTY is planned.

## Development

```bash
git clone <repo_url>
cd tui-use
npm install
npm run build
npm link

# Try it
tui-use start python3 examples/ask.py
tui-use wait
tui-use type "Alice"
tui-use press enter
tui-use wait
tui-use kill
```

### Integration Tests

A Claude Code skill is included for running the full integration test suite.

Run the following command in Claude Code:

```
/tui-use-integration-test
```

Claude will execute the test suite in order and then report `PASS / FAIL` for each, with actual screen output on any failure.

## License

[MIT License](LICENSE)
