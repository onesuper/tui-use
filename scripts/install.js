#!/usr/bin/env node
/**
 * Post-install script to install prebuilt node-pty binaries
 * Falls back to building from source if no prebuild is available
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platform = process.platform;
const arch = process.arch;
const platformKey = `${platform}-${arch}`;

// Find prebuilds directory (bundled with tui-use)
const prebuildsDir = path.join(__dirname, '..', 'dist', 'prebuilds');

function findNodePtyPath() {
  try {
    return path.dirname(path.dirname(require.resolve('node-pty')));
  } catch (e) {
    return null;
  }
}

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

function installPrebuild(nodePtyDir) {
  const prebuildPath = path.join(prebuildsDir, platformKey, 'pty.node');
  if (!fs.existsSync(prebuildPath)) {
    console.log(`[tui-use] No prebuild for ${platformKey}`);
    return false;
  }

  const targetDir = path.join(nodePtyDir, 'build', 'Release');
  const targetPath = path.join(targetDir, 'pty.node');

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.copyFileSync(prebuildPath, targetPath);
    fs.chmodSync(targetPath, 0o755);
    console.log(`[tui-use] Installed prebuilt binary for ${platformKey}`);
    return true;
  } catch (err) {
    console.error(`[tui-use] Failed to install prebuild: ${err.message}`);
    return false;
  }
}

function rebuildFromSource(nodePtyDir) {
  console.log('[tui-use] Building node-pty from source...');
  console.log('[tui-use] This may take a minute...');
  try {
    execSync('npx node-gyp rebuild', {
      stdio: 'inherit',
      cwd: nodePtyDir
    });
    console.log('[tui-use] Build successful');
    return true;
  } catch (err) {
    console.error('[tui-use] Build failed:', err.message);
    return false;
  }
}

function main() {
  console.log(`[tui-use] Platform: ${platformKey}`);

  // Check if already working
  if (testNodePty()) {
    console.log('[tui-use] node-pty is ready');
    return;
  }

  const nodePtyDir = findNodePtyPath();
  if (!nodePtyDir) {
    console.error('[tui-use] Cannot find node-pty module');
    process.exit(1);
  }

  // Try to install prebuilt binary
  if (installPrebuild(nodePtyDir)) {
    // Test again after installing prebuild
    delete require.cache[require.resolve('node-pty')];
    if (testNodePty()) {
      console.log('[tui-use] Prebuilt binary works');
      return;
    }
    console.log('[tui-use] Prebuilt binary incompatible, will build from source');
  }

  // Fall back to building from source
  if (rebuildFromSource(nodePtyDir)) {
    delete require.cache[require.resolve('node-pty')];
    if (testNodePty()) {
      console.log('[tui-use] node-pty is ready');
      return;
    }
  }

  console.error('[tui-use] Failed to setup node-pty');
  console.error('[tui-use] You may need to install build tools:');
  console.error('  macOS: xcode-select --install');
  console.error('  Linux: sudo apt-get install build-essential python3 g++');
  process.exit(1);
}

main();
