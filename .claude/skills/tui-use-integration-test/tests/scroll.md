# Test: Scroll Terminal Buffer

Test scroll functionality for viewing history in non-fullscreen apps.

Before starting: kill any stale daemon.
```bash
tui-use daemon stop 2>/dev/null || true
```

---

## Scenario 1: Scroll through large output

**Goal:** View content that scrolled off screen.

```bash
tui-use start cat -n /usr/share/dict/words
tui-use wait --text "1  "
```

**Step 1.1** — Capture initial screen:
```bash
tui-use snapshot --format json | jq -r '.screen' | head -5
```
Note first 5 lines (should show lines 1-5)

**Step 1.2** — Scroll down:
```bash
tui-use scroll 10
tui-use snapshot --format json | jq -r '.screen' | head -5
```
Assert: Screen content changed, now shows different lines (lines 11-15 or scrollback content)

**Step 1.3** — Scroll up:
```bash
tui-use scroll -10
tui-use snapshot --format json | jq -r '.screen' | head -5
```
Assert: Screen shows content closer to initial view

**Cleanup:**
```bash
tui-use kill
```

---

## Scenario 2: Scroll with find combination

**Goal:** Use scroll to find content that was off-screen.

```bash
tui-use start cat -n /usr/share/dict/words
tui-use wait --text "1  "
```

**Step 2.1** — Try to find B words (initially not visible):
```bash
tui-use find "^[[:space:]]*[0-9]+[[:space:]]+B"
```
Assert: May or may not find, depending on visible area

**Step 2.2** — Scroll down and search again:
```bash
tui-use scroll 50
tui-use find "^[[:space:]]*[0-9]+[[:space:]]+B"
```
Assert: Now finds matches with B words

**Cleanup:**
```bash
tui-use kill
```

---

## Scenario 3: Scroll limits

**Goal:** Handle scroll at buffer boundaries gracefully.

```bash
tui-use start echo "line1"; sleep 100
tui-use wait
```

**Step 3.1** — Scroll up with minimal content:
```bash
tui-use scroll -100
```
Assert: Command succeeds (returns `ok: true`), no error

**Step 3.2** — Scroll down with minimal content:
```bash
tui-use scroll 100
```
Assert: Command succeeds, no error

**Cleanup:**
```bash
tui-use kill
```

---

## Summary

- Scenario 1 (Basic scroll): PASS / FAIL
- Scenario 2 (Scroll + Find): PASS / FAIL
- Scenario 3 (Boundary limits): PASS / FAIL
