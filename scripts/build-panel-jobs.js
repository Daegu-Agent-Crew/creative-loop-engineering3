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

function baseCharacterName(value) {
  return String(value || '').split(/[（(]/)[0].trim();
}

function decisionContext(panels, complexity, references, knownCharacterNames) {
  const missingReference = panels.some((panel) =>
    (panel.characters_in_frame || []).some((name) => knownCharacterNames.has(baseCharacterName(name))) &&
    (panel.reference_assets || []).length === 0
  );
  const uncertainty = [];
  if (complexity === 'complex') uncertainty.push('다인물 또는 복합 구도는 생성 후 인접 패널 일관성 QA가 필요하다.');
  if (missingReference) uncertainty.push('등장인물이 있지만 연결된 캐릭터 참조 자산이 없는 패널이 있다.');

  return {
    decision_rationale: `같은 페이지의 ${panels.length}개 패널을 장면, 조명, 캐릭터 연속성을 공유하는 작업 그룹으로 선택한다.`,
    confidence: missingReference ? 'low' : (complexity === 'complex' ? 'medium' : 'high'),
    assumptions: [
      'storyboard와 characters의 현재 버전을 Phase 4 기준선으로 사용한다.',
      '이미지에는 최종 한글 텍스트를 넣지 않고 후처리 오버레이를 적용한다.'
    ],
    uncertainties: uncertainty,
    references_used: references,
    human_approval_required: missingReference,
    escalation_reason: missingReference ? 'missing_character_reference' : null
  };
}

function buildJobs(rootDir, episodeId) {
  const panelsPath = path.join(rootDir, 'episodes', episodeId, 'panels', 'panels.json');
  const outputPath = path.join(rootDir, 'episodes', episodeId, 'panels', 'generation-jobs.json');
  const policyPath = path.join(rootDir, 'config', 'panel-generation-policy.json');
  const panelsJson = readJson(panelsPath);
  const policyJson = readJson(policyPath);
  const charactersPath = path.join(rootDir, 'episodes', episodeId, 'characters', 'characters.json');
  const charactersJson = fs.existsSync(charactersPath) ? readJson(charactersPath) : { characters: [] };
  const knownCharacterNames = new Set((charactersJson.characters || []).map((character) => baseCharacterName(character.name)));
  const previous = fs.existsSync(outputPath) ? readJson(outputPath) : { jobs: [] };
  const previousById = new Map((previous.jobs || []).map((job) => [job.job_id, job]));
  const pages = new Map();

  (panelsJson.panels || []).forEach((panel) => {
    const page = panel.page_number || 0;
    if (!pages.has(page)) pages.set(page, []);
    pages.get(page).push(panel);
  });

  const jobs = Array.from(pages.entries()).sort((a, b) => a[0] - b[0]).map(([pageNumber, panels]) => {
    const jobId = `${episodeId}-page-${String(pageNumber).padStart(2, '0')}`;
    const existing = previousById.get(jobId) || {};
    const references = unique(panels.flatMap((panel) => panel.reference_assets || []));
    const complexity = complexityForPanels(panels);
    const decision = decisionContext(panels, complexity, references, knownCharacterNames);
    return {
      job_id: jobId,
      page_number: pageNumber,
      panel_ids: panels.map((panel) => panel.panel_id),
      character_refs: references,
      complexity,
      text_overlay_required: true,
      retry_count: existing.retry_count || 0,
      worker_tier: policyJson.models.worker_tier,
      image_model: policyJson.models.image_model,
      started_at: existing.started_at || null,
      completed_at: existing.completed_at || null,
      generation_duration_seconds: existing.generation_duration_seconds == null ? null : existing.generation_duration_seconds,
      qa_score: existing.qa_score == null ? null : existing.qa_score,
      last_error: existing.last_error || null,
      status: statusForPanels(panels),
      ...decision,
      notes: 'Generate image panels without final Korean text. Apply dialogue/caption overlay in a later post-process step.'
    };
  });

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
