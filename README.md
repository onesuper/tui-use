<div align="center">

# tui-use

**Like BrowserUse, but for the terminal.**

tui-use lets agents interact with programs that expect a human at the keyboard — REPLs, debuggers, TUI apps, and anything else bash can't reach.

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![npm](https://img.shields.io/npm/v/tui-use.svg)](https://www.npmjs.com/package/tui-use)

</div>

## What is tui-use?

AI agents can run shell commands and call APIs — but they can't interact with programs that expect a human at the keyboard. The moment a REPL waits for input, a debugger hits a breakpoint, or a TUI app renders a menu, agents are stuck.

tui-use fills that gap. Spawn any program in a PTY, read its screen as plain text, send keystrokes — all from the command line. Built for the cases where bash isn't enough: live debugging sessions with gigabytes of in-memory state, interactive REPLs, full-screen TUI apps.

### Use cases

- **Scientific computing & large in-memory state** — When your variables are arrays with millions of elements that took an hour to compute, you can't dump them to a log file. Drop an agent into a live Python interpreter or pdb session to debug, inspect, and optimize without losing the running process.
- **Debugger sessions** — Drive GDB, PDB, or any interactive debugger. Set breakpoints, step through code, inspect variables — all from an agent, without restarting the process.
- **REPL sessions** — Run code in Python, Node, or any interactive interpreter, inspect the output, and keep going. No more one-shot scripts when you need an interactive session.
- **TUI applications** — Navigate vim, lazygit, htop, fzf, and other full-screen programs that were never designed to be scripted.

Perfect for **Claude Code**, **Cursor**, **Codex**, **Gemini CLI**, **OpenCode** and other AI coding agents.

### Why not tmux?

tmux is great for humans — but it was never designed for agents.

`tmux send-keys` has no way to signal when a program is done responding. Agents are stuck guessing: `sleep 2` and hope, or poll `capture-pane` in a loop.

tui-use observes every PTY render event directly. `wait` blocks until the screen stabilizes — no sleep, no polling. `wait --text ">>>"` goes further: wait for a semantic signal, not just silence.

## Features

- **🖥️ Full VT Rendering** — PTY output is processed by a headless xterm emulator. ANSI escape sequences, cursor movement, and screen clearing all work correctly. The `screen` field is always clean plain text.
- **⏱️ Smart Wait** — `wait` blocks until the screen has been stable for a configurable idle window (debounce), so agents never need to guess how long to sleep. Use `wait --text <pattern>` for semantic signals — wait until the program tells you it's ready, not just until it goes quiet.
- **📸 Snapshot Model** — Interacting with a terminal program is just a loop: read what's on screen, decide what to type, repeat. tui-use makes that loop explicit — no async streams, no timing guesswork, no partial output to reassemble.
- **🔍 Highlights** — Every snapshot includes a `highlights` field listing the inverse-video spans on screen — the standard way TUI programs indicate selected items. Agents can read which menu option, tab, or button is currently active without parsing text or guessing from cursor position.

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

## OpenAI Codex Plugin

**Note:** You must install the CLI (see Installation section above) before using the plugin — the plugin only provides skill definitions, the CLI provides the actual PTY functionality.

This repo includes a Codex plugin bundle at `plugins/tui-use` and a local repo marketplace at `.agents/plugins/marketplace.json`.

### Install from this repo

#### Step 1: Open this repository in Codex

Start Codex with this repository as the working directory, or restart Codex if it was already open while you cloned or updated the repo.

#### Step 2: Open the plugin directory

```
codex
/plugins
```

#### Step 3: Install the plugin

Choose the `tui-use local plugins` marketplace, open `tui-use`, and select `Install plugin`.

#### Step 4: Start a new thread

Ask Codex to use `tui-use`, or explicitly invoke the installed plugin/skill from the prompt.

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

tui-use sits directly on the PTY event stream — every byte the program outputs flows through a headless terminal emulator in real time.

This is what makes `wait` possible:

```
program outputs → PTY → xterm emulator → render event
                                        → debounce timer resets on each change
                                        → 100ms of silence → wait resolves ✓
```

`wait --text <pattern>` goes further — it resolves the moment a known prompt appears, giving agents a semantic readiness signal rather than just a silence window.

Behind the scenes, a daemon process manages PTY sessions so they persist across CLI calls.

## CLI Interface

### Core Commands

```
tui-use start <cmd>                            # Start a program
tui-use start --cwd <dir> <cmd>                # Start in specific directory
tui-use start --cwd <dir> "<cmd> -flags"       # Quote the full command to pass flags (e.g. git rebase -i)
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
tui-use wait                                   # Wait for screen change (default timeout: 3000ms)
tui-use wait <ms>                              # Custom timeout, e.g. wait 5000
tui-use wait --text <pattern>                  # Wait until screen contains pattern
tui-use wait --debounce <ms>                   # Idle time after last change before resolving (default: 100ms)
tui-use wait --format json                     # JSON output
tui-use list                                   # List all sessions
tui-use use <session_id>                       # Switch to a session
tui-use info                                   # Show session details
tui-use rename <label>                         # Rename session
tui-use kill                                   # Kill current session
tui-use daemon status                          # Check if daemon is running
tui-use daemon stop                            # Stop the daemon
tui-use daemon restart                         # Restart the daemon
```

## Limitations

- **TUI color/style info is mostly lost** — `screen` contains plain text only; colors and most formatting are stripped. Selected items and active elements are captured in `highlights` via inverse-video detection. Window title and fullscreen mode are captured in `title` and `is_fullscreen`.

## Troubleshooting

### Automatic Rebuild Fails

The installer automatically detects your platform and uses a prebuilt binary when available. If no compatible prebuild exists, it will automatically rebuild from source (requires build tools).

**Build tools** (only needed if automatic rebuild fails):

- macOS: `xcode-select --install`
- Linux: `sudo apt-get install build-essential python3 g++`
- Windows: Prebuilt binaries available (no build tools needed)

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
