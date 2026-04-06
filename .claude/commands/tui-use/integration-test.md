# tui-use Integration Tests

Run all integration tests below in order. For each step, execute the command and verify the assertion. Report PASS or FAIL for each test case, and a summary at the end.

Before starting: kill any stale daemon.
```bash
kill $(cat ~/.tui-use/daemon.pid 2>/dev/null) 2>/dev/null || true
```

---

## Test 1: Basic prompt CLI

**Goal:** Drive a simple prompt-based Python script end to end.

```bash
SID=$(tui-use start python3 examples/ask.py)
```

**Step 1.1** — Wait for first prompt:
```bash
tui-use wait $SID
```
Assert: `screen` contains `"What is your name?"`

**Step 1.2** — Enter a name:
```bash
tui-use type $SID "Alice\n"
tui-use wait $SID --until "age"
```
Assert: `screen` contains `"Hello Alice!"` and `"What is your age?"`

**Step 1.3** — Enter age and get final output:
```bash
tui-use type $SID "30\n"
tui-use wait $SID
```
Assert: `screen` contains `"You are 30 years old!"`, `status` is `"exited"`, `exit_code` is `0`

```bash
tui-use kill $SID
```

---

## Test 2: Python REPL

**Goal:** Interact with an interactive REPL, execute expressions, verify output.

```bash
SID=$(tui-use start python3)
tui-use wait $SID --until ">>>"
```
Assert: `screen` contains `">>>"`

**Step 2.1** — Set a variable:
```bash
tui-use type $SID "x = 42\n"
tui-use wait $SID --until ">>>"
```
Assert: `screen` contains `">>>"`

**Step 2.2** — Evaluate expression:
```bash
tui-use type $SID "print(x * 2)\n"
tui-use wait $SID --until ">>>"
```
Assert: `screen` contains `"84"`

**Step 2.3** — Exit REPL:
```bash
tui-use type $SID "exit()\n"
tui-use wait $SID
```
Assert: `status` is `"exited"`

```bash
tui-use kill $SID
```

---

## Test 3: --until pattern

**Goal:** Verify `--until` blocks until the pattern appears in the screen.

```bash
SID=$(tui-use start python3 examples/ask.py)
OUT=$(tui-use wait $SID --until ">")
```
Assert: `screen` contains `"What is your name?"`, command did not time out

```bash
tui-use kill $SID
```

---

## Test 4: --timeout

**Goal:** Verify `--timeout` returns gracefully when screen doesn't change.

```bash
SID=$(tui-use start sleep 10)
OUT=$(tui-use wait $SID --timeout 300)
```
Assert: command returns within ~300ms, `changed` is `false`

```bash
tui-use kill $SID
```

---

## Test 5: ctrl+c interrupts process

**Goal:** Verify special key `ctrl+c` sends interrupt signal.

```bash
SID=$(tui-use start python3)
tui-use wait $SID --until ">>>"
tui-use type $SID "ctrl+c"
OUT=$(tui-use wait $SID --timeout 1000)
```
Assert: `screen` contains `"KeyboardInterrupt"`

```bash
tui-use kill $SID
```

---

## Summary

Report results as:

```
Test 1: Basic prompt CLI     — PASS / FAIL
Test 2: Python REPL          — PASS / FAIL
Test 3: --until pattern      — PASS / FAIL
Test 4: --timeout            — PASS / FAIL
Test 5: ctrl+c interrupts    — PASS / FAIL

5/5 passed
```

If any test fails, include the actual `screen` value and what was expected.
