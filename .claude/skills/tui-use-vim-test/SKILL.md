---
name: tui-use-vim-test
description: Use when you need to verify tui-use's ability to drive vim — opening files, editing text, navigation, undo/redo, search & replace, and saving.
---

# tui-use vim Tests

Run tests to verify tui-use can drive vim for real editing tasks.

## Usage

```
/tui-use-vim-test              # Run all test suites
/tui-use-vim-test <suite>      # Run specific test suite
```

## Available Test Suites

| Suite | Description |
|-------|-------------|
| `edit` | Create file, insert text, save, verify content |
| `navigate` | Line jumping, undo, redo with ctrl+r |
| `substitute` | Global search & replace with :%s |

Test specifications are in `tests/` directory.

## Reporting

After running tests, report results as:

```
<suite>:
  <scenario>      — PASS / FAIL / PARTIAL
    - <step description>: PASS / FAIL (<reason or actual output>)
```

If any test fails, include the actual screen content and what was expected.
