#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { repoFile, releaseReadiness } = require('./release-readiness');

const read = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const timestamp = (value) => typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));

// The queue schema deliberately uses only this small supported JSON Schema subset.
function validateSchema(value, schema, label = 'queue', failures = []) {
  const fail = (message) => failures.push(`${label}: ${message}`);
  if (schema.type) {
    const valid = schema.type === 'array' ? Array.isArray(value) : schema.type === 'object'
      ? value !== null && typeof value === 'object' && !Array.isArray(value)
      : schema.type === 'integer' ? Number.isInteger(value) : typeof value === schema.type;
    if (!valid) { fail(`expected ${schema.type}`); return failures; }
  }
  if ('const' in schema && value !== schema.const) fail('invalid constant');
  if (schema.enum && !schema.enum.includes(value)) fail('invalid enum');
  if (schema.minLength && value.trim().length < schema.minLength) fail('empty string');
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('invalid pattern');
  if (schema.format === 'date-time' && !timestamp(value)) fail('invalid timestamp');
  if (schema.minimum !== undefined && value < schema.minimum) fail('below minimum');
  if (schema.type === 'array') {
    if (value.length < (schema.minItems || 0)) fail('too few items');
    value.forEach((item, i) => validateSchema(item, schema.items, `${label}[${i}]`, failures));
  }
  if (schema.type === 'object') {
    for (const key of schema.required || []) if (!(key in value)) fail(`missing ${key}`);
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) validateSchema(item, schema.properties[key], `${label}.${key}`, failures);
      else if (schema.additionalProperties === false) fail(`unexpected ${key}`);
    }
  }
  return failures;
}

function validateQueue(root, queue, policy) {
  const failures = validateSchema(queue, read(root, 'schemas/decision-queue.schema.json'));
  if (failures.length) return failures;
  if (!/^[\w.-]+\/[\w.-]+$/.test(policy.repository || '')) failures.push('policy.repository required');
  if (!Number.isInteger(policy.max_unapproved_prs) || policy.max_unapproved_prs < 1) failures.push('invalid WIP limit');
  if (!Number.isFinite(policy.review_sla_hours) || policy.review_sla_hours <= 0) failures.push('invalid review SLA');
  if (!Array.isArray(policy.required_checks) || !policy.required_checks.length ||
      policy.required_checks.some((name) => typeof name !== 'string' || !name.trim())) failures.push('required checks missing');
  const ids = new Set();
  const targets = new Set();
  const state = read(root, 'state.json');
  for (const item of queue.items) {
    const fail = (message) => failures.push(`${item.id}: ${message}`);
    if (ids.has(item.id)) fail('duplicate id');
    ids.add(item.id);
    const target = `${item.kind}:${item.source_path}:${item.gate_id || item.pr_number || ''}`;
    if (targets.has(target)) fail('duplicate decision target');
    targets.add(target);
    if (!policy.owners?.[item.owner]?.trim()) fail('unknown owner');
    if (!state.episodes[item.episode_id]) fail('unknown episode');
    if (Date.parse(item.due_at) < Date.parse(item.waiting_since)) fail('deadline precedes waiting time');
    for (const file of [item.source_path, ...item.evidence, ...(item.resolution?.evidence || [])]) {
      if (!repoFile(root, file)) fail(`missing or unsafe evidence: ${file}`);
    }
    if (item.status === 'resolved' && !item.resolution) fail('resolution requires human decision and evidence');
    if (item.status === 'pending' && item.resolution) fail('pending item cannot have resolution');
    if (item.resolution && Date.parse(item.resolution.decided_at) < Date.parse(item.waiting_since)) fail('decision precedes request');
    if (item.kind === 'merge' && !item.pr_number) fail('PR number required');
    if (item.kind === 'gate') {
      if (item.source_path !== `episodes/${item.episode_id}/approvals/gates.json`) fail('gate must reference canonical approvals');
      if (!repoFile(root, item.source_path)) continue;
      const gate = read(root, item.source_path).gates?.find((gate) => gate.id === item.gate_id);
      if (!gate) fail('unknown gate');
      // A queue entry is never an alternative approval ledger.
      if (item.status === 'resolved' && !['approved', 'changes_requested', 'not_applicable'].includes(gate?.status)) {
        fail('canonical gate has no human decision');
      }
    }
  }
  return failures;
}

