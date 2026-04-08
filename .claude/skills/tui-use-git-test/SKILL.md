---
name: tui-use-git-test
description: Use when you need to verify tui-use's ability to drive git workflows — interactive rebase, conflict resolution with vim, and verifying repository state.
---

# tui-use git Tests

Run tests to verify tui-use can drive real git workflows involving interactive rebase and conflict resolution.

## Usage

```
/tui-use-git-test              # Run all test suites
/tui-use-git-test <suite>      # Run specific test suite
```

## Available Test Suites

| Suite | Description |
|-------|-------------|
| `rebase-conflict` | Interactive rebase with conflict, resolve in vim, verify result |

Test specifications are in `tests/` directory.

## Reporting

After running tests, report results as:

```
<suite>:
  <scenario>      — PASS / FAIL / PARTIAL
    - <step description>: PASS / FAIL (<reason or actual output>)
```

If any test fails, include the actual screen content and what was expected.
