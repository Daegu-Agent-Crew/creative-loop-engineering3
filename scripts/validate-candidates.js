#!/usr/bin/env node

const fs = require('fs');

function fail(message) {
  throw new Error(message);
}

function validateScores(scores, candidateId) {
  if (!scores) return;
  const axes = [
    'character_consistency',
    'storyboard_fidelity',
    'composition',
    'style_consistency',
    'scene_continuity'
  ];
  for (const axis of axes) {
    if (typeof scores[axis] !== 'number' || scores[axis] < 0 || scores[axis] > 10) {
      fail(`${candidateId}: invalid score for ${axis}`);
    }
  }
  const total = axes.reduce((sum, axis) => sum + scores[axis], 0);
  if (scores.total !== total) fail(`${candidateId}: total must equal axis sum (${total})`);
}

function validateRecord(record) {
  if (record.schema_version !== 1) fail('schema_version must be 1');
  if (!/^EP\d{3}$/.test(record.episode_id || '')) fail('invalid episode_id');
  if (!/^p\d+-\d+$/.test(record.panel_id || '')) fail('invalid panel_id');
  if (!Array.isArray(record.iterations) || record.iterations.length === 0) fail('iterations are required');

  const allCandidateIds = new Set();
  for (const iteration of record.iterations) {
    if (!Number.isInteger(iteration.iteration) || iteration.iteration < 1 || iteration.iteration > 3) {
      fail('iteration must be from 1 to 3');
    }
    if (!Array.isArray(iteration.candidates) || iteration.candidates.length < 2 || iteration.candidates.length > 3) {
      fail(`iteration ${iteration.iteration}: two or three candidates are required`);
    }
    for (const candidate of iteration.candidates) {
      if (allCandidateIds.has(candidate.candidate_id)) fail(`duplicate candidate_id: ${candidate.candidate_id}`);
      allCandidateIds.add(candidate.candidate_id);
      if (!String(candidate.output_path || '').startsWith('.candidates/')) {
        fail(`${candidate.candidate_id}: candidate output must stay under .candidates/`);
      }
      validateScores(candidate.scores, candidate.candidate_id);
    }

    const comparison = iteration.comparison;
    if (!comparison) continue;
    if (!['winner', 'tie', 'both_bad'].includes(comparison.verdict)) fail('invalid comparison verdict');
    if (comparison.verdict === 'winner' && !allCandidateIds.has(comparison.winner_candidate_id)) {
      fail('winner_candidate_id must identify a candidate');
    }
    if (comparison.verdict !== 'winner' && comparison.winner_candidate_id !== null) {
      fail(`${comparison.verdict} must not select a winner`);
    }
  }

  const selectedId = record.selection && record.selection.candidate_id;
  if (selectedId !== null && !allCandidateIds.has(selectedId)) fail('selection references an unknown candidate');
}

const filePath = process.argv[2];
if (!filePath) fail('usage: node scripts/validate-candidates.js <candidate-record.json>');
const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
validateRecord(record);
console.log(`candidate record ok: ${record.episode_id}/${record.panel_id}`);
