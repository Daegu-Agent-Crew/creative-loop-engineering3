const fs = require('node:fs');
const path = require('node:path');

function repoFile(rootDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) return false;
  const root = fs.realpathSync(rootDir);
  const resolved = path.resolve(root, relativePath);
  try {
    return resolved.startsWith(root + path.sep) &&
      fs.realpathSync(resolved).startsWith(root + path.sep) && fs.statSync(resolved).isFile();
  } catch { return false; }
}

// Read-only preconditions; passing this is not a new approval or a deployment.
function releaseReadiness(rootDir, episodeId) {
  if (!/^EP\d{3}$/.test(episodeId)) throw new Error('episode must match EP###');
  const blockers = [];
  const read = (relativePath) => {
    try { return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8')); }
    catch { blockers.push(`missing or invalid JSON: ${relativePath}`); return {}; }
  };
  const prefix = `episodes/${episodeId}`;
  const state = read('state.json').episodes?.[episodeId];
  const approvals = read(`${prefix}/approvals/gates.json`);
  const panels = read(`${prefix}/panels/panels.json`);
  const overlays = read(`${prefix}/panels/text-overlays.json`);
  const qa = read(`${prefix}/qa/qa.json`);
  for (const [label, record] of Object.entries({ approvals, panels, overlays, qa })) {
    if (record.episode_id !== episodeId) blockers.push(`${label}: episode mismatch`);
  }
  for (const phase of ['phase4', 'phase5']) {
    if (state?.phases?.[phase]?.status !== 'completed') blockers.push(`${phase}: incomplete`);
  }
  const gates = Array.isArray(approvals.gates) ? approvals.gates : [];
  const release = gates.filter((gate) => gate.id === 'release');
  const gate = release[0];
  if (release.length !== 1 || gate?.status !== 'approved') blockers.push('human release approval pending');
  if (!gate?.approved_by?.trim() || !Number.isFinite(Date.parse(gate?.approved_at))) {
    blockers.push('release approver and timestamp required');
  }
  if (!Array.isArray(gate?.evidence) || !gate.evidence.length ||
      !gate.evidence.every((p) => repoFile(rootDir, p))) blockers.push('release evidence missing');
  const items = Array.isArray(qa.items) ? qa.items : [];
  if (items.length !== 5 || items.some((item) => !Number.isFinite(item.score) || item.score < 0 || item.score > 10) ||
      items.reduce((sum, item) => sum + item.score, 0) !== qa.overall_score || qa.overall_score < 42) {
    blockers.push('QA must have five valid scores totaling at least 42/50');
  }
  const sources = Array.isArray(panels.panels) ? panels.panels : [];
  const finals = Array.isArray(overlays.panels) ? overlays.panels : [];
  const ids = new Set(sources.map((p) => p.panel_id));
  if (!sources.length || ids.size !== sources.length || finals.length !== sources.length ||
      new Set(finals.map((p) => p.panel_id)).size !== finals.length || finals.some((p) => !ids.has(p.panel_id))) {
    blockers.push('panel/overlay coverage mismatch');
  }
  for (const p of sources) {
    if (!['generated', 'approved', 'selected'].includes(p.generation_status) || !repoFile(rootDir, p.image_path)) {
      blockers.push(`${p.panel_id}: source not ready`);
    }
  }
  for (const p of finals) {
    // Legacy released episodes also use rendered for text-bearing panels;
    // the episode's separate human gate and QA coverage remain mandatory.
    if (!['approved', 'embedded_text', 'rendered'].includes(p.status)) {
      blockers.push(`${p.panel_id}: text review required (${p.status})`);
    }
    if (!repoFile(rootDir, p.final_image_path) || !repoFile(rootDir, p.source_image_path)) {
      blockers.push(`${p.panel_id}: final/source file missing`);
    }
    if (sources.find((source) => source.panel_id === p.panel_id)?.image_path !== p.source_image_path) {
      blockers.push(`${p.panel_id}: overlay source mismatch`);
    }
  }
  const reviewed = Array.isArray(qa.final_images) ? qa.final_images : [];
  if (reviewed.length !== finals.length || new Set(reviewed).size !== reviewed.length ||
      finals.some((p) => !reviewed.includes(p.final_image_path)) ||
      reviewed.some((p) => !repoFile(rootDir, p))) blockers.push('QA final image coverage mismatch');
  return { status: blockers.length ? 'blocked' : 'ready', approval: gate?.status || 'missing', blockers };
}

module.exports = { repoFile, releaseReadiness };
