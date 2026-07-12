#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function unique(values) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function complexityForPanels(panels) {
  const multiCharacter = panels.some((panel) => (panel.characters_in_frame || []).length >= 2);
  const montage = panels.some((panel) => /소패널|몽타주/.test(panel.description || ''));
  const splash = panels.some((panel) => /풀 페이지|풀페이지/.test(panel.description || ''));
  if (multiCharacter || montage || splash) return 'complex';
  if (panels.length >= 4) return 'standard';
  return 'simple';
}

function statusForPanels(panels) {
  const generated = panels.filter((panel) => panel.generation_status === 'generated').length;
  if (generated === 0) return 'ready';
  if (generated === panels.length) return 'completed';
  return 'partial';
}

function buildJobs(rootDir, episodeId) {
  const panelsPath = path.join(rootDir, 'episodes', episodeId, 'panels', 'panels.json');
  const outputPath = path.join(rootDir, 'episodes', episodeId, 'panels', 'generation-jobs.json');
  const panelsJson = readJson(panelsPath);
  const pages = new Map();

  (panelsJson.panels || []).forEach((panel) => {
    const page = panel.page_number || 0;
    if (!pages.has(page)) pages.set(page, []);
    pages.get(page).push(panel);
  });

  const jobs = Array.from(pages.entries()).sort((a, b) => a[0] - b[0]).map(([pageNumber, panels]) => ({
    job_id: `${episodeId}-page-${String(pageNumber).padStart(2, '0')}`,
    page_number: pageNumber,
    panel_ids: panels.map((panel) => panel.panel_id),
    character_refs: unique(panels.flatMap((panel) => panel.reference_assets || [])),
    complexity: complexityForPanels(panels),
    text_overlay_required: true,
    retry_count: 0,
    status: statusForPanels(panels),
    notes: 'Generate image panels without final Korean text. Apply dialogue/caption overlay in a later post-process step.'
  }));

  const result = {
    episode_id: episodeId,
    policy: {
      batch_strategy: 'page',
      text_strategy: 'postprocess_overlay',
      parallel_limit: 3,
      complex_parallel_limit: 1
    },
    jobs
  };

  writeJson(outputPath, result);
  return result;
}

const rootDir = process.cwd();
const episodeId = process.argv[2] || 'EP001';
const result = buildJobs(rootDir, episodeId);
console.log(`jobs ${result.episode_id}: ${result.jobs.length}`);
