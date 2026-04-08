#!/usr/bin/env node
/**
 * Post-install script to verify node-pty compatibility
 * Prints warning if binary is incompatible (does not block install)
 */

function testNodePty() {
  try {
    const pty = require('node-pty');
    const proc = pty.spawn('echo', ['test'], { name: 'xterm-color' });
    proc.kill();
    return true;
  } catch (e) {
    return false;
  }
}

function main() {
  if (testNodePty()) {
    console.log('[tui-use] node-pty is ready');
    return;
  }

  console.warn('[tui-use] WARNING: node-pty binary is incompatible with your Node.js version');
  console.warn('[tui-use] Please run: npm rebuild node-pty');
  console.warn('[tui-use] Or install build tools and reinstall tui-use:');
  console.warn('  macOS: xcode-select --install');
  console.warn('  Linux: sudo apt-get install build-essential python3 g++');
  console.warn('  Windows: npm install --global windows-build-tools');
  // Don't exit with error - let installation complete
}

main();
