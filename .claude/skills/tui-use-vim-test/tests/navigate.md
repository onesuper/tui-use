# Test: vim Navigate

Test line jumping, deleting lines, undo, and redo.

Before starting: prepare a test file and kill any stale daemon.
```bash
tui-use daemon stop 2>/dev/null || true
printf "line one\nline two\nline three\n" > /tmp/tui-vim-nav-test.txt
```

---

## Scenario 1: Line jump with G

**Goal:** Jump to a specific line number.

```bash
tui-use start vim /tmp/tui-vim-nav-test.txt
tui-use wait --text "tui-vim-nav-test"
```

**Step 1.1** — Jump to line 2:
```bash
tui-use type "2G"
tui-use wait 300
tui-use snapshot --format json | jq -r '.cursor'
```
Assert: cursor y is `1` (0-indexed line 2)

---

## Scenario 2: Delete line and undo/redo

**Goal:** Delete a line, undo, then redo with ctrl+r.

**Step 2.1** — Delete line 1:
```bash
tui-use type "1G"
tui-use wait 300
tui-use type "dd"
tui-use wait 300
tui-use snapshot --format json | jq -r '.screen'
```
Assert: "line one" is no longer on screen

**Step 2.2** — Undo:
```bash
tui-use type "u"
tui-use wait 300
tui-use snapshot --format json | jq -r '.screen'
```
Assert: "line one" is back on screen

**Step 2.3** — Redo with ctrl+r:
```bash
tui-use press ctrl+r
tui-use wait 300
tui-use snapshot --format json | jq -r '.screen'
```
Assert: "line one" is gone again

**Cleanup:**
```bash
tui-use type ":q!"
tui-use press enter
tui-use wait
tui-use kill 2>/dev/null || true
rm -f /tmp/tui-vim-nav-test.txt
```
