const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  buildCreationContext,
  isSafeRepoPath,
  validateSeriesBible,
  validateCreationMemory
} = require('../scripts/build-creation-context');
const { buildCreationMemory } = require('../scripts/init-episode-governance');
const { compileCreationRequestCard, validateCreationRequestCard } = require('../scripts/build-creation-request');
const { generationCommand, selectJobs } = require('../scripts/run-panel-jobs');

const rootDir = path.resolve(__dirname, '..');
const fixedNow = new Date('2026-08-18T00:00:00.000Z');

test('panel context selects matching canon, continuity, narrative and global rules', () => {
  const context = buildCreationContext({
    rootDir,
    episodeId: 'EP001',
    panelId: 'p15-3',
    task: 'p15-3 연속성 재검토',
    now: fixedNow
  });

  assert.equal(context.target.panel_id, 'p15-3');
  assert.deepEqual(context.retrieval.matched_characters, ['청신', '왕먀오(등)']);
  assert.ok(context.context.canon_assets.some((item) => item.id === 'character-chengxin-v1'));
  assert.ok(context.context.canon_assets.some((item) => item.id === 'character-wangmiao-v1'));
  assert.ok(context.context.canon_assets.some((item) => item.kind === 'visual_style'));
  assert.equal(context.context.bible.version, '1.1.0');
  assert.ok(context.context.bible.characters.some((item) => item.id === 'character-chengxin-v1'));
  assert.ok(context.context.bible.characters.some((item) => item.id === 'character-wangmiao-v1'));
  assert.ok(context.context.bible.locations.some((item) => item.id === 'location-wangmiao-lab-v1'));
  assert.ok(context.context.bible.props.some((item) => item.id === 'prop-main-monitor-v1'));
  assert.ok(context.context.bible.world_rules.some((item) => item.id === 'world-2007-normality-infection-v1'));
  assert.ok(context.context.bible.world_rules.some((item) => item.id === 'world-mystery-disclosure-v1'));
  assert.ok(context.context.continuity.some((item) => item.id === 'continuity-p15-2-to-p15-3'));
  assert.ok(context.context.narrative_threads.some((item) => item.id === 'thread-dark-lab-reveal'));
  assert.ok(context.context.preferences.some((item) => item.id === 'preference-postprocess-korean-text'));
  assert.ok(!context.context.lessons.some((item) => item.id === 'lesson-p8-1-separate-text'));
});

test('episode context stays compact and carries active handoff without panel-only continuity', () => {
  const context = buildCreationContext({ rootDir, episodeId: 'EP001', now: fixedNow });

  assert.equal(context.target.panel_id, null);
  assert.equal(context.panel_intent, null);
  assert.equal(context.context.continuity.length, 0);
  assert.ok(context.context.source_refs.some((item) => item.type === 'characters'));
  assert.ok(context.context.source_refs.some((item) => item.type === 'panels'));
  assert.ok(context.context.narrative_threads.every((item) => item.status === 'active'));
  assert.ok(context.context.preferences.some((item) => item.id === 'preference-postprocess-korean-text'));
  assert.ok(context.current_work.handoff.next_actions.length > 0);
  assert.ok(context.context.bible.characters.length >= 5);
  assert.ok(context.context.bible.world_rules.length >= 3);
  assert.ok(context.context.bible.locations.length >= 5);
  assert.ok(context.context.bible.props.length >= 5);
});

test('radio tower panel retrieves only its relevant location and prop Bible entries', () => {
  const context = buildCreationContext({ rootDir, episodeId: 'EP001', panelId: 'p7-3', now: fixedNow });
  assert.deepEqual(context.context.bible.locations.map((item) => item.id), ['location-radio-tower-v1']);
  assert.deepEqual(context.context.bible.props.map((item) => item.id), ['prop-transmitter-switch-v1']);
  assert.deepEqual(context.context.bible.world_rules.map((item) => item.id), ['world-1967-analog-china-v1']);
  assert.ok(context.context.bible.characters.some((item) => item.id === 'character-yewenjie-v1'));
  assert.ok(context.retrieval.omitted_counts.bible_locations > 0);
});

