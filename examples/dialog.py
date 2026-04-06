"""
Box-draw dialog — panel with border + inverse-highlighted buttons inside.
Tests that highlights are detected correctly inside box-drawing chrome.

Expected highlights output:
  highlights: [{ line: N, col_start: X, col_end: Y, text: "Yes" or "No" }]
"""
import sys
import tty
import termios

selected = 0  # 0 = Yes, 1 = No

def render():
    print("\033[2J\033[H", end="")
    print()
    print("  ┌─────────────────────────────┐")
    print("  │                             │")
    print("  │   Delete file 'foo.txt'?    │")
    print("  │                             │")

    yes = "\033[7m  Yes  \033[0m" if selected == 0 else "  Yes  "
    no  = "\033[7m  No   \033[0m" if selected == 1 else "  No   "
    print(f"  │      {yes}     {no}      │")
    print("  │                             │")
    print("  └─────────────────────────────┘")
    sys.stdout.flush()

def getch():
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        return sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)

render()

while True:
    ch = getch()
    if ch == '\x1b':
        ch2 = getch()
        ch3 = getch()
        if ch2 == '[':
            if ch3 in ('D', 'C'):   # left / right
                selected = 1 - selected
                render()
    elif ch == '\r':
        answer = "Yes" if selected == 0 else "No"
        print(f"\n\nYou chose: {answer}")
        break
