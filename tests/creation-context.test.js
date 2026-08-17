const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  buildCreationContext,
  isSafeRepoPath,
  validateCreationMemory
} = require('../scripts/build-creation-context');
const { buildCreationMemory } = require('../scripts/init-episode-governance');

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
