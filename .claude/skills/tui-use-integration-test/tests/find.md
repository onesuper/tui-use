# Test: Find Text on Screen

Test text search functionality with various patterns and scenarios.

Before starting: kill any stale daemon.
```bash
tui-use daemon stop 2>/dev/null || true
```

---

## Scenario 1: Find in static output

**Goal:** Search for text in command output.

```bash
tui-use start echo "hello world test"
tui-use wait
```

**Step 1.1** — Find literal text:
```bash
tui-use find "hello"
```
Assert: Returns 1 match, `text` is "hello", `line` is 0

**Step 1.2** — Find text not present:
```bash
tui-use find "xyz123"
```
Assert: Returns "No matches found"

**Cleanup:**
```bash
tui-use kill
```

---

## Scenario 2: Find with regex

**Goal:** Use regex patterns for flexible matching.

```bash
tui-use start --cwd /tmp "bash -c 'seq 1 20 | nl -ba'"
tui-use wait
```

Note: use `nl` to number 20 lines — small enough to fit in one screen (terminal is 30 rows), so the full output is visible when wait resolves.

**Step 2.1** — Find line with number 1:
```bash
tui-use find "^\s*1\s"
```
Assert: Returns match with `text` containing "1"

**Step 2.2** — Find lines with two-digit numbers:
```bash
tui-use find "^\s*[1-9][0-9]"
```
Assert: Returns at least one match (lines 10-20)

**Cleanup:**
```bash
tui-use kill
```

---

## Scenario 3: Find in REPL

**Goal:** Search in interactive REPL output.

```bash
tui-use start python3
tui-use wait --text ">>>"
tui-use paste "x = 100
y = 200
print(f'sum = {x + y}')"
tui-use wait --text ">>>"
```

**Step 3.1** — Find printed output:
```bash
tui-use find "sum = 300"
```
Assert: Returns match with `text` containing "sum = 300"

**Step 3.2** — Find variable assignment:
```bash
tui-use find "x = 100"
```
Assert: Returns match

**Cleanup:**
```bash
tui-use type "exit()"
tui-use press enter
tui-use wait
tui-use kill
```

---

## Scenario 4: Multiple matches

**Goal:** Handle multiple matches on same or different lines.

```bash
tui-use start bash -c "echo 'test line 1'; echo 'test line 2'; echo 'other'"
tui-use wait
```

**Step 4.1** — Find multiple occurrences:
```bash
tui-use find "test"
```
Assert: Returns 2 matches with different `line` values

**Cleanup:**
```bash
tui-use kill
```

---