test('approved Bible compiles into a panel creation request with only relevant DNA', () => {
  const context = buildCreationContext({ rootDir, episodeId: 'EP001', panelId: 'p7-3', now: fixedNow });
  const request = compileCreationRequestCard(context);

  assert.equal(request.bible.status, 'approved');
  assert.deepEqual(request.dna.locations.map((item) => item.id), ['location-radio-tower-v1']);
  assert.deepEqual(request.dna.props.map((item) => item.id), ['prop-transmitter-switch-v1']);
  assert.ok(request.references.some((item) => item.anchor_id === 'character-yewenjie-v1'));
  assert.ok(request.references.some((item) => item.anchor_id === 'location-radio-tower-v1'));
  assert.ok(request.references.some((item) => item.anchor_id === 'prop-transmitter-switch-v1'));
  assert.match(request.compiled_prompt, /DNA \/ outfit 예원제 1967년 청쑤 대학/);
  assert.match(request.compiled_prompt, /DO NOT CHANGE: 현대식 디지털 화면/);
  assert.doesNotMatch(request.compiled_prompt, /왕먀오의 암실 연구실/);
});

test('panel runner automatically attaches approved Bible card and anchor assets', () => {
  const policy = require('../config/panel-generation-policy.json');
  const jobs = require('../episodes/EP001/panels/generation-jobs.json');
  const panels = require('../episodes/EP001/panels/panels.json');
  const preferences = require('../episodes/EP001/panels/preference-memory.json');
  const selected = selectJobs(rootDir, policy, jobs, panels, preferences, {
    panelId: 'p15-3', maxJobs: 1, variants: 1, maxIterations: 1, iteration: 1, diagnosis: null
  });
  const command = selected[0].commands[0];

  assert.equal(command.creation_request.bible.status, 'approved');
  assert.ok(command.references_attached.includes('episodes/EP001/panels/assets/p15-3.png'));
  assert.ok(command.references_attached.includes('episodes/EP001/characters/assets/chengxin-v1.png'));
  assert.match(command.command, /CLE3 APPROVED CREATION BIBLE/);
  assert.match(command.command, /중앙 모니터에 p16의 문구를 미리 표시하지 않는다/);
});

test('creation request validation rejects unapproved Bible and unsafe assets', () => {
  const context = buildCreationContext({ rootDir, episodeId: 'EP001', panelId: 'p7-3', now: fixedNow });
  const request = compileCreationRequestCard(context);
  const invalid = JSON.parse(JSON.stringify(request));
  invalid.bible.status = 'provisional';
  invalid.references[0].asset_path = '../outside.png';
  const failures = validateCreationRequestCard(invalid, rootDir);
  assert.ok(failures.includes('bible.status must be approved'));
  assert.ok(failures.some((failure) => failure.includes('unsafe path')));
});

test('creation compiler fails closed when a scoped Bible asset is not approved', () => {
  const context = buildCreationContext({ rootDir, episodeId: 'EP001', panelId: 'p7-3', now: fixedNow });
  const invalid = JSON.parse(JSON.stringify(context));
  invalid.context.bible.props[0].status = 'provisional';
  assert.throws(() => compileCreationRequestCard(invalid), /props\.prop-transmitter-switch-v1 must be approved/);
});

test('creation compiler requires a panel, Bible, approved style and approved scoped assets', () => {
  const panelContext = buildCreationContext({ rootDir, episodeId: 'EP001', panelId: 'p7-3', now: fixedNow });
  const episodeContext = buildCreationContext({ rootDir, episodeId: 'EP001', now: fixedNow });
  assert.throws(() => compileCreationRequestCard(episodeContext), /panel-specific/);

  const missingBible = JSON.parse(JSON.stringify(panelContext));
  missingBible.context.bible = null;
  assert.throws(() => compileCreationRequestCard(missingBible), /series Bible is required/);

  const provisionalBible = JSON.parse(JSON.stringify(panelContext));
  provisionalBible.context.bible.status = 'provisional';
  assert.throws(() => compileCreationRequestCard(provisionalBible), /must be approved before creation/);

  const provisionalStyle = JSON.parse(JSON.stringify(panelContext));
  provisionalStyle.context.bible.visual_style.status = 'provisional';
  assert.throws(() => compileCreationRequestCard(provisionalStyle), /visual style must be approved/);
});

