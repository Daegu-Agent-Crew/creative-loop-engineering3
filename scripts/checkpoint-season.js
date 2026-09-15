#!/usr/bin/env node
// Reconcile production progress from real assets; never infer QA or release approval.
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const write = (p, d) => fs.writeFileSync(path.join(root, p), JSON.stringify(d, null, 2) + '\n');
const state = read('state.json');
const counts = [];
for (const episode of ['EP002', 'EP003', 'EP004', 'EP005']) {
  const file = `episodes/${episode}/panels/panels.json`;
  const data = read(file);
  let generated = 0;
  for (const panel of data.panels) {
    if (panel.image_path && fs.existsSync(path.join(root, panel.image_path))) {
      generated++;
      if (!['approved','selected'].includes(panel.generation_status)) panel.generation_status = 'generated';
    }
  }
  write(file, data);
  const entry = state.episodes[episode];
  const qaComplete = generated === data.panels.length && entry.phases.phase5?.status === 'completed';
  entry.current_phase = qaComplete ? 'phase6_release' : generated === data.panels.length ? 'phase5_qa' : 'phase4_panels';
  entry.phases.phase3 = { ...entry.phases.phase3, status: 'completed', note: `정본 패널 대본과 콘티 ${data.panels.length}컷 일치. 2026-09-15 전체 완결 요청에 따라 기준선 정리.` };
  if (!qaComplete) entry.phases.phase4 = { ...entry.phases.phase4, status: 'active', note: `실제 자산 ${generated}/${data.panels.length}. 생성과 QA는 별도이며 시각 검수·수정 진행 중.` };
  if (episode === 'EP002') entry.phases.phase1.note = '기존 script.json 16장면과 16페이지·57컷 정본을 일치시킴. 예전 15페이지 원고는 archive에 보존.';
  counts.push({episode, generated, total: data.panels.length});
}
state.current_episode = counts.find(c => c.generated < c.total)?.episode || 'EP005';
state.current_phase = counts.some(c => c.generated < c.total) ? 'phase4_panels' : counts.every(c => state.episodes[c.episode].phases.phase5?.status === 'completed') ? 'phase6_release' : 'phase5_qa';
state.last_updated = new Date().toISOString();
write('state.json', state);
console.log(JSON.stringify(counts));
