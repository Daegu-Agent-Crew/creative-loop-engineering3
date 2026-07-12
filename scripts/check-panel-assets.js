#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function git(args) {
  return childProcess.execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function changedFiles() {
  const unique = (values) => Array.from(new Set(values.filter(Boolean)));
  const untracked = () => {
    try {
      return git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
    } catch (error) {
      return [];
    }
  };
  const staged = () => {
    try {
      return git(['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
    } catch (error) {
      return [];
    }
  };

  if (process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_EVENT_PATH) {
    try {
      const event = readJson(process.env.GITHUB_EVENT_PATH);
      if (event.before && event.after) {
        return git(['diff', '--name-only', `${event.before}..${event.after}`]).split('\n').filter(Boolean);
      }
    } catch (error) {
      // Fall through to the local diff strategy.
    }
  }

  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main';
  try {
    git(['rev-parse', '--verify', baseRef]);
    return unique(git(['diff', '--name-only', `${baseRef}...HEAD`]).split('\n').concat(staged(), untracked()));
  } catch (error) {
    return unique(git(['diff', '--name-only', 'HEAD']).split('\n').concat(staged(), untracked()));
  }
}

function fileSize(filePath) {
  return fs.statSync(filePath).size;
}

function isPanelAsset(filePath) {
  return /^episodes\/[^/]+\/panels\/assets\/.+\.(png|webp)$/i.test(filePath);
}

function episodeFor(filePath) {
  return filePath.split('/')[1];
}

function main() {
  const rootDir = process.cwd();
  const policy = readJson(path.join(rootDir, 'config', 'asset-storage-policy.json'));
  const limits = policy.panel_asset_limits;
  const files = changedFiles();
  const failures = [];
  const warnings = [];
  const episodeDeltas = new Map();

  for (const file of files) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) continue;

    if (/(\-base|\-original|\-candidate|\-rejected)\.png$/i.test(file) || /\.(psd|clip)$/i.test(file)) {
      failures.push(`disallowed source/intermediate asset: ${file}`);
      continue;
    }

    if (!isPanelAsset(file)) continue;

    const size = fileSize(fullPath);
    const episode = episodeFor(file);
    episodeDeltas.set(episode, (episodeDeltas.get(episode) || 0) + size);

    if (size > limits.hard_max_bytes) {
      failures.push(`asset exceeds hard limit (${size} bytes): ${file}`);
    } else if (size > limits.target_max_bytes) {
      warnings.push(`asset exceeds target (${size} bytes): ${file}`);
    }
  }

  for (const [episode, delta] of episodeDeltas.entries()) {
    if (delta > limits.episode_delta_max_bytes) {
      failures.push(`episode ${episode} asset delta exceeds limit (${delta} bytes)`);
    }
  }

  for (const warning of warnings) console.warn(`warning: ${warning}`);

  if (failures.length > 0) {
    for (const failure of failures) console.error(`error: ${failure}`);
    process.exit(1);
  }

  console.log(`asset policy ok: ${files.length} changed files checked`);
}

main();
