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

const prebuildsDir = path.join(__dirname, '..', 'dist', 'prebuilds');
const nodePtyBuildDir = path.join(__dirname, '..', 'node_modules', 'node-pty', 'build', 'Release');

function findPrebuild() {
  // Check if prebuilds exist in the package
  if (!fs.existsSync(prebuildsDir)) {
    console.log(`[tui-use] No prebuilds bundled, will build from source...`);
    return null;
  }

  const prebuildPath = path.join(prebuildsDir, platformKey);
  if (!fs.existsSync(prebuildPath)) {
    console.log(`[tui-use] No prebuild for ${platformKey}, will build from source...`);
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
    // Ensure target directory exists
    if (!fs.existsSync(nodePtyBuildDir)) {
      fs.mkdirSync(nodePtyBuildDir, { recursive: true });
    }

    // Copy prebuilt binary
    const targetPath = path.join(nodePtyBuildDir, path.basename(prebuildPath));
    fs.copyFileSync(prebuildPath, targetPath);
    console.log(`[tui-use] Installed prebuilt binary for ${platformKey}`);
    return true;
  } catch (err) {
    console.error(`[tui-use] Failed to install prebuild: ${err.message}`);
    return false;
  }
}

function buildFromSource() {
  console.log(`[tui-use] Building node-pty from source...`);
  try {
    execSync('npm rebuild node-pty', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log(`[tui-use] Successfully built from source`);
    return true;
  } catch (err) {
    console.error(`[tui-use] Failed to build from source: ${err.message}`);
    console.error(`[tui-use] You may need to install build tools:`);
    console.error(`  macOS: xcode-select --install`);
    console.error(`  Linux: sudo apt-get install build-essential`);
    console.error(`  Windows: npm install --global windows-build-tools`);
    return false;
  }
}

function main() {
  // Skip if node-pty is already built
  if (fs.existsSync(nodePtyBuildDir)) {
    const files = fs.readdirSync(nodePtyBuildDir).filter(f => f.endsWith('.node'));
    if (files.length > 0) {
      console.log(`[tui-use] node-pty already built`);
      process.exit(0);
    }
  }

  // Try to install prebuild
  const prebuildPath = findPrebuild();
  if (prebuildPath) {
    if (installPrebuild(prebuildPath)) {
      process.exit(0);
    }
  }

  // Fall back to building from source
  if (buildFromSource()) {
    process.exit(0);
  }

  process.exit(1);
}

main();
