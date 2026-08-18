#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { resolveReferenceChain } = require('./build-reference-chain');
const { buildCreationContext } = require('./build-creation-context');
const { compileCreationRequestCard } = require('./build-creation-request');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function parseArgs(argv) {
  const args = {
    episode: 'EP001',
    maxJobs: null,
    dryRun: false,
    writePlan: false,
    panelId: null,
    variants: 1,
    maxIterations: 1,
    iteration: 1,
    diagnosis: null
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--episode') args.episode = argv[++index];
    else if (value === '--max-jobs') args.maxJobs = Number(argv[++index]);
    else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--write-plan') args.writePlan = true;
    else if (value === '--panel') args.panelId = argv[++index];
    else if (value === '--variants') args.variants = Number(argv[++index]);
    else if (value === '--max-iterations') args.maxIterations = Number(argv[++index]);
    else if (value === '--iteration') args.iteration = Number(argv[++index]);
    else if (value === '--diagnosis') args.diagnosis = argv[++index];
    else if (value === '--help') args.help = true;
    else throw new Error(`unknown option: ${value}`);
  }

  if (args.maxJobs !== null && (!Number.isInteger(args.maxJobs) || args.maxJobs < 1)) {
    throw new Error('--max-jobs must be a positive integer');
  }
  if (!Number.isInteger(args.variants) || args.variants < 1 || args.variants > 3) {
    throw new Error('--variants must be an integer from 1 to 3');
  }
  if (!Number.isInteger(args.maxIterations) || args.maxIterations < 1 || args.maxIterations > 3) {
    throw new Error('--max-iterations must be an integer from 1 to 3');
  }
  if (!Number.isInteger(args.iteration) || args.iteration < 1 || args.iteration > args.maxIterations) {
    throw new Error('--iteration must be between 1 and --max-iterations');
  }
  if (args.iteration > 1 && !args.diagnosis) {
    throw new Error('--diagnosis is required after the first iteration');
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/run-panel-jobs.js [--episode EP002] [--panel p2-3] [--max-jobs 3] [--variants 2] [--max-iterations 2] [--iteration 1] [--diagnosis TEXT] [--dry-run] [--write-plan]

Select the next runnable page jobs under CLE3 Phase 4 policy.

This runner is intentionally deterministic. It chooses work, validates inputs,
honors low-performance worker settings and concurrency limits, and writes an
operator plan. Image generation itself is still performed by Codex imagegen,
one image per request, using the emitted commands. Variants are written under
.candidates/ until an evaluator promotes one selected image.`);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function panelGenerated(rootDir, panel) {
  return panel.image_path && exists(path.join(rootDir, panel.image_path));
}

function panelRunnable(rootDir, panel, allowGenerated) {
  if (!panel) return false;
  if (allowGenerated && panelGenerated(rootDir, panel)) return true;
  if (panelGenerated(rootDir, panel)) return false;
  return ['pending', 'ready', 'failed', 'retry_ready'].includes(panel.generation_status || 'pending');
}

function complexityForJob(job, panelsById) {
  if (job.complexity) return job.complexity;
  const panels = job.panel_ids.map((panelId) => panelsById.get(panelId)).filter(Boolean);
  const complex = panels.some((panel) => {
    const refs = panel.reference_assets || [];
    const cast = panel.characters_in_frame || [];
    const description = panel.description || '';
    return refs.length >= 3 || cast.length >= 2 || /몽타주|풀페이지|풀 페이지|군중|전투|기계/.test(description);
  });
  if (complex) return 'complex';
  if (panels.length >= 4) return 'standard';
  return 'simple';
}

function runnablePanels(rootDir, job, panelsById, options) {
  return job.panel_ids
    .map((panelId) => panelsById.get(panelId))
    .filter((panel) => !options.panelId || panel.panel_id === options.panelId)
    .filter((panel) => panelRunnable(rootDir, panel, Boolean(options.panelId)));
}

function variantDirection(variant) {
  return [
    'Prioritize strict storyboard fidelity and clear focal hierarchy.',
    'Prioritize emotional readability while preserving the same story action and cast.',
    'Prioritize continuity with the attached character and approved panel references.'
  ][variant - 1];
}

function candidatePath(episodeId, panelId, iteration, variant) {
  return path.posix.join(
    '.candidates',
    episodeId,
    panelId,
    `iteration-${String(iteration).padStart(2, '0')}`,
    `${panelId}-v${String(variant).padStart(2, '0')}.png`
  );
}

function generationCommand(panel, episodeId, iteration, variant, candidateMode, diagnosis, referenceChain, creationRequest) {
  const outputPath = candidateMode
    ? candidatePath(episodeId, panel.panel_id, iteration, variant)
    : panel.image_path;
  const references = (referenceChain || []).map((item) => item.asset_path);
  const imageArgs = references.map((reference) => `-i ${shellQuote(reference)}`).join(' ');
  const prompt = [
    panel.generation_prompt,
    '',
    creationRequest.compiled_prompt,
    '',
    '--- CONVERGENCE VARIANT ---',
    `Iteration: ${iteration}`,
    `Variant: ${variant}`,
    variantDirection(variant),
    diagnosis ? `Previous evaluator diagnosis to correct: ${diagnosis}` : null,
    'Do not render dialogue, captions, letters, or numbers; text is added in post-processing.',
    `Save to ${outputPath}`
  ].filter(Boolean).join('\n');
  const prefix = imageArgs ? `codex ${imageArgs} exec` : 'codex exec';
  return {
    candidate_id: `${panel.panel_id}-i${iteration}-v${variant}`,
    iteration,
    variant,
    output_path: outputPath,
    references_attached: references,
    command: `${prefix} --sandbox workspace-write ${shellQuote(`$imagegen: ${prompt}`)}`
  };
}

function evaluationCommand(panel, episodeId, iteration, variants) {
  const candidates = [];
  for (let variant = 1; variant <= variants; variant += 1) {
    candidates.push(candidatePath(episodeId, panel.panel_id, iteration, variant));
  }
  const blindedOrder = iteration % 2 === 0 ? candidates : [...candidates].reverse();
  const imageArgs = blindedOrder.map((candidate) => `-i ${shellQuote(candidate)}`).join(' ');
  const outputPath = path.posix.join(
    '.candidates', episodeId, panel.panel_id,
    `iteration-${String(iteration).padStart(2, '0')}`,
    'evaluation.json'
  );
  const prompt = [
    'Evaluate the attached CLE3 panel candidates without inferring quality from attachment order or filenames.',
    `Episode: ${episodeId}`,
    `Panel: ${panel.panel_id}`,
    `Storyboard: ${panel.description}`,
    `Baseline image: ${panel.image_path}`,
    'Score character consistency, storyboard fidelity, composition, style consistency, and scene continuity from 0 to 10.',
    'Apply the absolute gate first: below 35 is rejected; 35-41 requires review; 42+ may be approved.',
    'Then return winner, tie, or both_bad with a concrete reason and one next-prompt adjustment.',
    'Return the complete JSON document required by schemas/candidates-schema.json.'
  ].join('\n');
  return {
    panel_id: panel.panel_id,
    iteration,
    candidate_order: blindedOrder,
    output_path: outputPath,
    command: `codex ${imageArgs} exec --sandbox workspace-write --output-schema schemas/candidates-schema.json -o ${shellQuote(outputPath)} ${shellQuote(prompt)}`
  };
}

function selectJobs(rootDir, policy, jobsJson, panelsJson, preferenceMemory, options) {
  const panelsById = new Map((panelsJson.panels || []).map((panel) => [panel.panel_id, panel]));
  const selected = [];
  let normalSlots = policy.scheduling.normal_parallel_limit;
  let complexSlots = policy.scheduling.complex_parallel_limit;
  let totalSlots = policy.scheduling.max_total_in_flight;

  for (const job of jobsJson.jobs || []) {
    if (options.maxJobs !== null && selected.length >= options.maxJobs) break;
    if (totalSlots <= 0) break;
    if (!options.panelId && ['completed', 'blocked', 'running', 'in_progress', 'escalated'].includes(job.status)) continue;

    const panels = runnablePanels(rootDir, job, panelsById, options);
    if (panels.length === 0) continue;

    const complexity = complexityForJob(job, panelsById);
    if (complexity === 'complex') {
      if (complexSlots <= 0) continue;
      complexSlots -= 1;
    } else {
      if (normalSlots <= 0) continue;
      normalSlots -= 1;
    }

    selected.push({
      job_id: job.job_id,
      page_number: job.page_number,
      complexity,
      status: job.status,
      worker_tier: policy.models.worker_tier,
      image_model: policy.models.image_model,
      qa_tier: policy.models.qa_tier,
      decision: {
        rationale: job.decision_rationale || '필수 입력과 실행 슬롯이 준비된 다음 페이지 작업을 선택한다.',
        confidence: job.confidence || 'medium',
        assumptions: job.assumptions || [],
        uncertainties: job.uncertainties || [],
        references_used: job.references_used || job.character_refs || [],
        human_approval_required: Boolean(job.human_approval_required),
        escalation_reason: job.escalation_reason || null
      },
      panel_ids: panels.map((panel) => panel.panel_id),
      commands: panels.flatMap((panel) => {
        const candidateMode = options.variants > 1 || options.maxIterations > 1;
        const creationContext = buildCreationContext({
          rootDir,
          episodeId: panelsJson.episode_id,
          panelId: panel.panel_id,
          task: `${panel.panel_id} 이미지 생성`
        });
        const creationRequest = compileCreationRequestCard(creationContext);
        const referenceChain = [...resolveReferenceChain(panel, preferenceMemory)];
        const knownReferences = new Set(referenceChain.map((item) => item.asset_path));
        creationRequest.references.forEach((item) => {
          if (!knownReferences.has(item.asset_path)) {
            referenceChain.push(item);
            knownReferences.add(item.asset_path);
          }
        });
        const commands = [];
        for (let variant = 1; variant <= options.variants; variant += 1) {
          commands.push({
            panel_id: panel.panel_id,
            image_path: panel.image_path,
            decision_reason: candidateMode
              ? '기존 패널을 기준선으로 유지하고 격리된 후보를 생성한다.'
              : '필수 패널 프롬프트와 출력 경로가 있고 기존 최종 이미지가 없다.',
            assumptions: [
              '현재 storyboard 설명과 CLE3 내부 참조 자산을 생성 기준으로 사용한다.',
              '최종 한글 텍스트는 후처리한다.'
            ],
            uncertainties: (panel.characters_in_frame || []).length >= 2
              ? ['다인물 배치와 캐릭터 외형 일관성을 생성 후 확인해야 한다.']
              : [],
            references_used: referenceChain.map((item) => item.asset_path),
            reference_chain: referenceChain,
            creation_request: creationRequest,
            ...generationCommand(panel, panelsJson.episode_id, options.iteration, variant, candidateMode, options.diagnosis, referenceChain, creationRequest)
          });
        }
        return commands;
      }),
      evaluation_commands: options.variants > 1
        ? panels.map((panel) => evaluationCommand(
          panel,
          panelsJson.episode_id,
          options.iteration,
          options.variants
        ))
        : []
    });
    totalSlots -= 1;
  }

  return selected;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const rootDir = process.cwd();
  const episodeDir = path.join(rootDir, 'episodes', args.episode, 'panels');
  const policy = readJson(path.join(rootDir, 'config', 'panel-generation-policy.json'));
  const jobsJson = readJson(path.join(episodeDir, 'generation-jobs.json'));
  const panelsJson = readJson(path.join(episodeDir, 'panels.json'));
  const preferenceMemoryPath = path.join(episodeDir, 'preference-memory.json');
  const preferenceMemory = exists(preferenceMemoryPath)
    ? readJson(preferenceMemoryPath)
    : { policy: { maximum_panel_references: 0 }, anchors: [] };
  if (args.panelId && !(panelsJson.panels || []).some((panel) => panel.panel_id === args.panelId)) {
    throw new Error(`unknown panel for ${args.episode}: ${args.panelId}`);
  }

  const selected = selectJobs(rootDir, policy, jobsJson, panelsJson, preferenceMemory, args);

  const plan = {
    episode_id: args.episode,
    dry_run: args.dryRun,
    selected_at: new Date().toISOString(),
    convergence: {
      panel_id: args.panelId,
      variants: args.variants,
      max_iterations: args.maxIterations,
      current_iteration: args.iteration,
      diagnosis_applied: args.diagnosis,
      evaluator_required: args.variants > 1 || args.maxIterations > 1,
      candidate_root: '.candidates/'
    },
    concurrency: {
      normal_parallel_limit: policy.scheduling.normal_parallel_limit,
      complex_parallel_limit: policy.scheduling.complex_parallel_limit,
      max_total_in_flight: policy.scheduling.max_total_in_flight
    },
    selected_jobs: selected
  };

  console.log(JSON.stringify(plan, null, 2));

  if (args.writePlan) {
    const planPath = path.join(episodeDir, 'next-generation-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
    console.error(`wrote ${path.relative(rootDir, planPath)}`);
  }
}

if (require.main === module) main();

module.exports = { generationCommand, selectJobs };
