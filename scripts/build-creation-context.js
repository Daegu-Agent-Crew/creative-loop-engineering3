#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readOptionalJson(filePath, fallback) {
  return fs.existsSync(filePath) ? readJson(filePath) : fallback;
}

function normalizeName(value) {
  return String(value || '')
    .replace(/[（(].*$/u, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isSafeRepoPath(rootDir, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) return false;
  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(rootDir, relativePath);
  return resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${path.sep}`);
}

function validateCreationMemory(memory, rootDir, options = {}) {
  const checkPaths = options.checkPaths !== false;
  const failures = [];

  if (!memory || typeof memory !== 'object') return ['creation memory must be an object'];
  if (memory.schema_version !== 1) failures.push('schema_version must be 1');
  if (!/^EP\d{3}$/.test(memory.episode_id || '')) failures.push('episode_id must match EP###');
  if (!memory.creator_contract || memory.creator_contract.creative_actor !== 'codex') {
    failures.push('creator_contract.creative_actor must be codex');
  }
  if (!memory.creator_contract || memory.creator_contract.sole_creative_actor !== true) {
    failures.push('creator_contract.sole_creative_actor must be true');
  }

  const collections = [
    'source_refs',
    'canon_assets',
    'narrative_threads',
    'continuity',
    'preferences',
    'lessons',
    'constraints'
  ];
  collections.forEach((key) => {
    if (!Array.isArray(memory[key])) failures.push(`${key} must be an array`);
  });
  if (!memory.handoff || typeof memory.handoff !== 'object') failures.push('handoff is required');

  collections.forEach((key) => {
    const ids = new Set();
    (memory[key] || []).forEach((entry, index) => {
      if (!entry || !entry.id) {
        failures.push(`${key}[${index}].id is required`);
        return;
      }
      if (ids.has(entry.id)) failures.push(`${key}: duplicate id ${entry.id}`);
      ids.add(entry.id);
    });
  });

  if (checkPaths) {
    const pathsToCheck = [];
    (memory.source_refs || []).forEach((item) => {
      pathsToCheck.push({ label: `source_refs.${item.id}`, path: item.path });
    });
    (memory.canon_assets || []).forEach((item) => {
      pathsToCheck.push({ label: `canon_assets.${item.id}.asset_path`, path: item.asset_path });
      (item.evidence_paths || []).forEach((value) => pathsToCheck.push({ label: `canon_assets.${item.id}.evidence`, path: value }));
    });
    ['narrative_threads', 'continuity', 'preferences', 'lessons'].forEach((key) => {
      (memory[key] || []).forEach((item) => {
        (item.evidence_paths || []).forEach((value) => pathsToCheck.push({ label: `${key}.${item.id}.evidence`, path: value }));
      });
    });
    (memory.constraints || []).forEach((item) => {
      pathsToCheck.push({ label: `constraints.${item.id}.source_path`, path: item.source_path });
    });

    pathsToCheck.forEach((item) => {
      if (!isSafeRepoPath(rootDir, item.path)) {
        failures.push(`${item.label}: path must stay inside the repository (${item.path || '-'})`);
      } else if (!fs.existsSync(path.join(rootDir, item.path))) {
        failures.push(`${item.label}: missing path ${item.path}`);
      }
    });
  }

  return failures;
}

function validateSeriesBible(bible, rootDir, options = {}) {
  const checkPaths = options.checkPaths !== false;
  const failures = [];
  if (!bible || typeof bible !== 'object') return ['series bible must be an object'];
  if (bible.schema_version !== 1) failures.push('schema_version must be 1');
  if (!/^EP\d{3}$/.test(bible.episode_id || '')) failures.push('episode_id must match EP###');
  if (!bible.id || !bible.version) failures.push('id and version are required');
  if (!['provisional', 'approved', 'retired'].includes(bible.status)) failures.push('status is invalid');
  ['world_rules', 'characters', 'locations', 'props', 'continuity_rules'].forEach((key) => {
    if (!Array.isArray(bible[key])) failures.push(`${key} must be an array`);
  });
  if (!bible.visual_style || typeof bible.visual_style !== 'object') failures.push('visual_style is required');

  ['world_rules', 'characters', 'locations', 'props'].forEach((key) => {
    const ids = new Set();
    (bible[key] || []).forEach((entry, index) => {
      if (!entry?.id) failures.push(`${key}[${index}].id is required`);
      else if (ids.has(entry.id)) failures.push(`${key}: duplicate id ${entry.id}`);
      else ids.add(entry.id);
      if (!['provisional', 'approved', 'retired'].includes(entry?.status)) failures.push(`${key}.${entry?.id || index}: status is invalid`);
    });
  });

  if (checkPaths) {
    const paths = [];
    (bible.visual_style?.evidence_paths || []).forEach((value) => paths.push({ label: 'visual_style.evidence', path: value }));
    (bible.world_rules || []).forEach((item) => {
      (item.evidence_paths || []).forEach((value) => paths.push({ label: `world_rules.${item.id}.evidence`, path: value }));
    });
    (bible.characters || []).forEach((item) => {
      paths.push({ label: `characters.${item.id}.reference_asset`, path: item.reference_asset });
      (item.evidence_paths || []).forEach((value) => paths.push({ label: `characters.${item.id}.evidence`, path: value }));
    });
    [...(bible.locations || []), ...(bible.props || [])].forEach((item) => {
      paths.push({ label: `${item.id}.anchor_asset`, path: item.anchor_asset });
      (item.evidence_paths || []).forEach((value) => paths.push({ label: `${item.id}.evidence`, path: value }));
    });
    paths.forEach((item) => {
      if (!isSafeRepoPath(rootDir, item.path)) failures.push(`${item.label}: path must stay inside the repository (${item.path || '-'})`);
      else if (!fs.existsSync(path.join(rootDir, item.path))) failures.push(`${item.label}: missing path ${item.path}`);
    });
  }
  return failures;
}

function scopeMatches(scope, target) {
  const safeScope = scope || { characters: [], panel_ids: [], tags: [] };
  const scopedCharacters = (safeScope.characters || []).map(normalizeName);
  const targetCharacters = (target.characters || []).map(normalizeName);
  const global = (safeScope.tags || []).includes('global');
  const unscoped = !(safeScope.characters || []).length && !(safeScope.panel_ids || []).length && !(safeScope.tags || []).length;
  const characterMatch = scopedCharacters.some((name) => targetCharacters.includes(name));
  const panelMatch = Boolean(target.panelId) && (safeScope.panel_ids || []).includes(target.panelId);
  const tagMatch = (safeScope.tags || []).some((tag) => (target.tags || []).includes(tag));
  return global || unscoped || characterMatch || panelMatch || tagMatch;
}

function findStoryboardPanel(storyboard, panelId) {
  for (const page of storyboard.pages || []) {
    const panel = (page.panels || []).find((item) => item.panel_id === panelId);
    if (panel) return { page, panel };
  }
  return null;
}

function buildCreationContext(options) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const state = readOptionalJson(path.join(rootDir, 'state.json'), { episodes: {} });
  const episodeId = options.episodeId || state.current_episode;
  if (!/^EP\d{3}$/.test(episodeId || '')) throw new Error('episode id is required and must match EP###');

  const episodeDir = path.join(rootDir, 'episodes', episodeId);
  const memoryPath = path.join(episodeDir, 'memory', 'creation-memory.json');
  if (!fs.existsSync(memoryPath)) throw new Error(`missing creation memory: ${path.relative(rootDir, memoryPath)}`);

  const memory = readJson(memoryPath);
  const failures = validateCreationMemory(memory, rootDir);
  if (memory.episode_id !== episodeId) failures.push(`creation memory episode_id does not match ${episodeId}`);
  if (failures.length) throw new Error(`invalid creation memory:\n- ${failures.join('\n- ')}`);

  const panels = readOptionalJson(path.join(episodeDir, 'panels', 'panels.json'), { panels: [] });
  const storyboard = readOptionalJson(path.join(episodeDir, 'storyboard', 'storyboard.json'), { pages: [] });
  const bible = readOptionalJson(path.join(episodeDir, 'bible', 'bible.json'), null);
  if (bible) {
    validateSeriesBible(bible, rootDir).forEach((failure) => failures.push(`series bible: ${failure}`));
    if (bible.episode_id !== episodeId) failures.push(`series bible episode_id does not match ${episodeId}`);
  }
  if (failures.length) throw new Error(`invalid creation context sources:\n- ${failures.join('\n- ')}`);
  const discovery = readOptionalJson(path.join(episodeDir, 'discovery', 'context.json'), {});
  const approvals = readOptionalJson(path.join(episodeDir, 'approvals', 'gates.json'), { gates: [] });
  const panelId = options.panelId || memory.handoff.target_panel_id || null;
  const panel = panelId ? (panels.panels || []).find((item) => item.panel_id === panelId) : null;
  const storyboardMatch = panelId ? findStoryboardPanel(storyboard, panelId) : null;
  if (panelId && !panel && !storyboardMatch) throw new Error(`unknown panel id: ${panelId}`);

  const characters = unique([
    ...((panel && panel.characters_in_frame) || []),
    ...((storyboardMatch && storyboardMatch.panel.characters_in_frame) || [])
  ]);
  const baseTarget = { panelId, characters, tags: [] };
  const narrativeThreads = (memory.narrative_threads || []).filter((item) => {
    if (!panelId) return item.status === 'active';
    return scopeMatches(item.scope, baseTarget);
  });
  const derivedTags = unique(narrativeThreads.flatMap((item) => (item.scope || {}).tags || []));
  const target = { panelId, characters, tags: derivedTags };

  const select = (key) => (memory[key] || []).filter((item) => scopeMatches(item.scope, target));
  const canonAssets = select('canon_assets').filter((item) => item.status !== 'retired');
  const preferences = select('preferences').filter((item) => item.status !== 'retired');
  const lessons = select('lessons').filter((item) => item.status !== 'retired');
  const constraints = select('constraints');
  const continuity = panelId
    ? (memory.continuity || []).filter((item) => item.to_panel_id === panelId || item.from_panel_id === panelId)
    : [];

  const bibleContext = bible ? {
    id: bible.id,
    version: bible.version,
    status: bible.status,
    visual_style: bible.visual_style,
    world_rules: (bible.world_rules || []).filter((item) => (!panelId || (item.panel_ids || []).includes(panelId)) && item.status !== 'retired'),
    characters: (bible.characters || []).filter((item) => {
      if (!panelId) return item.status !== 'retired';
      return characters.map(normalizeName).includes(normalizeName(item.name)) && item.status !== 'retired';
    }),
    locations: (bible.locations || []).filter((item) => (!panelId || (item.panel_ids || []).includes(panelId)) && item.status !== 'retired'),
    props: (bible.props || []).filter((item) => (!panelId || (item.panel_ids || []).includes(panelId)) && item.status !== 'retired'),
    continuity_rules: bible.continuity_rules || []
  } : null;

  const sourceRefs = memory.source_refs || [];
  const panelIntent = panel || storyboardMatch ? {
    panel_id: panelId,
    page_number: (panel && panel.page_number) || (storyboardMatch && storyboardMatch.page.page_number) || null,
    description: (panel && panel.description) || (storyboardMatch && storyboardMatch.panel.description) || '',
    camera_angle: (panel && panel.camera_angle) || (storyboardMatch && storyboardMatch.panel.camera_angle) || '',
    visual_type: (panel && panel.visual_type) || (storyboardMatch && storyboardMatch.panel.visual_type) || 'normal',
    characters_in_frame: characters,
    reference_assets: (panel && panel.reference_assets) || [],
    image_path: (panel && panel.image_path) || null,
    generation_status: (panel && panel.generation_status) || null
  } : null;

  const pendingHumanDecisions = (discovery.human_decisions || []).filter((item) => item.status === 'pending');
  const pendingGates = (approvals.gates || []).filter((item) => ['pending', 'provisional', 'changes_requested'].includes(item.status));
  const omittedCounts = {};
  [
    ['canon_assets', canonAssets],
    ['narrative_threads', narrativeThreads],
    ['continuity', continuity],
    ['preferences', preferences],
    ['lessons', lessons],
    ['constraints', constraints]
  ].forEach(([key, selected]) => {
    omittedCounts[key] = Math.max(0, (memory[key] || []).length - selected.length);
  });
  if (bibleContext) {
    omittedCounts.bible_world_rules = Math.max(0, (bible.world_rules || []).length - bibleContext.world_rules.length);
    omittedCounts.bible_characters = Math.max(0, (bible.characters || []).length - bibleContext.characters.length);
    omittedCounts.bible_locations = Math.max(0, (bible.locations || []).length - bibleContext.locations.length);
    omittedCounts.bible_props = Math.max(0, (bible.props || []).length - bibleContext.props.length);
  }

  return {
    schema_version: 1,
    generated_at: (options.now || new Date()).toISOString(),
    episode_id: episodeId,
    target: {
      task: options.task || memory.handoff.current_goal,
      panel_id: panelId,
      page_number: panelIntent ? panelIntent.page_number : null
    },
    creator_contract: memory.creator_contract,
    current_work: {
      repository_phase: state.current_phase || null,
      episode_state: (state.episodes || {})[episodeId] || null,
      handoff: memory.handoff
    },
    panel_intent: panelIntent,
    context: {
      source_refs: sourceRefs,
      bible: bibleContext,
      canon_assets: canonAssets,
      narrative_threads: narrativeThreads,
      continuity,
      preferences,
      lessons,
      constraints
    },
    governance: {
      preflight_status: (discovery.preflight || {}).status || null,
      pending_human_decisions: pendingHumanDecisions,
      pending_gates: pendingGates
    },
    retrieval: {
      matched_characters: characters,
      matched_panel_id: panelId,
      omitted_counts: omittedCounts
    }
  };
}

function parseArgs(argv) {
  const args = { rootDir: process.cwd(), episodeId: null, panelId: null, task: null, output: null };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--episode') args.episodeId = argv[++index];
    else if (value === '--panel') args.panelId = argv[++index];
    else if (value === '--task') args.task = argv[++index];
    else if (value === '--output') args.output = argv[++index];
    else if (value === '--help') args.help = true;
    else throw new Error(`unknown option: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/build-creation-context.js [--episode EP001] [--panel p15-3] [--task TEXT] [--output FILE]\n\nBuild a derived Creation Context Pack from CLE3's durable creation memory and current episode state.`);
}

function main() {
  try {
    const args = parseArgs(process.argv);
    if (args.help) return printHelp();
    const context = buildCreationContext(args);
    const serialized = `${JSON.stringify(context, null, 2)}\n`;
    if (args.output) {
      const outputPath = path.resolve(args.rootDir, args.output);
      if (!isSafeRepoPath(args.rootDir, path.relative(args.rootDir, outputPath))) {
        throw new Error('output path must stay inside the repository');
      }
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, serialized);
      console.log(path.relative(args.rootDir, outputPath));
    } else {
      process.stdout.write(serialized);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  buildCreationContext,
  isSafeRepoPath,
  normalizeName,
  scopeMatches,
  validateSeriesBible,
  validateCreationMemory
};
