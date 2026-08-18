#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildCreationContext, isSafeRepoPath } = require('./build-creation-context');

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function factText(fact) {
  return `${fact.subject}.${fact.attribute}: ${fact.value}`;
}

function approved(items) {
  return (items || []).filter((item) => item.status === 'approved');
}

function validateCreationRequestCard(card, rootDir, options = {}) {
  const failures = [];
  if (!card || typeof card !== 'object') return ['creation request card must be an object'];
  if (card.schema_version !== 1) failures.push('schema_version must be 1');
  if (!/^EP\d{3}$/.test(card.episode_id || '')) failures.push('episode_id must match EP###');
  if (!/^p\d+-\d+$/.test(card.panel_id || '')) failures.push('panel_id is invalid');
  if (card.bible?.status !== 'approved') failures.push('bible.status must be approved');
  if (!card.bible?.id || !card.bible?.version) failures.push('bible id and version are required');
  ['state', 'delta', 'narrative_function', 'references', 'output_rules'].forEach((key) => {
    if (!Array.isArray(card[key])) failures.push(`${key} must be an array`);
  });
  ['delta', 'narrative_function', 'references', 'output_rules'].forEach((key) => {
    if (Array.isArray(card[key]) && card[key].length === 0) failures.push(`${key} must not be empty`);
  });
  if (!card.dna || typeof card.dna !== 'object') failures.push('dna is required');
  else ['visual_style', 'characters', 'locations', 'props', 'world_rules', 'prohibited_changes'].forEach((key) => {
    if (!Array.isArray(card.dna[key])) failures.push(`dna.${key} must be an array`);
  });
  if (typeof card.camera !== 'string' || !card.camera) failures.push('camera is required');
  if (!card.compiled_prompt?.includes('CLE3 APPROVED CREATION BIBLE')) failures.push('compiled approved Bible prompt is required');
  if (options.checkPaths !== false) {
    (card.references || []).forEach((reference, index) => {
      if (!reference || typeof reference !== 'object') {
        failures.push(`references[${index}] must be an object`);
        return;
      }
      if (reference.source !== 'approved_bible') failures.push(`references[${index}].source must be approved_bible`);
      if (!reference.anchor_id) failures.push(`references[${index}].anchor_id is required`);
      if (!isSafeRepoPath(rootDir, reference.asset_path)) failures.push(`references[${index}]: unsafe path ${reference.asset_path || '-'}`);
      else if (!fs.existsSync(path.join(rootDir, reference.asset_path))) failures.push(`references[${index}]: missing ${reference.asset_path}`);
    });
  }
  return failures;
}

