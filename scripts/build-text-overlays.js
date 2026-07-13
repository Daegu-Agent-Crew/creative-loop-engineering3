#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function parseArgs(argv) {
  const args = { episode: 'EP001', generatedOnly: false };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--episode') args.episode = argv[++index];
    else if (value === '--generated-only') args.generatedOnly = true;
  }
  return args;
}

function splitMarkdownRow(line) {
  if (!line.trim().startsWith('|')) return null;
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  return cells.length >= 6 ? cells : null;
}

function cleanText(value) {
  return value
    .replace(/\*\*/g, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/^\((독백|나레이션|효과음)\)\s*:?\s*/, '')
    .replace(/^목소리\s*:\s*/, '목소리: ')
    .trim();
}

function isEmptyDialogue(value) {
  return !value || /\(없음\)|대사 없음|글자만|^\s*-+\s*$/.test(value);
}

function kindForText(raw) {
  if (/아빠 사랑해요|손떨림 글씨|관측 노트|노트|쪽지|크레온|글씨/.test(raw)) return 'note';
  if (/효과음|벨 소리|뚜|왜\?/.test(raw)) return 'sfx';
  if (/나레이션|하단|중앙|글씨/.test(raw)) return 'caption';
  if (/독백/.test(raw)) return 'narration';
  return 'dialogue';
}

function boxFor(kind, offset, raw = '') {
  if (kind === 'sfx') return { x: 0.18, y: 0.34 + offset * 0.16, w: 0.64, h: 0.18 };
  if (kind === 'note' && /하늘이 거짓말|관측 노트|마지막 페이지/.test(raw)) return { x: 0.2, y: 0.38 + offset * 0.12, w: 0.6, h: 0.12 };
  if (kind === 'note') return { x: 0.18, y: 0.68 + offset * 0.12, w: 0.64, h: 0.1 };
  if (kind === 'caption') return { x: 0.12, y: 0.06 + offset * 0.12, w: 0.76, h: 0.1 };
  if (kind === 'narration') return { x: 0.1, y: 0.08 + offset * 0.13, w: 0.8, h: 0.12 };
  return { x: 0.08, y: 0.06 + offset * 0.14, w: 0.52, h: 0.12 };
}

function extractScriptText(rootDir, episodeId) {
  const scriptPath = path.join(rootDir, 'episodes', episodeId, 'script', 'script.md');
  if (!fs.existsSync(scriptPath)) return new Map();
  const textByPanel = new Map();
  const lines = fs.readFileSync(scriptPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const cells = splitMarkdownRow(line);
    if (!cells) continue;
    if (!/^\d+-\d+$/.test(cells[0])) continue;
    const panelId = `p${cells[0]}`;
    const rawDialogue = cells[3] || '';
    if (isEmptyDialogue(rawDialogue)) continue;
    const text = cleanText(rawDialogue);
    if (!text) continue;
    textByPanel.set(panelId, {
      kind: kindForText(rawDialogue),
      text
    });
  }
  return textByPanel;
}

function extractDescriptionText(description) {
  const patterns = [
    /(손떨림\s+글씨|글씨|노트)\s*:\s*['"“”‘’]([^'"“”‘’]+)['"“”‘’]/,
    /(대사|독백|나레이션|배경 대사)\s*:\s*['"“”‘’]([^'"“”‘’]+)['"“”‘’]/,
    /중앙\s+흰\s+글씨\s*:\s*['"“”‘’]([^'"“”‘’]+)['"“”‘’]/,
    /([가-힣0-9A-Za-z.?!…\- ]+)\s*['"“”‘’]([^'"“”‘’]+)['"“”‘’]/
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      const raw = match[2] || match[1];
      const label = match[1] || '';
      return { kind: kindForText(`${label} ${raw}`), text: cleanText(raw) };
    }
  }
  return null;
}

function build(rootDir, episodeId, generatedOnly) {
  const panelsPath = path.join(rootDir, 'episodes', episodeId, 'panels', 'panels.json');
  const outputPath = path.join(rootDir, 'episodes', episodeId, 'panels', 'text-overlays.json');
  const panelsJson = readJson(panelsPath);
  const scriptText = extractScriptText(rootDir, episodeId);
  const existingByPanel = new Map();
  if (fs.existsSync(outputPath)) {
    const existing = readJson(outputPath);
    for (const panel of existing.panels || []) existingByPanel.set(panel.panel_id, panel);
  }

  const panels = (panelsJson.panels || [])
    .filter((panel) => !generatedOnly || ['generated', 'approved', 'selected'].includes(panel.generation_status))
    .map((panel) => {
      const existing = existingByPanel.get(panel.panel_id);
      if (existing && ['approved', 'embedded_text', 'needs_review'].includes(existing.status)) {
        return {
          ...existing,
          page_number: panel.page_number,
          source_image_path: panel.image_path,
          final_image_path: existing.final_image_path || `episodes/${episodeId}/panels/final/${panel.panel_id}.svg`
        };
      }
      const fromScript = scriptText.get(panel.panel_id);
      const fromDescription = extractDescriptionText(panel.description || '');
      const textItem = fromScript || fromDescription;
      const overlays = textItem ? [{
        kind: textItem.kind,
        text: textItem.text,
        box: boxFor(textItem.kind, 0, `${panel.description || ''} ${textItem.text || ''}`)
      }] : [];
      const finalImagePath = `episodes/${episodeId}/panels/final/${panel.panel_id}.svg`;
      return {
        panel_id: panel.panel_id,
        page_number: panel.page_number,
        source_image_path: panel.image_path,
        final_image_path: finalImagePath,
        status: overlays.length ? 'draft' : 'rendered',
        notes: overlays.length ? 'Auto-extracted from script.md or panel description; review position before approval.' : 'No text overlay required.',
        overlays
      };
    });

  const result = {
    episode_id: episodeId,
    version: 1,
    panels
  };
  writeJson(outputPath, result);
  return result;
}

const args = parseArgs(process.argv);
const result = build(process.cwd(), args.episode, args.generatedOnly);
console.log(`text overlays ${result.episode_id}: ${result.panels.length}`);
