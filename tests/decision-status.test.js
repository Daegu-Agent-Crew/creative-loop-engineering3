const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { validateQueue, getGithub, validationStatus, reviewCapacity, buildReport } = require('../scripts/decision-status');
const { releaseReadiness } = require('../scripts/release-readiness');

const root = path.resolve(__dirname, '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const policy = read('config/decision-policy.json');
const queue = read('operations/decision-queue.json');
const pr = () => ({ number: 39, state: 'OPEN', headRefOid: 'abc123', mergeable: 'MERGEABLE', reviewDecision: '',
  statusCheckRollup: [{ name: 'validate-assets', status: 'COMPLETED', conclusion: 'SUCCESS' }] });

function queueFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cle3-queue-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (name, value) => {
    const target = path.join(dir, name); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(value));
  };
  const common = { episode_id: 'EP002', owner: 'cle3-maintainer', request: '검토 여부 결정', status: 'pending',
    waiting_since: '2026-09-08T00:00:00Z', waiting_since_basis: 'tracking_started', due_at: '2026-09-09T00:00:00Z',
    overdue_action: '해당 작업 보류', evidence: ['evidence.md'] };
  const data = { version: 1, items: [
    { ...common, id: 'pr-39-merge', kind: 'merge', pr_number: 39, source_path: 'evidence.md' },
    { ...common, id: 'ep002-release', kind: 'gate', gate_id: 'release', prerequisite: 'phase5_completed', source_path: 'episodes/EP002/approvals/gates.json' }
  ] };
  write('state.json', { episodes: { EP002: { phases: { phase4: { status: 'active' }, phase5: { status: 'pending' } } } } });
  write('evidence.md', 'fixture evidence');
  write('episodes/EP002/approvals/gates.json', { episode_id: 'EP002', gates: [{ id: 'release', status: 'pending' }] });
  write('schemas/decision-queue.schema.json', read('schemas/decision-queue.schema.json'));
  return { root: dir, queue: data };
}

test('CI success never implies a merge or release approval', (t) => {
  const f = queueFixture(t);
  const report = buildReport(f.root, f.queue, policy, { status: 'available', prs: [pr()] }, new Date('2026-09-10T00:00:00Z'));
  const merge = report.items.find((item) => item.id === 'pr-39-merge');
  assert.equal(merge.validation, 'passed');
  assert.equal(merge.merge, 'human_decision_required');
  assert.equal(merge.overdue, true);
  assert.equal(report.releases.EP002.status, 'blocked');
  const release = report.items.find((item) => item.id === 'ep002-release');
  assert.equal(release.status, 'waiting_prerequisite');
  assert.equal(release.overdue, false);
  assert.equal(f.queue.items.find((item) => item.id === 'pr-39-merge').status, 'pending');
});

test('missing, skipped, pending and failed checks are not successful checks', () => {
  assert.equal(validationStatus(null, policy.required_checks), 'unknown');
  assert.equal(validationStatus({ ...pr(), statusCheckRollup: [] }, policy.required_checks), 'unknown');
  for (const conclusion of ['SKIPPED', 'NEUTRAL', null]) {
    const value = pr(); value.statusCheckRollup[0].conclusion = conclusion;
    assert.equal(validationStatus(value, policy.required_checks), 'pending');
  }
  const value = pr(); value.statusCheckRollup[0].conclusion = 'FAILURE';
  assert.equal(validationStatus(value, policy.required_checks), 'failed');
  value.statusCheckRollup.push({ name: 'validate-assets', status: 'COMPLETED', conclusion: 'SUCCESS' });
  assert.equal(validationStatus(value, policy.required_checks), 'failed');
});

test('API failures and capped inventory keep WIP unknown; two unapproved PRs hold generation', () => {
  const github = getGithub(policy, () => { throw new Error('network unavailable'); });
  assert.equal(reviewCapacity(github, policy).status, 'unknown');
  const capped = getGithub(policy, () => JSON.stringify(Array.from({ length: 1000 }, pr)));
  assert.equal(capped.status, 'unavailable');
  assert.equal(reviewCapacity({ status: 'available', prs: [pr(), { ...pr(), number: 40 }] }, policy).status, 'hold');
  assert.equal(reviewCapacity({ status: 'available', prs: [pr(), { ...pr(), number: 40, reviewDecision: 'APPROVED' }] }, policy).status, 'available');
});

test('closed/missing PR is not silently called merged', (t) => {
  const f = queueFixture(t);
  const report = buildReport(f.root, f.queue, policy, { status: 'available', prs: [] });
  const item = report.items.find((item) => item.kind === 'merge');
  assert.equal(item.status, 'not_open_verify_outcome');
  assert.equal(item.merge, 'unknown');
});

test('queue enforces owners, deadlines, canonical gates, evidence and human resolutions', (t) => {
  assert.deepEqual(validateQueue(root, queue, policy), []);
  const f = queueFixture(t);
  const mutations = [
    (q) => { q.items[0].owner = 'unknown'; },
    (q) => { delete q.items[0].due_at; },
    (q) => { q.items[0].due_at = '2020-01-01T00:00:00Z'; },
    (q) => { q.items[0].evidence = ['../outside']; },
    (q) => { q.items[0].status = 'resolved'; },
    (q) => { q.items.push(structuredClone(q.items[0])); },
    (q) => { q.items.find((i) => i.kind === 'gate').gate_id = 'fake'; },
    (q) => { q.items[0].due_at = 'tomorrow'; },
    (q) => { const i = q.items.find((i) => i.kind === 'gate'); i.status = 'resolved'; i.resolution = {
      decided_by: 'human', decided_at: '2026-09-10T00:00:00Z', decision: 'approved', evidence: i.evidence
    }; }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(f.queue); mutate(changed);
    assert.ok(validateQueue(f.root, changed, policy).length > 0);
  }
});

function releaseFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cle3-release-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (name, value) => { const target = path.join(dir, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(value)); };
  write('state.json', { episodes: { EP999: { phases: { phase4: { status: 'completed' }, phase5: { status: 'completed' } } } } });
  const prefix = 'episodes/EP999';
  write(`${prefix}/source.png`, 'source'); write(`${prefix}/final.svg`, 'final'); write(`${prefix}/approval.md`, 'human evidence');
  const gate = { id: 'release', status: 'approved', approved_by: 'human', approved_at: '2026-09-08T00:00:00Z', evidence: [`${prefix}/approval.md`] };
  const panel = { panel_id: 'p1-1', generation_status: 'generated', image_path: `${prefix}/source.png` };
  const overlay = { panel_id: 'p1-1', status: 'approved', overlays: [{ text: '승인된 대사' }], source_image_path: panel.image_path, final_image_path: `${prefix}/final.svg` };
  const qa = { episode_id: 'EP999', overall_score: 45, items: Array.from({ length: 5 }, () => ({ score: 9 })), final_images: [overlay.final_image_path] };
  const save = () => {
    write(`${prefix}/approvals/gates.json`, { episode_id: 'EP999', gates: [gate] });
    write(`${prefix}/panels/panels.json`, { episode_id: 'EP999', panels: [panel] });
    write(`${prefix}/panels/text-overlays.json`, { episode_id: 'EP999', panels: [overlay] });
    write(`${prefix}/qa/qa.json`, qa);
  };
  save(); return { dir, write, gate, panel, overlay, qa, save };
}

test('release requires actual human approval even when outputs and CI are complete', (t) => {
  const f = releaseFixture(t);
  assert.equal(releaseReadiness(f.dir, 'EP999').status, 'ready');
  for (const status of ['pending', 'provisional', 'not_applicable', 'changes_requested']) {
    f.gate.status = status; f.save();
    assert.equal(releaseReadiness(f.dir, 'EP999').status, 'blocked');
  }
  f.gate.status = 'approved'; f.gate.approved_by = ''; f.save();
  assert.equal(releaseReadiness(f.dir, 'EP999').status, 'blocked');
});

test('unreviewed states cannot pass release; QA must cover exact final files', (t) => {
  const f = releaseFixture(t);
  for (const status of ['draft', 'needs_review', 'unknown']) {
    f.overlay.status = status; f.save();
    assert.equal(releaseReadiness(f.dir, 'EP999').status, 'blocked');
  }
  f.overlay.status = 'rendered'; f.save();
  assert.equal(releaseReadiness(f.dir, 'EP999').status, 'ready');
  f.overlay.status = 'approved'; f.qa.final_images = ['episodes/EP999/source.png']; f.save();
  assert.equal(releaseReadiness(f.dir, 'EP999').status, 'blocked');
  f.qa.final_images = [f.overlay.final_image_path]; f.qa.items[0].score = 1; f.save();
  assert.equal(releaseReadiness(f.dir, 'EP999').status, 'blocked');
});

test('release rejects missing final files and out-of-repository evidence', (t) => {
  const f = releaseFixture(t);
  f.gate.evidence = ['../not-repository']; f.save();
  assert.equal(releaseReadiness(f.dir, 'EP999').status, 'blocked');
  f.gate.evidence = ['episodes/EP999/approval.md']; f.overlay.final_image_path = 'missing.svg'; f.save();
  assert.equal(releaseReadiness(f.dir, 'EP999').status, 'blocked');
});

test('runner WIP hold emits no commands and does not write a plan', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cle3-gh-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'gh'), `#!${process.execPath}\nconsole.log(${JSON.stringify(JSON.stringify([pr(), { ...pr(), number: 40 }]))});\n`, { mode: 0o755 });
  const plan = path.join(root, 'episodes/EP002/panels/next-generation-plan.json');
  const before = fs.existsSync(plan) ? fs.readFileSync(plan, 'utf8') : null;
  const result = spawnSync(process.execPath, ['scripts/run-panel-jobs.js', '--episode', 'EP002', '--write-plan'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}` }
  });
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).selected_jobs, []);
  assert.equal(fs.existsSync(plan) ? fs.readFileSync(plan, 'utf8') : null, before);
});

test('both PR and Pages workflows execute the release guard', () => {
  const deploy = fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  assert.ok(deploy.indexOf('EP001 --require-release') < deploy.indexOf('actions/configure-pages'));
  assert.match(deploy, /validate-episode-output\.js EP001 --require-release/);
  const ci = fs.readFileSync(path.join(root, '.github/workflows/validate-assets.yml'), 'utf8');
  assert.match(ci, /decision-status\.js --validate/);
  assert.match(ci, /validate-episode-output\.js EP001 --require-release/);
});
