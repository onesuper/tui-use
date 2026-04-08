# Test: git rebase -i Conflict Resolution

Test that tui-use can drive a full interactive rebase workflow: open the todo
list in vim, accept it, wait for a conflict, resolve the conflict in vim, complete
the rebase, and verify the result.

Note: git may use `master` or `main` as the default branch name depending on the
system. This spec uses `master`. Adjust if your git uses `main`.

Before starting: kill any stale daemon and remove temp repo.
```bash
tui-use daemon stop 2>/dev/null || true
rm -rf /tmp/tui-git-test-repo
```

Set up a git repository with a conflict between `master` and `feature`:
```bash
mkdir /tmp/tui-git-test-repo
cd /tmp/tui-git-test-repo
git init
git config user.email "test@example.com"
git config user.name "Test User"

# Commit A: shared base
echo "hello world" > greeting.txt
git add greeting.txt
git commit -m "A: initial greeting"

# Commit C on feature branch (same line as B — will conflict)
git checkout -b feature
echo "hello from feature" > greeting.txt
git add greeting.txt
git commit -m "C: greet from feature"

# Commit B on master branch
git checkout master
echo "hello from master" > greeting.txt
git add greeting.txt
git commit -m "B: greet from master"

# Switch back to feature — ready to rebase onto master
git checkout feature
```

Assert: `git log --oneline` on `feature` shows commits C and A; `master` shows B and A.

---

## Scenario 1: Start interactive rebase, accept the todo list

**Goal:** Launch `git rebase -i master`, vim opens the rebase todo. Accept it as-is with `:wq`.

```bash
tui-use start --cwd /tmp/tui-git-test-repo "GIT_EDITOR=vim GIT_SEQUENCE_EDITOR=vim git rebase -i master"
tui-use wait --text "pick"
```

Assert: vim is open and the screen contains `pick` (the rebase todo entry for commit C).

**Step 1.1** — Accept the todo list:
```bash
tui-use type ":wq"
tui-use press enter
tui-use wait 500
```

Assert: vim closes and git begins applying commits.

---

## Scenario 2: Conflict is reported

**Goal:** Git reports a conflict on `greeting.txt` after trying to apply commit C on top of B.

**Step 2.1** — Wait for conflict notice:
```bash
tui-use wait --text "greeting.txt"
tui-use snapshot --format json | jq -r '.screen'
```

Assert: screen contains `greeting.txt` (git conflict output mentions the file regardless of locale).

---

## Scenario 3: Resolve the conflict in vim

**Goal:** Open `greeting.txt` in vim, delete all conflict markers, keep `hello from feature`, save.

The conflict file has exactly 5 lines in this order:
```
<<<<<<< HEAD
hello from master
=======
hello from feature
>>>>>>> <hash> (C: greet from feature)
```

Strategy: go to line 1, delete 3 lines (`<<<`, `hello from master`, `===`),
then go to line 2 (the `>>>` marker) and delete it. Line 1 (`hello from feature`) remains.

**Step 3.1** — Open the conflicted file:
```bash
tui-use start vim /tmp/tui-git-test-repo/greeting.txt
tui-use wait --text "<<<<<<<"
```

Assert: vim is open and conflict markers (`<<<<<<<`) are visible on screen.

**Step 3.2** — Delete the first 3 lines (`<<<<<<< HEAD`, `hello from master`, `=======`):
```bash
tui-use type "1G"
tui-use wait 200
tui-use type "dd"
tui-use wait 200
tui-use type "dd"
tui-use wait 200
tui-use type "dd"
tui-use wait 200
```

Assert: `hello from feature` is now on line 1.

**Step 3.3** — Delete the `>>>>>>> ...` closing marker (now line 2):
```bash
tui-use type "2G"
tui-use wait 200
tui-use type "dd"
tui-use wait 200
tui-use snapshot --format json | jq -r '.screen'
```

Assert: only `hello from feature` remains on screen, no conflict markers visible.

**Step 3.4** — Save and exit vim:
```bash
tui-use type ":wq"
tui-use press enter
tui-use wait --format json
```

Assert: status is `exited`, exit_code is `0`.

---

## Scenario 4: Stage the file and complete the rebase

**Goal:** `git add greeting.txt`, then `git rebase --continue`. Vim opens for the commit
message; accept it with `:wq`.

**Step 4.1** — Stage the resolved file:
```bash
tui-use start --cwd /tmp/tui-git-test-repo git add greeting.txt
tui-use wait --format json
```

Assert: exit_code is `0`.

**Step 4.2** — Continue the rebase (vim will open for commit message):
```bash
tui-use start --cwd /tmp/tui-git-test-repo "GIT_EDITOR=vim git rebase --continue"
tui-use wait --text "greet from feature"
tui-use snapshot --format json | jq -r '.screen'
```

Assert: vim is open showing the commit message buffer (contains "C: greet from feature").

**Step 4.3** — Accept the commit message:
```bash
tui-use type ":wq"
tui-use press enter
tui-use wait 1000
tui-use snapshot --format json | jq -r '.screen'
```

Assert: session has exited, screen contains confirmation that rebase succeeded
(look for "feature" in the output — git prints the rebased branch name).

---

## Scenario 5: Verify the result

**Goal:** Confirm `greeting.txt` contains the resolved content and git log looks correct.

**Step 5.1** — Check file content:
```bash
cat /tmp/tui-git-test-repo/greeting.txt
```

Assert: output is exactly `hello from feature` with no conflict markers.

**Step 5.2** — Check git log:
```bash
cd /tmp/tui-git-test-repo && git log --oneline
```

Assert: log shows 3 commits (A, B on master, C rebased on top), no merge commit.

**Cleanup:**
```bash
tui-use kill 2>/dev/null || true
tui-use daemon stop 2>/dev/null || true
rm -rf /tmp/tui-git-test-repo
```