test('creation request validator enforces non-empty sections and DNA shape', () => {
  const context = buildCreationContext({ rootDir, episodeId: 'EP001', panelId: 'p7-3', now: fixedNow });
  const invalid = compileCreationRequestCard(context);
  invalid.delta = [];
  invalid.references = [null];
  invalid.dna.world_rules = 'not-an-array';
  const failures = validateCreationRequestCard(invalid, rootDir);
  assert.ok(failures.includes('delta must not be empty'));
  assert.ok(failures.includes('dna.world_rules must be an array'));
  assert.ok(failures.includes('references[0] must be an object'));
});

test('generation command preserves Bible prompt in candidate correction mode', () => {
  const panel = require('../episodes/EP001/panels/panels.json').panels.find((item) => item.panel_id === 'p7-3');
  const context = buildCreationContext({ rootDir, episodeId: 'EP001', panelId: 'p7-3', now: fixedNow });
  const request = compileCreationRequestCard(context);
  const result = generationCommand(panel, 'EP001', 2, 2, true, '손과 스위치 방향을 수정', [], request);
  assert.equal(result.output_path, '.candidates/EP001/p7-3/iteration-02/p7-3-v02.png');
  assert.deepEqual(result.references_attached, []);
  assert.match(result.command, /손과 스위치 방향을 수정/);
  assert.match(result.command, /CLE3 APPROVED CREATION BIBLE/);
});

test('series Bible validation rejects unsafe reference paths', () => {
  const bible = require('../episodes/EP001/bible/bible.json');
  const invalid = JSON.parse(JSON.stringify(bible));
  invalid.locations[0].anchor_asset = '../outside.png';
  assert.ok(validateSeriesBible(invalid, rootDir).some((failure) => failure.includes('path must stay inside')));
});

test('unknown panel fails instead of returning misleading context', () => {
  assert.throws(
    () => buildCreationContext({ rootDir, episodeId: 'EP001', panelId: 'p99-99', now: fixedNow }),
    /unknown panel id/
  );
});

test('memory validation enforces Codex as the sole creative actor', () => {
  const invalid = {
    schema_version: 1,
    episode_id: 'EP001',
    creator_contract: { creative_actor: 'other-agent', sole_creative_actor: false },
    source_refs: [],
    canon_assets: [],
    narrative_threads: [],
    continuity: [],
    preferences: [],
    lessons: [],
    constraints: [],
    handoff: {}
  };
  const failures = validateCreationMemory(invalid, rootDir, { checkPaths: false });
  assert.ok(failures.includes('creator_contract.creative_actor must be codex'));
  assert.ok(failures.includes('creator_contract.sole_creative_actor must be true'));
});

test('repository paths reject absolute and parent traversal paths', () => {
  assert.equal(isSafeRepoPath(rootDir, 'episodes/EP001/script/script.json'), true);
  assert.equal(isSafeRepoPath(rootDir, '../outside.json'), false);
  assert.equal(isSafeRepoPath(rootDir, '/tmp/outside.json'), false);
});

test('episode initializer creates a Codex-owned memory handoff from existing state', () => {
  const state = require('../state.json');
  const memory = buildCreationMemory(rootDir, 'EP002', state.episodes.EP002, fixedNow);

  assert.equal(memory.creator_contract.creative_actor, 'codex');
  assert.equal(memory.creator_contract.sole_creative_actor, true);
  assert.ok(memory.source_refs.some((item) => item.type === 'story' && item.required));
  assert.ok(memory.source_refs.some((item) => item.type === 'panels'));
  assert.ok(memory.handoff.next_actions.some((item) => item.includes('Creation Context Pack')));
  assert.deepEqual(validateCreationMemory(memory, rootDir), []);
});
