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
  const generated = panels.filter((panel) => ['generated', 'qa_checking', 'approved', 'selected'].includes(panel.generation_status)).length;
  if (generated === 0) return 'ready';
  if (generated === panels.length) return 'completed';
  return 'partial';
}

function buildJobs(rootDir, episodeId) {
  const panelsPath = path.join(rootDir, 'episodes', episodeId, 'panels', 'panels.json');
  const outputPath = path.join(rootDir, 'episodes', episodeId, 'panels', 'generation-jobs.json');
  const policyPath = path.join(rootDir, 'config', 'panel-generation-policy.json');
  const panelsJson = readJson(panelsPath);
  const policyJson = readJson(policyPath);
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
    worker_tier: policyJson.models.worker_tier,
    image_model: policyJson.models.image_model,
    started_at: null,
    completed_at: null,
    generation_duration_seconds: null,
    qa_score: null,
    last_error: null,
    status: statusForPanels(panels),
    notes: 'Generate image panels without final Korean text. Apply dialogue/caption overlay in a later post-process step.'
  }));

  const result = {
    episode_id: episodeId,
    policy: {
      batch_strategy: policyJson.scheduling.batch_strategy,
      text_strategy: 'postprocess_overlay',
      parallel_limit: policyJson.scheduling.normal_parallel_limit,
      complex_parallel_limit: policyJson.scheduling.complex_parallel_limit,
      max_total_in_flight: policyJson.scheduling.max_total_in_flight,
      worker_tier: policyJson.models.worker_tier,
      image_model: policyJson.models.image_model,
      qa_tier: policyJson.models.qa_tier
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
