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
    // Test in a subprocess so native addon can be freshly loaded after install.
    // Write a temp file to avoid shell quoting issues with paths containing special chars.
    const nodePtyPath = path.join(__dirname, '..', 'node_modules', 'node-pty');
    const tmpScript = path.join(require('os').tmpdir(), 'tui-use-test-pty.js');
    fs.writeFileSync(tmpScript, `
      const pty = require(${JSON.stringify(nodePtyPath)});
      const p = pty.spawn('/bin/sh', ['-c', 'exit'], { name: 'xterm' });
      p.kill();
    `);
    execSync(`node ${tmpScript}`, { stdio: 'ignore' });
    try { fs.unlinkSync(tmpScript); } catch {}
    return true;
  } catch (e) {
    return false;
  }
}

function installPrebuild(nodePtyDir) {
  // First, try node-pty's own bundled prebuild (most reliable)
  const bundledPrebuild = path.join(nodePtyDir, 'prebuilds', platformKey, 'pty.node');
  // Fall back to tui-use bundled prebuild
  const tuiUsePrebuild = path.join(prebuildsDir, platformKey, 'pty.node');

  const prebuildPath = fs.existsSync(bundledPrebuild) ? bundledPrebuild
    : fs.existsSync(tuiUsePrebuild) ? tuiUsePrebuild
    : null;

  if (!prebuildPath) {
    console.log(`[tui-use] No prebuild for ${platformKey}`);
    return false;
  }

  const prebuildDir = path.dirname(prebuildPath);
  const targetDir = path.join(nodePtyDir, 'build', 'Release');

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    // Copy pty.node
    fs.copyFileSync(prebuildPath, path.join(targetDir, 'pty.node'));
    fs.chmodSync(path.join(targetDir, 'pty.node'), 0o755);
    // Copy spawn-helper if present (required on macOS/Linux for PTY spawning)
    const spawnHelperSrc = path.join(prebuildDir, 'spawn-helper');
    if (fs.existsSync(spawnHelperSrc)) {
      fs.copyFileSync(spawnHelperSrc, path.join(targetDir, 'spawn-helper'));
      fs.chmodSync(path.join(targetDir, 'spawn-helper'), 0o755);
    }
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
    // Set SDKROOT to help gyp find CLT on macOS when pkgutil receipt check fails
    const env = { ...process.env };
    if (process.platform === 'darwin' && !env.SDKROOT) {
      try {
        const sdk = execSync('xcrun --show-sdk-path 2>/dev/null', { encoding: 'utf8' }).trim();
        if (sdk) env.SDKROOT = sdk;
      } catch {}
    }
    execSync('npx node-gyp rebuild', {
      stdio: 'inherit',
      cwd: nodePtyDir,
      env,
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
    if (testNodePty()) {
      console.log('[tui-use] Prebuilt binary works');
      return;
    }
    console.log('[tui-use] Prebuilt binary incompatible, will build from source');
  }

  // Fall back to building from source
  if (rebuildFromSource(nodePtyDir)) {
    console.log('[tui-use] node-pty rebuilt successfully');
    return;
  }

  // Build failed
  console.error('[tui-use] node-pty native binding failed to load.\n');
  if (platform === 'darwin') {
    console.error('[tui-use] To fix on macOS:');
    console.error('  xcode-select --install');
    console.error('  npm install -g tui-use');
  } else if (platform === 'linux') {
    console.error('[tui-use] To fix on Linux:');
    console.error('  sudo apt-get install build-essential python3 g++');
    console.error('  npm install -g tui-use');
  } else {
    console.error('[tui-use] Please install build tools for your platform and re-run:');
    console.error('  npm install -g tui-use');
  }
  process.exit(1);
}

main();
