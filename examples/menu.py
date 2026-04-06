import sys
import tty
import termios

options = ["Option A", "Option B", "Option C"]
selected = 0

def render(selected):
    for i, opt in enumerate(options):
        if i == selected:
            # Inverse color (reverse video) — this is what tui-use currently strips
            print(f"\033[7m  {opt}  \033[0m")
        else:
            print(f"  {opt}  ")

def getch():
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        return sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)

print("Select an option (arrow keys + enter):\n")
render(selected)

while True:
    ch = getch()
    if ch == '\x1b':
        ch2 = getch()
        ch3 = getch()
        if ch2 == '[':
            if ch3 == 'A' and selected > 0:
                selected -= 1
            elif ch3 == 'B' and selected < len(options) - 1:
                selected += 1
    elif ch == '\r':
        print(f"\nYou selected: {options[selected]}")
        break
    # Redraw
    print(f"\033[{len(options)}A", end='')
    render(selected)
