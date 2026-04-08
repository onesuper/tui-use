---
name: tui-use-integration-test
description: Use when you need to verify tui-use end-to-end behavior — driving interactive CLI programs, Python REPL, --text pattern matching, custom timeout, special key handling, and highlights detection.
---

# tui-use Integration Tests

Run all integration tests below in order. For each step, execute the command and verify the assertion. Report PASS or FAIL for each test case, and a summary at the end.

Before starting: kill any stale daemon.
```bash
tui-use daemon stop 2>/dev/null || true
```

---

## Test 1: Basic prompt CLI

**Goal:** Drive a simple prompt-based Python script end to end.

```bash
tui-use start python3 examples/ask.py
```

**Step 1.1** — Wait for first prompt:
```bash
tui-use wait
# Or with JSON output for programmatic assertions:
tui-use wait --format json | jq -r '.screen'
```
Assert: `screen` contains `"What is your name?"`

**Step 1.2** — Enter a name:
```bash
tui-use type "Alice"
tui-use press enter
tui-use wait --text "age"
```
Assert: `screen` contains `"Hello Alice!"` and `"What is your age?"`

**Step 1.3** — Enter age and get final output:
```bash
tui-use type "30"
tui-use press enter
tui-use wait
```
Assert: `screen` contains `"You are 30 years old!"`, `status` is `"exited"`, `exit_code` is `0`

```bash
tui-use kill
```

---

## Test 2: Python REPL

**Goal:** Interact with an interactive REPL, execute expressions, verify output.

```bash
tui-use start python3
tui-use wait --text ">>>"
```
Assert: `screen` contains `">>>"`

**Step 2.1** — Set a variable:
```bash
tui-use type "x = 42"
tui-use press enter
tui-use wait --text ">>>"
```
Assert: `screen` contains `">>>"`

**Step 2.2** — Evaluate expression:
```bash
tui-use type "print(x * 2)"
tui-use press enter
tui-use wait --text ">>>"
```
Assert: `screen` contains `"84"`

**Step 2.3** — Exit REPL:
```bash
tui-use type "exit()"
tui-use press enter
tui-use wait
```
Assert: `status` is `"exited"`

```bash
tui-use kill
```

---

## Test 3: --text pattern

**Goal:** Verify `--text` blocks until the pattern appears in the screen.

```bash
tui-use start python3 examples/ask.py
tui-use wait --text ">"
```
Assert: `screen` contains `"What is your name?"`, command did not time out

```bash
tui-use kill
```

---

## Test 4: Custom timeout

**Goal:** Verify custom timeout returns gracefully when screen doesn't change.

```bash
tui-use start sleep 10
tui-use wait 300
```
Assert: command returns within ~300ms, `changed` is `false`

```bash
tui-use kill
```

---

## Test 5: ctrl+c interrupts process

**Goal:** Verify special key `ctrl+c` sends interrupt signal.

```bash
tui-use start python3
tui-use wait --text ">>>"
tui-use press ctrl+c
tui-use wait 1000
```
Assert: `screen` contains `"KeyboardInterrupt"`

```bash
tui-use kill
```

---

## Test 6: Vertical menu highlights

**Goal:** Verify `highlights` correctly identifies the selected item in a vertical menu, and updates when selection changes.

```bash
tui-use start python3 examples/menu.py
tui-use wait --text "Option"
```
Assert: `highlights` contains exactly one entry with `text` = `"Option A"` (and fields `line`, `col_start`, `col_end`)

**Note:** Use `--format json` to inspect highlights: `tui-use wait --format json | jq '.highlights'`

**Step 6.1** — Move selection down:
```bash
tui-use press arrow_down
tui-use wait
```
Assert: `highlights` contains exactly one entry with `text` = `"Option B"` (and fields `line`, `col_start`, `col_end`)

```bash
tui-use kill
```

---

## Test 7: Inline tab bar highlights

**Goal:** Verify `highlights` detects an inline inverse span (partial line), and tracks it as selection moves across tabs.