function getGithub(policy, exec = execFileSync) {
  const fields = 'number,state,url,createdAt,headRefOid,mergeable,reviewDecision,statusCheckRollup';
  try {
    const prs = JSON.parse(exec('gh', ['pr', 'list', '--repo', policy.repository, '--state', 'open', '--limit', '1000', '--json', fields], {
      encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024
    }));
    if (!Array.isArray(prs) || prs.length >= 1000) throw new Error('incomplete PR inventory');
    return { status: 'available', observed_at: new Date().toISOString(), prs };
  } catch {
    // Never turn an API failure or partial inventory into a green status / zero WIP.
    return { status: 'unavailable', observed_at: new Date().toISOString(), prs: null };
  }
}

function validationStatus(pr, requiredChecks) {
  if (!pr?.headRefOid || !Array.isArray(pr.statusCheckRollup)) return 'unknown';
  const checks = pr.statusCheckRollup;
  const state = (check) => check.__typename === 'StatusContext' || check.context
    ? check.state : check.status === 'COMPLETED' ? check.conclusion : 'PENDING';
  if (checks.some((check) => ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'STALE'].includes(state(check)))) return 'failed';
  if (!requiredChecks.every((name) => checks.some((check) => (check.name || check.context) === name))) return 'unknown';
  if (!checks.length || checks.some((check) => state(check) !== 'SUCCESS')) return 'pending';
  return 'passed';
}

function reviewCapacity(github, policy) {
  if (github.status !== 'available' || !Array.isArray(github.prs)) return { status: 'unknown', count: null, limit: policy.max_unapproved_prs, action: 'verify_github_before_generation' };
  const count = github.prs.filter((pr) => pr.state === 'OPEN' && pr.reviewDecision !== 'APPROVED').length;
  return { status: count >= policy.max_unapproved_prs ? 'hold' : 'available', count, limit: policy.max_unapproved_prs,
    action: count >= policy.max_unapproved_prs ? 'review_existing_work' : 'generation_allowed' };
}

function buildReport(root, queue, policy, github = { status: 'not_checked', prs: null }, now = new Date()) {
  const state = read(root, 'state.json');
  const releases = Object.fromEntries([...new Set(queue.items.map((item) => item.episode_id))]
    .map((id) => [id, releaseReadiness(root, id)]));
  const items = queue.items.map((item) => {
    const source = item.kind === 'gate' ? read(root, item.source_path).gates.find((gate) => gate.id === item.gate_id) : null;
    const prerequisite = item.prerequisite === 'phase5_completed' && state.episodes[item.episode_id]?.phases?.phase5?.status !== 'completed';
    const pr = item.kind === 'merge' ? github.prs?.find((pr) => pr.number === item.pr_number) : null;
    let status = item.status;
    if (status === 'pending' && source && ['approved', 'changes_requested', 'not_applicable'].includes(source.status)) status = 'source_decided_sync_required';
    if (status === 'pending' && prerequisite) status = 'waiting_prerequisite';
    if (item.kind === 'merge' && item.status === 'pending' && github.status === 'available' && !pr) status = 'not_open_verify_outcome';
    const overdue = status === 'pending' && now.getTime() >= Date.parse(item.due_at);
    const validation = item.kind === 'merge' ? validationStatus(pr, policy.required_checks) : null;
    return { ...item, owner_label: policy.owners[item.owner], status, source_status: source?.status || null, overdue,
      waiting_hours: Math.max(0, Math.floor((now.getTime() - Date.parse(item.waiting_since)) / 3600000)),
      ...(item.kind === 'merge' ? { validation, head_sha: pr?.headRefOid || null,
        check_evidence: pr?.statusCheckRollup || [],
        merge: !pr ? 'unknown' : pr.mergeable === 'CONFLICTING' || pr.reviewDecision === 'CHANGES_REQUESTED' || validation === 'failed'
          ? 'blocked' : validation === 'passed' && pr.mergeable === 'MERGEABLE' ? 'human_decision_required' : 'waiting_checks',
        human_review: pr?.reviewDecision || 'not_recorded' } : {}) };
  });
  return { observed_at: now.toISOString(), github_status: github.status, github_observed_at: github.observed_at || null,
    wip: reviewCapacity(github, policy), releases, items };
}

