#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const STYLE_BLOCK = [
  'Bold clean ink linework, flat vibrant cell-shaded colors,',
  'rounded expressive character designs, dramatic but playful composition,',
  'distinctive 1980s Akira Toriyama manga aesthetic.',
  'Simple but expressive backgrounds with bold black shadows.',
  'Clean panel borders, dynamic perspective.'
].join('\n');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function normalizeToken(value) {
  return String(value || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim()
    .toLowerCase();
}

function buildCharacterAliasMap(characterList) {
  const map = new Map();

  characterList.forEach((character) => {
    const aliases = new Set();
    const rawName = String(character.name || '');
    aliases.add(rawName);
    aliases.add(rawName.split('(')[0]);
    aliases.add(rawName.split(' ')[0]);

    [rawName, rawName.split('(')[0], rawName.split(' ')[0]].forEach((item) => {
      const normalized = normalizeToken(item);
      if (normalized) {
        map.set(normalized, character);
      }
    });
  });

  [
    ['예원제', '예원제'],
    ['청신', '청신'],
    ['스치친', '스치친'],
    ['왕먀오', '왕먀오'],
    ['장베이하이', '장베이하이'],
    ['동료형사', null],
    ['동료 형사', null],
    ['예페이촨', null],
    ['양동', null],
    ['리밍', null],
    ['첸쑹', null],
    ['앵커', null],
    ['홍위병', null],
    ['라오충', null]
  ].forEach(([alias, canonicalName]) => {
    if (!canonicalName) return;
    const character = characterList.find((item) => String(item.name || '').indexOf(canonicalName) === 0);
    if (character) {
      map.set(normalizeToken(alias), character);
    }
  });

  return map;
}

function resolveCharacters(names, aliasMap) {
  return (names || [])
    .map((name) => aliasMap.get(normalizeToken(name)))
    .filter(Boolean)
    .filter((character, index, list) => list.indexOf(character) === index);
}

function buildCharacterBlock(characters) {
  if (!characters.length) {
    return 'No named recurring character reference. Focus on environment, props, typography, and mood continuity only.';
  }

  return characters.map((character) => {
    const refs = [];
    if (character.image_path) refs.push(`Reference asset: ${character.image_path}`);
    if (character.appearance) refs.push(`Appearance: ${character.appearance}`);
    if (character.style_notes) refs.push(`Style notes: ${character.style_notes}`);
    if (character.personality) refs.push(`Inner tone: ${character.personality}`);
    return `- ${character.name}: ${refs.join(' ')}`;
  }).join('\n');
}

function visualDirection(visualType) {
  if (visualType === 'impact') {
    return 'Prioritize dramatic contrast, stronger perspective, and a high-emphasis focal point.';
  }
  if (visualType === 'silence') {
    return 'Prioritize stillness, negative space, restrained acting, and quiet atmosphere.';
  }
  return 'Balance character readability, environment clarity, and story momentum.';
}

function panelTypeFromDescription(description) {
  if (/풀 페이지|풀페이지/.test(description || '')) return 'full-page splash';
  if (/소패널/.test(description || '')) return 'multi-cut montage';
  return 'single panel';
}

function buildPanelPrompt(episodeId, pageNumber, panel, referencedCharacters) {
  const castLine = (panel.characters_in_frame || []).length
    ? panel.characters_in_frame.join(', ')
    : 'none';

  return [
    STYLE_BLOCK,
    '',
    '--- SCENE ---',
    `Episode: ${episodeId}`,
    `Page: ${pageNumber}`,
    `Panel ID: ${panel.panel_id}`,
    `Storyboard description: ${panel.description || ''}`,
    `Visible cast: ${castLine}`,
    '',
    '--- CHARACTER REFERENCES ---',
    buildCharacterBlock(referencedCharacters),
    '',
    '--- COMPOSITION ---',
    `Camera: ${panel.camera_angle || 'medium'}`,
    `Panel type: ${panelTypeFromDescription(panel.description || '')}`,
    `Visual emphasis: ${panel.visual_type || 'normal'}`,
    visualDirection(panel.visual_type || 'normal'),
    '',
    '--- OUTPUT RULES ---',
    'Deliver one finished comic panel only, not a reference sheet.',
    'Keep the face, silhouette, costume, and color logic consistent with the referenced CLE3 character assets.',
    'Respect the storyboard beat exactly and keep the panel readable inside a serialized web-comic layout.'
  ].join('\n');
}

function buildManifest(episodeId, panelRecords) {
  const total = panelRecords.length;
  const generated = panelRecords.filter((panel) => panel.generation_status === 'generated').length;
  const pending = panelRecords.filter((panel) => panel.generation_status !== 'generated').length;

  return [
    `# ${episodeId} Panels Manifest`,
    '',
    '## 현재 상태',
    '',
    `- phase: phase4_panels`,
    `- total_panels: ${total}`,
    `- generated_panels: ${generated}`,
    `- pending_panels: ${pending}`,
    `- asset_dir: \`episodes/${episodeId}/panels/assets/\``,
    `- workflow_rule: CLE3 내부 storyboard + characters 산출물만 사용. 외부 저장소 생성 결과 재사용 금지.`,
    '',
    '## 작업 규칙',
    '',
    '- storyboard.json의 panel_id 순서를 기준으로 생성한다.',
    '- characters.json의 image_path를 패널 생성 참조 자산으로 사용한다.',
    '- 생성 이미지는 모두 `episodes/{EP}/panels/assets/`에 저장한다.',
    '- panels.json의 generation_prompt, reference_assets, generation_status를 함께 갱신한다.',
    '- 실제 패널이 생성되기 전까지는 target asset slot만 유지하고 placeholder 상태로 본다.',
    ''
  ].join('\n');
}

function syncEpisodePanels(rootDir, episodeId) {
  const storyboardPath = path.join(rootDir, 'episodes', episodeId, 'storyboard', 'storyboard.json');
  const charactersPath = path.join(rootDir, 'episodes', episodeId, 'characters', 'characters.json');
  const panelsDir = path.join(rootDir, 'episodes', episodeId, 'panels');
  const assetDir = path.join(panelsDir, 'assets');
  const panelsPath = path.join(panelsDir, 'panels.json');
  const manifestPath = path.join(panelsDir, 'MANIFEST.md');

  const storyboard = readJson(storyboardPath);
  const characters = readJson(charactersPath);
  const existingPanels = fs.existsSync(panelsPath) ? readJson(panelsPath) : { panels: [] };
  const existingById = new Map((existingPanels.panels || []).map((panel) => [panel.panel_id, panel]));
  const aliasMap = buildCharacterAliasMap(characters.characters || []);

  fs.mkdirSync(assetDir, { recursive: true });
  const gitkeepPath = path.join(assetDir, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '');
  }

  const panels = [];
  (storyboard.pages || []).forEach((page) => {
    (page.panels || []).forEach((panel) => {
      const refs = resolveCharacters(panel.characters_in_frame || [], aliasMap);
      const existing = existingById.get(panel.panel_id) || {};
      const targetImagePath = existing.image_path || `episodes/${episodeId}/panels/assets/${panel.panel_id}.png`;
      const absoluteImagePath = path.join(rootDir, targetImagePath);
      const generatedStatus = fs.existsSync(absoluteImagePath) ? 'generated' : (existing.generation_status || 'pending');
      panels.push({
        panel_id: panel.panel_id,
        page_number: page.page_number,
        description: panel.description || '',
        camera_angle: panel.camera_angle || '',
        visual_type: panel.visual_type || 'normal',
        characters_in_frame: panel.characters_in_frame || [],
        reference_assets: refs.map((character) => character.image_path).filter(Boolean),
        image_path: targetImagePath,
        generation_prompt: buildPanelPrompt(episodeId, page.page_number, panel, refs),
        style: 'dr-slump-toriyama',
        generation_status: generatedStatus,
        ai_score: existing.ai_score == null ? null : existing.ai_score,
        human_score: existing.human_score == null ? null : existing.human_score
      });
    });
  });

  writeJson(panelsPath, {
    episode_id: episodeId,
    panels,
    prompt_version: 'v2-toriyama-internal'
  });

  fs.writeFileSync(manifestPath, buildManifest(episodeId, panels), 'utf8');
  return { panels: panels.length, episodeId };
}

const rootDir = process.cwd();
const episodeId = process.argv[2] || 'EP001';
const result = syncEpisodePanels(rootDir, episodeId);
console.log(`synced ${result.episodeId}: ${result.panels} panels`);