```bash
tui-use start python3 examples/tabs.py
tui-use wait --text "Files"
```
Assert: `highlights` contains one entry with `text` = `"Files"` (and fields `line`, `col_start`, `col_end`)

**Step 7.1** — Move to next tab:
```bash
tui-use press arrow_right
tui-use wait
```
Assert: `highlights` contains one entry with `text` = `"Git"`, on the same `line` as before (with fields `col_start`, `col_end`)

```bash
tui-use kill
```

---

## Test 8: Dialog box highlights inside box-drawing border

**Goal:** Verify `highlights` correctly detects inline buttons inside a box-drawing border, and switches when selection changes.

```bash
tui-use start python3 examples/dialog.py
tui-use wait --text "Delete"
```
Assert: `highlights` contains one entry with `text` = `"Yes"` (and fields `line`, `col_start`, `col_end`)

**Step 8.1** — Switch to No:
```bash
tui-use press arrow_right
tui-use wait
```
Assert: `highlights` contains one entry with `text` = `"No"`, on the same `line` as before (with fields `col_start`, `col_end`)

```bash
tui-use kill
```

---

## Test 9: Advanced features (find, scroll, paste, info, rename)

**Goal:** Test advanced session manipulation features with a complex multi-step workflow using `cat` to display large text content.

```bash
tui-use start cat -n /usr/share/dict/words  # Large file with numbered lines
tui-use wait --text "1  "
```
Assert: `screen` contains line numbers and words (e.g., `"1  A"` or similar)

**Step 9.1** — Test `info` command to get session details:
```bash
tui-use info
```
Assert: Output contains `Session ID`, `Label`, `Command: cat`, `Status: running`, `Size: 120x30` (or configured size)

**Step 9.2** — Test `rename` to change session label:
```bash
tui-use rename "word-list-session"
tui-use list
```
Assert: `list` output shows `word-list-session` as the label for current session

**Step 9.3** — Test `find` to search for specific text on screen:
```bash
tui-use find "^[[:space:]]*1[[:space:]]"  # Find line starting with "1"
```
Assert: Returns at least one match with fields `line`, `col_start`, `col_end`, `text`

**Step 9.4** — Test `find` with regex for lines starting with numbers:
```bash
tui-use find "^[[:space:]]*[0-9]+[[:space:]]+A"
```
Assert: Returns match(es) where `text` contains a word starting with "A"

**Step 9.5** — Test `scroll` to view more content (simulate scrolling down):
```bash
tui-use scroll 10
tui-use snapshot
```
Assert: Screen content has changed (shows different lines than before)

**Step 9.6** — Test `find` again after scrolling to find new content:
```bash
tui-use find "^[[:space:]]*[0-9]+[[:space:]]+B"
```
Assert: Returns match(es) where `text` contains a word starting with "B"

**Step 9.7** — Test `paste` with multi-line input (switch to a Python session):
```bash
tui-use kill
tui-use start python3
tui-use wait --text ">>>"
tui-use paste "x = 1
y = 2
print(x + y)"
tui-use wait --text ">>>"
```
Assert: `screen` contains `"1"`, `"2"`, and `"3"` (output of print)

**Step 9.8** — Verify `find` works in Python REPL:
```bash
tui-use find "print"
```
Assert: Returns match with `text` containing `"print"`

**Step 9.9** — Clean up:
```bash
tui-use type "exit()"
tui-use press enter
tui-use wait
tui-use kill
```
Assert: Session `status` is `"exited"`

---

## Summary

Report results as:

```
Test 1: Basic prompt CLI          — PASS / FAIL
Test 2: Python REPL               — PASS / FAIL
Test 3: --text pattern            — PASS / FAIL
Test 4: Custom timeout            — PASS / FAIL
Test 5: ctrl+c interrupts         — PASS / FAIL
Test 6: Vertical menu highlights  — PASS / FAIL
Test 7: Inline tab bar highlights — PASS / FAIL
Test 8: Dialog box highlights     — PASS / FAIL
Test 9: Advanced features         — PASS / FAIL

9/9 passed
```

If any test fails, include the actual `screen` and `highlights` values and what was expected.
