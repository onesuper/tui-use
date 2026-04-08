# Test: Highlights Detection

Test detection of selected items via inverse-video spans.

Before starting: kill any stale daemon.
```bash
tui-use daemon stop 2>/dev/null || true
```

---

## Scenario 1: Vertical menu

**Goal:** Track selection in a vertical menu.

```bash
tui-use start python3 examples/menu.py
tui-use wait --text "Option"
```

**Step 1.1** — Verify initial highlight:
```bash
tui-use snapshot --format json | jq '.highlights'
```
Assert: `highlights` contains exactly one entry with `text` = "Option A" and fields `line`, `col_start`, `col_end`

**Step 1.2** — Move selection down:
```bash
tui-use press arrow_down
tui-use wait
tui-use snapshot --format json | jq '.highlights'
```
Assert: `highlights` contains exactly one entry with `text` = "Option B"

**Step 1.3** — Move to last option:
```bash
tui-use press arrow_down
tui-use wait
```
Assert: `highlights` contains "Option C"

**Cleanup:**
```bash
tui-use kill
```

---

## Scenario 2: Inline tab bar

**Goal:** Track inline selection across tabs.

```bash
tui-use start python3 examples/tabs.py
tui-use wait --text "Files"
```

**Step 2.1** — Verify initial tab:
```bash
tui-use snapshot --format json | jq '.highlights'
```
Assert: `highlights` contains one entry with `text` = "Files"

**Step 2.2** — Track line number:
```bash
tui-use snapshot --format json | jq '.highlights[0].line'
```
Note the `line` value

**Step 2.3** — Move to next tab:
```bash
tui-use press arrow_right
tui-use wait
tui-use snapshot --format json | jq '.highlights'
```
Assert: `highlights` contains one entry with `text` = "Git", on the same `line` as before

**Step 2.4** — Move to third tab:
```bash
tui-use press arrow_right
tui-use wait
```
Assert: `highlights` contains "Settings"

**Cleanup:**
```bash
tui-use kill
```

---

## Scenario 3: Dialog box buttons

**Goal:** Detect buttons inside box-drawing border.

```bash
tui-use start python3 examples/dialog.py
tui-use wait --text "Delete"
```

**Step 3.1** — Verify Yes button highlighted:
```bash
tui-use snapshot --format json | jq '.highlights'
```
Assert: `highlights` contains one entry with `text` = "Yes"

**Step 3.2** — Note line and position:
```bash
tui-use snapshot --format json | jq '.highlights[0] | {line, col_start, col_end}'
```

**Step 3.3** — Switch to No:
```bash
tui-use press arrow_right
tui-use wait
tui-use snapshot --format json | jq '.highlights'
```
Assert: `highlights` contains one entry with `text` = "No", on the same `line` as before, with `col_start` and `col_end` updated

**Cleanup:**
```bash
tui-use kill
```

---

## Summary

- Scenario 1 (Vertical menu): PASS / FAIL
- Scenario 2 (Tab bar): PASS / FAIL
- Scenario 3 (Dialog): PASS / FAIL
