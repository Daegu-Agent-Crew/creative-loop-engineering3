#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const failures = [];

function readJson(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${relativePath}: missing file`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    failures.push(`${relativePath}: invalid JSON (${error.message})`);
    return null;
  }
}

function requireValue(condition, message) {
  if (!condition) failures.push(message);
}

function validateDiscovery(episodeId, discovery) {
  if (!discovery) return;
  const prefix = `episodes/${episodeId}/discovery/context.json`;
  requireValue(discovery.episode_id === episodeId, `${prefix}: episode_id mismatch`);
  requireValue(Boolean(discovery.objective), `${prefix}: objective is required`);
  requireValue(Array.isArray(discovery.tools) && discovery.tools.length > 0, `${prefix}: tools are required`);
  requireValue(['ready', 'ready_with_assumptions', 'blocked'].includes((discovery.preflight || {}).status), `${prefix}: invalid preflight status`);
  const unknowns = discovery.unknowns || {};
  ['known_known', 'known_unknown', 'unknown_known', 'unknown_unknown_candidates'].forEach((key) => {
    requireValue(Array.isArray(unknowns[key]), `${prefix}: unknowns.${key} must be an array`);
  });
  (discovery.references || []).forEach((reference) => {
    requireValue(fs.existsSync(path.join(rootDir, reference.path || '')), `${prefix}: missing reference ${reference.path || '-'}`);
  });
}

function validateDecisions(episodeId, log) {
  if (!log) return;
  const prefix = `episodes/${episodeId}/decisions/implementation-notes.json`;
  requireValue(log.episode_id === episodeId, `${prefix}: episode_id mismatch`);
  requireValue(Array.isArray(log.decisions), `${prefix}: decisions must be an array`);
  (log.decisions || []).forEach((decision, index) => {
    requireValue(Boolean(decision.decision), `${prefix}: decisions[${index}].decision is required`);
    requireValue(Boolean(decision.rationale), `${prefix}: decisions[${index}].rationale is required`);
    requireValue(['high', 'medium', 'low'].includes(decision.confidence), `${prefix}: decisions[${index}].confidence is invalid`);
    requireValue(Boolean(decision.human_approval), `${prefix}: decisions[${index}].human_approval is required`);
  });
}

function validateApprovals(episodeId, approvals) {
  if (!approvals) return;
  const prefix = `episodes/${episodeId}/approvals/gates.json`;
  const expectedGateIds = ['story-lock', 'character-lock', 'storyboard-lock', 'release'];
  requireValue(approvals.episode_id === episodeId, `${prefix}: episode_id mismatch`);
  requireValue((approvals.policy || {}).normal_work_continues === true, `${prefix}: normal_work_continues must be true`);
  const gates = approvals.gates || [];
  requireValue(Array.isArray(gates) && gates.length === expectedGateIds.length, `${prefix}: four approval gates are required`);
  expectedGateIds.forEach((gateId) => {
    requireValue(gates.some((gate) => gate.id === gateId), `${prefix}: missing gate ${gateId}`);
  });
  gates.forEach((gate) => {
    requireValue(['pending', 'provisional', 'approved', 'changes_requested', 'not_applicable'].includes(gate.status), `${prefix}: invalid status for ${gate.id}`);
    (gate.evidence || []).forEach((evidencePath) => {
      requireValue(fs.existsSync(path.join(rootDir, evidencePath)), `${prefix}: missing evidence ${evidencePath}`);
    });
  });
}

function validatePanelJobs(episodeId) {
  const relativePath = `episodes/${episodeId}/panels/generation-jobs.json`;
  if (!fs.existsSync(path.join(rootDir, relativePath))) return;
  const jobs = readJson(relativePath);
  (jobs && jobs.jobs || []).forEach((job, index) => {
    const prefix = `${relativePath}: jobs[${index}]`;
    requireValue(Boolean(job.decision_rationale), `${prefix}.decision_rationale is required`);
    requireValue(['high', 'medium', 'low'].includes(job.confidence), `${prefix}.confidence is invalid`);
    requireValue(Array.isArray(job.assumptions), `${prefix}.assumptions must be an array`);
    requireValue(Array.isArray(job.uncertainties), `${prefix}.uncertainties must be an array`);
    requireValue(Array.isArray(job.references_used), `${prefix}.references_used must be an array`);
    requireValue(typeof job.human_approval_required === 'boolean', `${prefix}.human_approval_required must be boolean`);
  });
}

const state = readJson('state.json');
if (state) {
  Object.keys(state.episodes || {}).forEach((episodeId) => {
    validateDiscovery(episodeId, readJson(`episodes/${episodeId}/discovery/context.json`));
    validateDecisions(episodeId, readJson(`episodes/${episodeId}/decisions/implementation-notes.json`));
    validateApprovals(episodeId, readJson(`episodes/${episodeId}/approvals/gates.json`));
    validatePanelJobs(episodeId);
  });
}

if (failures.length) {
  console.error(`episode governance validation failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`episode governance validation passed (${Object.keys((state && state.episodes) || {}).length} episodes)`);
