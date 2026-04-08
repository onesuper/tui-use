#!/usr/bin/env node
/**
 * Post-install script to install prebuilt node-pty binaries
 * Handles both npm install and npx environments
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platform = process.platform;
const arch = process.arch;
const platformKey = `${platform}-${arch}`;

// Find prebuilds directory (in tui-use package)
const prebuildsDir = path.join(__dirname, '..', 'dist', 'prebuilds');

// Find node-pty build directory (may be nested or flat)
function findNodePtyPath() {
  const candidates = [
    // npm install: node-pty inside tui-use/node_modules
    path.join(__dirname, '..', 'node_modules', 'node-pty', 'build', 'Release'),
    // npx/yarn: node-pty at same level as tui-use
    path.join(__dirname, '..', '..', 'node-pty', 'build', 'Release'),
  ];

  // Return the first existing parent directory, or default
  for (const dir of candidates) {
    const parent = path.dirname(dir);
    if (fs.existsSync(parent)) {
      return dir;
    }
  }
  return candidates[0];
}

const nodePtyBuildDir = findNodePtyPath();

function findPrebuild() {
  if (!fs.existsSync(prebuildsDir)) {
    return null;
  }

  const prebuildPath = path.join(prebuildsDir, platformKey);
  if (!fs.existsSync(prebuildPath)) {
    return null;
  }

  const files = fs.readdirSync(prebuildPath).filter(f => f.endsWith('.node'));
  if (files.length === 0) {
    return null;
  }

  return path.join(prebuildPath, files[0]);
}

function installPrebuild(prebuildPath) {
  try {
    if (!fs.existsSync(nodePtyBuildDir)) {
      fs.mkdirSync(nodePtyBuildDir, { recursive: true });
    }

    const targetPath = path.join(nodePtyBuildDir, 'pty.node');
    fs.copyFileSync(prebuildPath, targetPath);
    console.log(`[tui-use] Installed prebuilt binary for ${platformKey}`);
    return true;
  } catch (err) {
    console.error(`[tui-use] Failed to install prebuild: ${err.message}`);
    return false;
  }
}

function main() {
  // Check if already installed
  if (fs.existsSync(nodePtyBuildDir)) {
    const files = fs.readdirSync(nodePtyBuildDir).filter(f => f.endsWith('.node'));
    if (files.length > 0) {
      console.log(`[tui-use] node-pty already built`);
      return;
    }
  }

  // Try prebuild
  const prebuildPath = findPrebuild();
  if (prebuildPath && installPrebuild(prebuildPath)) {
    return;
  }

  // Build from source
  console.log(`[tui-use] Building from source...`);
  try {
    execSync('npm rebuild node-pty', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log(`[tui-use] Built from source successfully`);
  } catch (err) {
    console.error(`[tui-use] Build failed: ${err.message}`);
    process.exit(1);
  }
}

main();
