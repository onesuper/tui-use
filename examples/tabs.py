"""
Tab bar example — inline inverse highlight.
A single line with multiple tabs, only the selected one is inverse.

Expected highlights output:
  highlights: [{ line: 2, col_start: X, col_end: Y, text: "<selected tab>" }]
"""
import sys
import tty
import termios

tabs = ["Files", "Git", "Search", "Extensions"]
selected = 0

def render():
    print("\033[2J\033[H", end="")  # clear screen
    print("Editor")
    print()
    # Render tab bar — selected tab is inverse
    bar = ""
    for i, tab in enumerate(tabs):
        if i == selected:
            bar += f"\033[7m  {tab}  \033[0m"
        else:
            bar += f"  {tab}  "
    print(bar)
    print()
    print(f"[ {tabs[selected]} panel content ]")
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
            if ch3 == 'D' and selected > 0:      # arrow_left
                selected -= 1
                render()
            elif ch3 == 'C' and selected < len(tabs) - 1:  # arrow_right
                selected += 1
                render()
    elif ch == '\r':
        print(f"\n\nSelected tab: {tabs[selected]}")
        break
