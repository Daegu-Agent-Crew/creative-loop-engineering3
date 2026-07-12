#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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
    writePlan: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--episode') args.episode = argv[++index];
    else if (value === '--max-jobs') args.maxJobs = Number(argv[++index]);
    else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--write-plan') args.writePlan = true;
    else if (value === '--help') args.help = true;
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/run-panel-jobs.js [--episode EP002] [--max-jobs 3] [--dry-run] [--write-plan]

Select the next runnable page jobs under CLE3 Phase 4 policy.

This runner is intentionally deterministic. It chooses work, validates inputs,
honors low-performance worker settings and concurrency limits, and writes an
operator plan. Image generation itself is still performed by Codex imagegen,
one image per request, using the emitted commands.`);
}

function panelGenerated(rootDir, panel) {
  return panel.image_path && exists(path.join(rootDir, panel.image_path));
}

function panelRunnable(rootDir, panel) {
  if (!panel || panelGenerated(rootDir, panel)) return false;
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

function runnablePanels(rootDir, job, panelsById) {
  return job.panel_ids
    .map((panelId) => panelsById.get(panelId))
    .filter((panel) => panelRunnable(rootDir, panel));
}

function selectJobs(rootDir, policy, jobsJson, panelsJson, maxJobs) {
  const panelsById = new Map((panelsJson.panels || []).map((panel) => [panel.panel_id, panel]));
  const selected = [];
  let normalSlots = policy.scheduling.normal_parallel_limit;
  let complexSlots = policy.scheduling.complex_parallel_limit;
  let totalSlots = policy.scheduling.max_total_in_flight;

  for (const job of jobsJson.jobs || []) {
    if (maxJobs !== null && selected.length >= maxJobs) break;
    if (totalSlots <= 0) break;
    if (['completed', 'blocked', 'running', 'in_progress', 'escalated'].includes(job.status)) continue;

    const panels = runnablePanels(rootDir, job, panelsById);
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
      panel_ids: panels.map((panel) => panel.panel_id),
      commands: panels.map((panel) => ({
        panel_id: panel.panel_id,
        image_path: panel.image_path,
        command: `codex exec --sandbox workspace-write '$imagegen: ${panel.generation_prompt.replace(/'/g, "'\\''")} Save to ${panel.image_path}'`
      }))
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
  const selected = selectJobs(rootDir, policy, jobsJson, panelsJson, args.maxJobs);

  const plan = {
    episode_id: args.episode,
    dry_run: args.dryRun,
    selected_at: new Date().toISOString(),
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

main();
