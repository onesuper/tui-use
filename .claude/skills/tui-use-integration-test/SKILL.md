---
name: tui-use-integration-test
description: Use when you need to verify tui-use end-to-end behavior — driving interactive CLI programs, Python REPL, --text pattern matching, --timeout, and special key handling.
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

## Summary

Report results as:

```
Test 1: Basic prompt CLI     — PASS / FAIL
Test 2: Python REPL          — PASS / FAIL
Test 3: --text pattern       — PASS / FAIL
Test 4: Custom timeout       — PASS / FAIL
Test 5: ctrl+c interrupts    — PASS / FAIL

5/5 passed
```

If any test fails, include the actual `screen` value and what was expected.