function compileCreationRequestCard(context) {
  const bible = context.context.bible;
  if (!context.panel_intent) throw new Error('a panel-specific Creation Context Pack is required');
  if (!bible) throw new Error('series Bible is required');
  if (bible.status !== 'approved') throw new Error(`series Bible must be approved before creation (${bible.status})`);
  if (bible.visual_style?.status !== 'approved') throw new Error('visual style must be approved before creation');
  ['world_rules', 'characters', 'locations', 'props'].forEach((key) => {
    const pending = (bible[key] || []).find((item) => item.status !== 'approved');
    if (pending) throw new Error(`${key}.${pending.id} must be approved before creation`);
  });

  const characters = approved(bible.characters).map((item) => ({
    id: item.id,
    name: item.name,
    immutable_traits: item.immutable_traits,
    outfits: item.outfits || [],
    expressions: item.expressions || []
  }));
  const locations = approved(bible.locations).map((item) => ({
    id: item.id,
    label: item.label,
    immutable_traits: item.immutable_traits,
    lighting_states: item.lighting_states
  }));
  const props = approved(bible.props).map((item) => ({
    id: item.id,
    label: item.label,
    immutable_traits: item.immutable_traits,
    narrative_function: item.narrative_function
  }));
  const worldRules = approved(bible.world_rules);
  const transitions = context.context.continuity || [];
  const references = [];
  approved(bible.characters).forEach((item) => references.push({ asset_path: item.reference_asset, source: 'approved_bible', anchor_id: item.id }));
  locations.forEach((item) => {
    const source = bible.locations.find((candidate) => candidate.id === item.id);
    references.push({ asset_path: source.anchor_asset, source: 'approved_bible', anchor_id: item.id });
  });
  props.forEach((item) => {
    const source = bible.props.find((candidate) => candidate.id === item.id);
    references.push({ asset_path: source.anchor_asset, source: 'approved_bible', anchor_id: item.id });
  });
  const state = unique(transitions.flatMap((transition) => (transition.state_before || []).map(factText)));
  const transitionDelta = transitions.flatMap((transition) => (transition.delta || []).map(factText));
  const delta = unique([context.panel_intent.description, ...transitionDelta]);
  const narrativeFunction = unique([
    ...props.map((item) => item.narrative_function),
    ...(context.context.narrative_threads || []).map((item) => item.reader_question || item.summary)
  ]);
  if (!narrativeFunction.length) narrativeFunction.push(`독자가 ${context.panel_intent.description}의 의미를 명확히 이해하게 한다.`);
  const prohibitedChanges = unique([
    ...worldRules.flatMap((item) => item.prohibited_changes || []),
    ...transitions.flatMap((item) => item.risks || [])
  ]);
  const outputRules = unique([
    ...(bible.visual_style.rendering_rules || []),
    ...(bible.continuity_rules || []),
    ...(context.context.constraints || []).map((item) => item.rule)
  ]);

  const card = {
    schema_version: 1,
    episode_id: context.episode_id,
    panel_id: context.target.panel_id,
    bible: { id: bible.id, version: bible.version, status: bible.status },
    dna: {
      visual_style: [...(bible.visual_style.immutable_traits || []), ...(bible.visual_style.palette || [])],
      characters,
      locations,
      props,
      world_rules: worldRules.flatMap((item) => item.immutable_facts || []),
      prohibited_changes: prohibitedChanges
    },
    state,
    delta,
    camera: context.panel_intent.camera_angle || 'storyboard-defined',
    narrative_function: narrativeFunction,
    references,
    output_rules: outputRules,
    compiled_prompt: ''
  };

  const lines = [
    '--- CLE3 APPROVED CREATION BIBLE ---',
    `Bible: ${card.bible.id} v${card.bible.version} (${card.bible.status})`,
    `Panel: ${card.panel_id}`,
    `DNA / visual style: ${card.dna.visual_style.join('; ')}`,
    ...card.dna.characters.map((item) => `DNA / character ${item.name}: ${item.immutable_traits.join('; ')}`),
    ...card.dna.characters.flatMap((item) => item.outfits.map((outfit) => `DNA / outfit ${item.name} ${outfit.label}: ${outfit.immutable_traits.join('; ')}`)),
    ...card.dna.characters.flatMap((item) => item.expressions.map((expression) => `DNA / expression ${item.name} ${expression.label}: ${expression.visual_cues.join('; ')}`)),
    ...card.dna.locations.map((item) => `DNA / location ${item.label}: ${item.immutable_traits.join('; ')}; lighting ${item.lighting_states.join('; ')}`),
    ...card.dna.props.map((item) => `DNA / prop ${item.label}: ${item.immutable_traits.join('; ')}`),
    ...card.dna.world_rules.map((item) => `WORLD RULE: ${item}`),
    ...card.state.map((item) => `STATE: ${item}`),
    ...card.delta.map((item) => `DELTA: ${item}`),
    `CAMERA: ${card.camera}`,
    ...card.narrative_function.map((item) => `NARRATIVE FUNCTION: ${item}`),
    ...card.dna.prohibited_changes.map((item) => `DO NOT CHANGE: ${item}`),
    ...card.output_rules.map((item) => `OUTPUT RULE: ${item}`)
  ];
  card.compiled_prompt = lines.join('\n');
  return card;
}

function parseArgs(argv) {
  const args = { episodeId: 'EP001', panelIds: [], output: null, rootDir: process.cwd() };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--episode') args.episodeId = argv[++index];
    else if (value === '--panel') args.panelIds.push(argv[++index]);
    else if (value === '--panels') args.panelIds.push(...argv[++index].split(',').map((item) => item.trim()).filter(Boolean));
    else if (value === '--output') args.output = argv[++index];
    else throw new Error(`unknown option: ${value}`);
  }
  if (!args.panelIds.length) throw new Error('--panel or --panels is required');
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const cards = args.panelIds.map((panelId) => compileCreationRequestCard(buildCreationContext({
    rootDir: args.rootDir,
    episodeId: args.episodeId,
    panelId,
    task: `${panelId} 이미지 생성 요청 카드`
  })));
  const result = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    episode_id: args.episodeId,
    bible: cards[0].bible,
    cards
  };
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (!args.output) return process.stdout.write(serialized);
  if (!isSafeRepoPath(args.rootDir, args.output)) throw new Error('output path must stay inside the repository');
  const outputPath = path.resolve(args.rootDir, args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized);
  console.log(path.relative(args.rootDir, outputPath));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exit(1); }
}

module.exports = { compileCreationRequestCard, validateCreationRequestCard };