function markdown(report) {
  const safe = (s) => String(s ?? '-').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const lines = ['# CLE3 결정 대기', '', `관측 시각: ${report.observed_at}; GitHub: ${report.github_status}`, '',
    `신규 생성: ${report.wip.status}; 미승인 PR ${report.wip.count ?? '미확인'}/${report.wip.limit}.`, '',
    'CI 통과는 병합 또는 공개 승인이 아니다. 아래 완료 여부는 원본 게이트·파일과 별도로 읽는다.', '',
    '| 항목 | 담당자 | 상태 / 기한 초과 | 요청하는 결정 | 대기 시작 | 결정 기한 | 기한 초과 시 처리 |',
    '|---|---|---|---|---|---|---|'];
  for (const item of report.items) lines.push(`| ${safe(item.id)} | ${safe(item.owner_label)} | ${safe(item.status)}${item.overdue ? ' / 초과' : ''} | ${safe(item.request)} | ${safe(item.waiting_since)} (${safe(item.waiting_since_basis)}) | ${safe(item.due_at)} | ${safe(item.overdue_action)} |`);
  for (const item of report.items.filter((item) => item.kind === 'merge')) {
    lines.push('', `PR #${item.pr_number}: 검증 **${item.validation}**, 병합 **${item.merge}**, 사람 리뷰 **${item.human_review}**; SHA ${item.head_sha || '미확인'}.`);
  }
  for (const [id, release] of Object.entries(report.releases)) {
    lines.push('', `${id} 공개 사전조건: **${release.status}** (원본 승인 ${release.approval}).`,
      ...(release.blockers.length ? release.blockers.map((reason) => `- ${reason}`) : ['- 기존 승인·QA·산출물 조건 충족. 실제 배포 수행을 의미하지 않음.']));
  }
  lines.push('', '증거:', ...report.items.map((item) => `- ${item.id}: ${[item.source_path, ...item.evidence].map((p) => '`' + p + '`').join(', ')}`));
  return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    console.log('Usage: node scripts/decision-status.js [--github] [--json] [--validate] [--check-start]\nRead-only. --check-start requires live GitHub and exits 2 on a WIP hold or unavailable inventory.');
    return;
  }
  for (const arg of argv) if (!['--github', '--json', '--validate', '--check-start'].includes(arg)) throw new Error(`unknown option: ${arg}`);
  const root = process.cwd();
  const queue = read(root, 'operations/decision-queue.json');
  const policy = read(root, 'config/decision-policy.json');
  const failures = validateQueue(root, queue, policy);
  if (failures.length) throw new Error(failures.join('\n'));
  if (argv.includes('--validate')) { console.log('decision queue schema and evidence validation passed'); return; }
  const github = argv.includes('--github') || argv.includes('--check-start') ? getGithub(policy) : { status: 'not_checked', prs: null };
  const report = buildReport(root, queue, policy, github);
  console.log(argv.includes('--json') ? JSON.stringify(report, null, 2) : markdown(report));
  if (argv.includes('--check-start') && report.wip.status !== 'available') process.exitCode = 2;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validateQueue, getGithub, validationStatus, reviewCapacity, buildReport, markdown };
