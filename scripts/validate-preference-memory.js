#!/usr/bin/env node

const fs = require('fs');

function fail(message) {
  throw new Error(message);
}

const filePath = process.argv[2];
if (!filePath) fail('usage: node scripts/validate-preference-memory.js <preference-memory.json>');
const memory = JSON.parse(fs.readFileSync(filePath, 'utf8'));
if (memory.schema_version !== 1) fail('schema_version must be 1');
if (!/^EP\d{3}$/.test(memory.episode_id || '')) fail('invalid episode_id');
if (!memory.policy || memory.policy.human_approval_required !== true) fail('human approval must be required');
if (!Array.isArray(memory.anchors)) fail('anchors must be an array');
const ids = new Set();
for (const anchor of memory.anchors) {
  if (!anchor.anchor_id || ids.has(anchor.anchor_id)) fail(`invalid or duplicate anchor_id: ${anchor.anchor_id}`);
  ids.add(anchor.anchor_id);
  if (!['character', 'style', 'scene', 'approved_panel'].includes(anchor.kind)) fail(`invalid kind: ${anchor.kind}`);
  if (!['approved', 'retired'].includes(anchor.status)) fail(`invalid status: ${anchor.status}`);
  if (!anchor.asset_path) fail(`${anchor.anchor_id}: asset_path is required`);
  if (anchor.kind === 'approved_panel' && anchor.source.type !== 'human_selection') {
    fail(`${anchor.anchor_id}: approved panels require a human selection source`);
  }
}
console.log(`preference memory ok: ${memory.episode_id}, ${memory.anchors.length} anchors`);
