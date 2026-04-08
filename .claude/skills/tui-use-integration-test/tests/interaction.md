# Test: Interaction Input

Test user interaction: wait, type, press, paste, REPL interaction.

Before starting: kill any stale daemon.
```bash
tui-use daemon stop 2>/dev/null || true
```

---

## Scenario 1: Basic wait and type

**Goal:** Drive a simple prompt-based CLI.

```bash
tui-use start python3 examples/ask.py
tui-use wait --text "name"
```

**Step 1.1** — Verify prompt appeared:
```bash
tui-use snapshot --format json | jq -r '.screen'
```
Assert: screen contains "What is your name?"

**Step 1.2** — Type and submit:
```bash
tui-use type "Alice"
tui-use press enter
tui-use wait --text "age"
```
Assert: screen contains "Hello Alice!" and "What is your age?"

**Step 1.3** — Complete interaction:
```bash
tui-use type "30"
tui-use press enter
tui-use wait
```
Assert: screen contains "You are 30 years old!", status is "exited"

**Cleanup:**
```bash
tui-use kill 2>/dev/null || true
```

---

## Scenario 2: REPL interaction

**Goal:** Interact with Python REPL.

```bash
tui-use start python3
tui-use wait --text ">>>"
```

**Step 2.1** — Set variable:
```bash
tui-use type "x = 42"
tui-use press enter
tui-use wait --text ">>>"
```
Assert: prompt returns

**Step 2.2** — Evaluate expression:
```bash
tui-use type "print(x * 2)"
tui-use press enter
tui-use wait --text ">>>"
```
Assert: screen contains "84"

**Step 2.3** — Exit REPL:
```bash
tui-use type "exit()"
tui-use press enter
tui-use wait
```
Assert: status is "exited"

**Cleanup:**
```bash
tui-use kill 2>/dev/null || true
```

---

## Scenario 3: Paste multi-line input

**Goal:** Paste multiple lines at once.

```bash
tui-use start python3
tui-use wait --text ">>>"
```

**Step 3.1** — Paste multi-line code:
```bash
tui-use paste "x = 1
y = 2
print(x + y)"
tui-use wait --text ">>>"
```
Assert: screen contains "1", "2", and "3"

**Step 3.2** — Paste function definition:
```bash
tui-use paste "def greet(name):
    return f'Hello, {name}!'
print(greet('World'))"
tui-use wait --text ">>>"
```
Assert: screen contains "Hello, World!"

**Cleanup:**
```bash
tui-use type "exit()"
tui-use press enter
tui-use wait
tui-use kill
```

---

## Scenario 4: Custom timeout and --text pattern

**Goal:** Verify wait options work correctly.

```bash
tui-use start sleep 10
```

**Step 4.1** — Custom timeout returns quickly:
```bash
time tui-use wait 300 --format json | jq -r '.changed'
```
Assert: returns within ~400ms, `changed` is `false`

**Cleanup:**
```bash
tui-use kill
```

---

## Scenario 5: Special keys (ctrl+c)

**Goal:** Send interrupt signal.

```bash
tui-use start python3
tui-use wait --text ">>>"
tui-use press ctrl+c
tui-use wait 1000
```
Assert: screen contains "KeyboardInterrupt"

**Cleanup:**
```bash
tui-use kill
```

---

## Summary

- Scenario 1 (Basic wait/type): PASS / FAIL
- Scenario 2 (REPL): PASS / FAIL
- Scenario 3 (Paste): PASS / FAIL
- Scenario 4 (Timeout): PASS / FAIL
- Scenario 5 (Special keys): PASS / FAIL
