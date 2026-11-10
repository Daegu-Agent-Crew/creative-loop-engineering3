#!/usr/bin/env node
// 사전 예방: storyboard.json은 panel-script.json에서 결정론적으로 파생한다 (설명 드리프트 원천 차단).
// 회장님 지시 2026-11-10 17:27 — "사후 정합 검사는 하지말고, 사전 예방 조치 강화"
const fs = require('fs'), path = require('path');
const ep = process.argv[2];
if (!ep || !/^EP\d{3}$/.test(ep)) { console.error('Usage: node scripts/gen-storyboard.js EP008'); process.exit(1); }
const root = process.cwd();
const ps = JSON.parse(fs.readFileSync(path.join(root, 'episodes', ep, 'script/panel-script.json'), 'utf8'));
if (ps.episode_id !== ep) throw Error('episode mismatch');
const pages = [];
for (const p of ps.panels) {
  let page = pages[pages.length - 1];
  if (!page || page.page_number !== p.page_number) { page = { page_number: p.page_number, layout: '대본 패널 순서', panels: [] }; pages.push(page); }
  page.panels.push({
    panel_id: p.panel_id,
    description: p.description, // 정책상 현재 상태의 panel-script는 콘티 설명과 동일 문구를 갖는다 (v5.1 이후 생성 프롬프트가 콘티 문구를 그대로 삽입)
    camera_angle: p.camera_angle || '',
    characters_in_frame: p.characters_in_frame || [],
    visual_type: p.visual_type || 'normal'
  });
}
const doc = { episode_id: ep, prompt_version: 'v5.1-single-source-derived', source: 'episodes/' + ep + '/script/panel-script.json', pages };
fs.mkdirSync(path.join(root, 'episodes', ep, 'storyboard'), { recursive: true });
fs.writeFileSync(path.join(root, 'episodes', ep, 'storyboard/storyboard.json'), JSON.stringify(doc, null, 2) + '\n');
console.log('derived', ep + ':', pages.length, 'pages /', ps.panels.length, 'panels (설명은 panel-script에서 복제 — 드리프트 불가)');
