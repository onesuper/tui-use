"""
Multi-column picker — multiple inverse fragments on the same line,
only one selected at a time.

Expected highlights output:
  highlights: [{ line: N, col_start: X, col_end: Y, text: "<selected item>" }]
  (one fragment per row, exactly one is selected across all rows)
"""
import sys
import tty
import termios

items = [
    ["Red",    "Green",  "Blue"  ],
    ["Circle", "Square", "Triangle"],
    ["Small",  "Medium", "Large" ],
]
row, col = 0, 0

def render():
    print("\033[2J\033[H", end="")
    print("Pick one from each row (arrow keys, enter to confirm):\n")
    for r, rowdata in enumerate(items):
        line = ""
        for c, item in enumerate(rowdata):
            if r == row and c == col:
                line += f"  \033[7m {item:10s} \033[0m"
            else:
                line += f"   {item:10s}  "
        print(line)
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
            if ch3 == 'A' and row > 0:
                row -= 1; render()
            elif ch3 == 'B' and row < len(items) - 1:
                row += 1; render()
            elif ch3 == 'D' and col > 0:
                col -= 1; render()
            elif ch3 == 'C' and col < len(items[row]) - 1:
                col += 1; render()
    elif ch == '\r':
        print(f"\n\nSelected: {items[row][col]}")
        break
