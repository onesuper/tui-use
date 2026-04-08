# Test: vim Edit

Test creating a new file, inserting content, saving, and verifying.

Before starting: kill any stale daemon and remove temp file.
```bash
tui-use daemon stop 2>/dev/null || true
rm -f /tmp/tui-vim-test.txt
```

---

## Scenario 1: Create file and insert text

**Goal:** Open a new file in vim, insert multi-line content, save and verify.

```bash
tui-use start vim /tmp/tui-vim-test.txt
tui-use wait --text "tui-vim-test"
```

Assert: vim opened, screen shows `[New]`

**Step 1.1** — Enter insert mode:
```bash
tui-use type "i"
tui-use wait --text "INSERT"
```
Assert: status line shows `-- INSERT --`

**Step 1.2** — Type content line by line:
```bash
tui-use type "hello world"
tui-use press enter
tui-use type "second line"
tui-use press enter
tui-use type "third line"
```

**Step 1.3** — Return to normal mode and save:
```bash
tui-use press escape
tui-use wait 300
tui-use type ":wq"
tui-use press enter
tui-use wait --format json
```
Assert: status is `exited`, exit_code is `0`

**Step 1.4** — Verify file content:
```bash
cat /tmp/tui-vim-test.txt
```
Assert: file contains "hello world", "second line", "third line"

**Cleanup:**
```bash
tui-use kill 2>/dev/null || true
rm -f /tmp/tui-vim-test.txt
```
