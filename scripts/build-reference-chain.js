#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeCharacter(value) {
  return String(value || '').replace(/\([^)]*\)/g, '').trim();
}

function anchorMatchesPanel(anchor, panel) {
  if (!anchor || anchor.status !== 'approved') return false;
  const scope = anchor.scope || {};
  const scopedCharacters = (scope.characters || []).map(normalizeCharacter);
  const panelCharacters = (panel.characters_in_frame || []).map(normalizeCharacter);
  if (anchor.kind === 'style') return true;
  if (scopedCharacters.length && scopedCharacters.some((name) => panelCharacters.includes(name))) return true;
  if ((scope.panel_types || []).includes(panel.visual_type)) return true;
  return false;
}

function resolveReferenceChain(panel, memory) {
  const direct = (panel.reference_assets || []).map((assetPath) => ({
    asset_path: assetPath,
    source: 'panel_reference',
    anchor_id: null
  }));
  const limit = Math.max(0, Number(memory && memory.policy && memory.policy.maximum_panel_references) || 0);
  const approvedPanels = ((memory && memory.anchors) || [])
    .filter((anchor) => anchor.kind === 'approved_panel' && anchorMatchesPanel(anchor, panel))
    .slice(0, limit)
    .map((anchor) => ({ asset_path: anchor.asset_path, source: 'preference_memory', anchor_id: anchor.anchor_id }));
  const seen = new Set();
  return [...direct, ...approvedPanels].filter((item) => {
    if (!item.asset_path || seen.has(item.asset_path)) return false;
    seen.add(item.asset_path);
    return true;
  });
}

function parseArgs(argv) {
  const args = { episode: 'EP001', panel: null };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--episode') args.episode = argv[++index];
    else if (argv[index] === '--panel') args.panel = argv[++index];
    else throw new Error(`unknown option: ${argv[index]}`);
  }
  if (!args.panel) throw new Error('--panel is required');
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  const root = process.cwd();
  const panels = readJson(path.join(root, 'episodes', args.episode, 'panels', 'panels.json'));
  const memory = readJson(path.join(root, 'episodes', args.episode, 'panels', 'preference-memory.json'));
  const panel = (panels.panels || []).find((item) => item.panel_id === args.panel);
  if (!panel) throw new Error(`unknown panel: ${args.panel}`);
  console.log(JSON.stringify({ episode_id: args.episode, panel_id: args.panel, references: resolveReferenceChain(panel, memory) }, null, 2));
}

module.exports = { resolveReferenceChain };
