/* CLE3 — 삼체 만화 창작 시스템 GitHub 연동 */

const GH_ORG = 'Daegu-Agent-Crew';
const GH_REPO = 'creative-loop-engineering3';
const GH_API = `https://api.github.com/repos/${GH_ORG}/${GH_REPO}`;
const CLE2_API = `https://api.github.com/repos/${GH_ORG}/creative-loop-engineering2`;

let PAT = localStorage.getItem('cle3_pat') || '';
let currentView = 'dashboard';
const app = document.getElementById('app');

// ===== Router =====
function route() {
  const hash = location.hash.slice(1) || 'dashboard';
  // episode/EP001 같은 서브라우팅 처리
  const parts = hash.split('/');
  currentView = parts[0];
  currentParam = parts[1] || null;
  render();
}

let currentParam = null;
window.addEventListener('hashchange', route);

// ===== GitHub API =====
async function ghFetch(url, method, body) {
  if (!PAT) return null;
  const opts = { method: method || 'GET', headers: { 'Authorization': 'token ' + PAT, 'Accept': 'application/vnd.github+json' } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(url, opts);
    if (res.status === 401) { showToast('❌ PAT 인증 실패', 'error'); return null; }
    if (!res.ok) { return null; }
    return method === 'DELETE' ? null : res.json();
  } catch(e) { return null; }
}

function patBanner() {
  if (!PAT) return '<div class="pat-banner">⚠️ GitHub PAT가 설정되지 않았습니다. <a href="#settings">설정하러 가기 →</a></div>';
  return '';
}

// ===== Data =====
async function loadState() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/' + GH_ORG + '/' + GH_REPO + '/main/state.json');
    return await res.json();
  } catch { return null; }
}

async function loadIssues() {
  if (!PAT) return [];
  return await ghFetch(CLE2_API + '/issues?state=all&per_page=100&sort=created&direction=desc') || [];
}

// raw.githubusercontent.com에서 JSON 로드 (PAT 불필요)
async function loadJson(path) {
  try {
    const url = 'https://raw.githubusercontent.com/' + GH_ORG + '/' + GH_REPO + '/main/' + path;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function loadText(path) {
  try {
    const url = 'https://raw.githubusercontent.com/' + GH_ORG + '/' + GH_REPO + '/main/' + path;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function loadCommits() {
  if (!PAT) return [];
  return await ghFetch(GH_API + '/commits?per_page=10') || [];
}

// ===== Render =====
function render() {
  switch (currentView) {
    case 'settings': renderSettings(); break;
    case 'pipeline': renderPipeline(); break;
    case 'episode': renderEpisode(); break;
    case 'prompts': renderPrompts(); break;
    default: renderDashboard();
  }
}

function navHtml() {
  var items = [
    ['dashboard', '📊 대시보드'],
    ['pipeline', '🔄 파이프라인'],
    ['episode', '📖 에피소드'],
    ['prompts', '📝 프롬프트'],
    ['settings', '⚙️ 설정']
  ];
  return '<nav class="navbar">' + items.map(function(it) {
    var cls = currentView === it[0] ? 'active' : '';
    return '<a href="#' + it[0] + '" class="' + cls + '">' + it[1] + '</a>';
  }).join('') + '</nav>';
}

function headerHtml() {
  return '<div class="header"><h1>🎬 CLE3</h1><div class="subtitle">삼체 만화 창작 시스템</div></div>';
}

function setLoading() {
  app.innerHTML = headerHtml() + navHtml() + '<div class="content"><div class="loading">로딩 중...</div></div>';
}

// ===== Dashboard =====
async function renderDashboard() {
  setLoading();
  var state = await loadState();
  var issues = await loadIssues();
  var commits = await loadCommits();
  var cle3Issue = issues.find(function(i) { return i.title.indexOf('[CLE2-9]') >= 0; });

  var epCount = state && state.episodes ? Object.keys(state.episodes).length : 0;
  var currentEp = (state && state.current_episode) || '-';
  var currentPhase = (state && state.current_phase) || '-';
  var budget = state && state.improvement_budget ? state.improvement_budget : {};
  var budgetUsed = budget.used || 0;
  var budgetTotal = budget.total || 15;

  var issueHtml = cle3Issue ?
    '<div class="card"><h3>📋 GitHub Issue</h3>' +
    '<p><a href="' + cle3Issue.html_url + '" target="_blank">#' + cle3Issue.number + ': ' + cle3Issue.title + '</a></p>' +
    '<span class="badge badge-' + cle3Issue.state + '">' + (cle3Issue.state === 'open' ? '진행 중' : '완료') + '</span>' +
    '<p class="meta">댓글 ' + cle3Issue.comments + '개</p></div>' : '';

  var commitHtml = commits.length > 0 ?
    commits.map(function(c) {
      return '<div class="commit"><code class="sha">' + c.sha.slice(0,7) +
        '</code><span class="msg">' + c.commit.message.split('\n')[0] +
        '</span><span class="meta">' + new Date(c.commit.author.date).toLocaleString('ko-KR') + '</span></div>';
    }).join('') : '<p class="meta">PAT 설정 시 커밋 이력이 표시됩니다.</p>';

  app.innerHTML = headerHtml() + navHtml() + patBanner() +
    '<div class="content">' +
    '<div class="stats-grid">' +
      statCard(epCount, '에피소드') +
      statCard(currentEp, '현재 에피소드') +
      statCard(currentPhase, '현재 단계') +
      statCard(budgetUsed + '/' + budgetTotal, '개선 예산') +
    '</div>' + issueHtml +
    '<div class="card"><h3>🔄 파이프라인</h3>' + pipelineVisual(state) + '</div>' +
    '<div class="card"><h3>📚 최근 커밋</h3>' + commitHtml + '</div>' +
    '</div>';
}

function statCard(val, label) {
  return '<div class="stat-card"><div class="stat-value">' + val + '</div><div class="stat-label">' + label + '</div></div>';
}

function pipelineVisual(state) {
  var phases = [
    ['phase0','인프라',0],['phase1','스토리',1],['phase2','캐릭터',2],
    ['phase3','콘티',3],['phase4','이미지',4],['phase5','교정',5],['phase6','배포',6]
  ];
  var currentPhase = state && state.current_phase ? state.current_phase : '';
  var ep = state && state.episodes && state.current_episode ? state.episodes[state.current_episode] : null;
  var ps = ep && ep.phases ? ep.phases : {};

  var html = '<div class="pipeline-visual">';
  phases.forEach(function(p) {
    var status = ps[p[0]] ? ps[p[0]].status : (currentPhase === p[0] ? 'active' : 'pending');
    var cls = status === 'completed' ? 'completed' : (status === 'active' ? 'active' : 'pending');
    var icon = status === 'completed' ? '✅' : (status === 'active' ? '🔄' : '');
    html += '<div class="pipe-phase ' + cls + '"><div class="pipe-num">' + p[2] +
      '</div><div class="pipe-name">' + p[1] + '</div>' + (icon ? '<div>' + icon + '</div>' : '') + '</div>';
    if (p[2] < 6) html += '<div class="pipe-arrow">→</div>';
  });
  html += '</div>';
  return html;
}

// ===== Pipeline =====
async function renderPipeline() {
  setLoading();
  var state = await loadState();
  var phases = [
    ['phase0','인프라 구축','리포, Actions, Discord Bot, 스키마'],
    ['phase0.5','드라이런','더미 데이터 전 파이프라인 테스트'],
    ['phase1','스토리 각색','원작 → 대본/스크립트'],
    ['phase2','캐릭터 디자인','캐릭터 시트, 외모 일관성'],
    ['phase3','콘티/스토리보드','장면 구성, 페이지 레이아웃'],
    ['phase4','이미지 생성','Codex CLI 패널 생성'],
    ['phase5','교정/QA','품질 검증 (≥42/50)'],
    ['phase6','배포','GitHub Pages 게시']
  ];
  var currentPhase = state && state.current_phase ? state.current_phase : '';
  var ep = state && state.episodes && state.current_episode ? state.episodes[state.current_episode] : null;
  var ps = ep && ep.phases ? ep.phases : {};

  var ep = state && state.current_episode ? state.current_episode : 'EP001';
  var currentPhaseVal = state && state.current_phase ? state.current_phase : '';
  var epData = state && state.episodes && state.episodes[ep] ? state.episodes[ep] : null;
  var ps = epData && epData.phases ? epData.phases : {};

  var phaseFiles = {
    'phase1': {json: 'episodes/' + ep + '/script/script.json', md: 'episodes/' + ep + '/script/script.md', label: '스토리 대본'},
    'phase2': {json: 'episodes/' + ep + '/characters/characters.json', label: '캐릭터 시트'},
    'phase3': {json: 'episodes/' + ep + '/storyboard/storyboard.json', label: '콘티'},
    'phase4': {json: 'episodes/' + ep + '/panels/panels.json', label: '이미지 패널'},
    'phase5': {json: 'episodes/' + ep + '/qa/qa.json', label: 'QA 리포트'}
  };

  var listHtml = phases.map(function(p) {
    var st = ps[p[0]] ? ps[p[0]].status : (currentPhaseVal === p[0] ? 'active' : 'pending');
    var score = ps[p[0]] ? ps[p[0]].score : null;
    var cls = st === 'completed' ? 'completed' : (st === 'active' ? 'active' : 'pending');
    var icon = st === 'completed' ? '✅' : (st === 'active' ? '🔄' : '⏳');
    var badge = st === 'completed' ? '완료' : (st === 'active' ? '진행 중' : '대기');
    var fid = 'phase-output-' + p[0].replace(/[^a-zA-Z0-9]/g,'');
    var hasOutput = phaseFiles[p[0]] && st === 'completed';

    return '<div class="phase-row ' + cls + '"><div class="phase-icon">' + icon + '</div>' +
      '<div class="phase-info"><div class="phase-title">' + p[1] +
      (hasOutput ? ' <a href="javascript:void(0)" onclick="toggleOutput(\'' + fid + '\',\'' + p[0] + '\')" class="expand-btn">▼ 결과물 보기</a>' : '') +
      '</div>' +
      '<div class="phase-desc">' + p[2] + '</div>' +
      (score ? '<div class="phase-score">평가: ' + score + '/50</div>' : '') +
      '</div><div class="phase-badge ' + cls + '">' + badge + '</div></div>' +
      (hasOutput ? '<div id="' + fid + '" class="phase-output" style="display:none"></div>' : '');
  }).join('');

  app.innerHTML = headerHtml() + navHtml() + patBanner() +
    '<div class="content"><h2>🔄 파이프라인</h2><div class="phase-list">' + listHtml + '</div>' +
    '<div class="card"><h3>📊 평가 루브릭</h3><p>각 Phase: 5개 항목 × 10점 = 50점</p><p>통과: ≥40/50 (Phase 5는 ≥42/50)</p>' +
    '<p><a href="https://github.com/' + GH_ORG + '/' + GH_REPO + '/blob/main/evaluation-rubric.md" target="_blank">상세 루브릭 →</a></p></div>' +
    '<div class="card"><h3>📖 에피소드 뷰어</h3><p><a href="episodes/' + ep + '/">' + ep + ' 보기 →</a></p></div></div>';
}

// ===== Phase Output Toggle =====
async function toggleOutput(elId, phaseId) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (el.style.display !== 'none') {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = '<div class="loading">로딩 중...</div>';

  var ep = 'EP001';
  var files = {
    'phase1': [['episodes/' + ep + '/script/script.json','json'],['episodes/' + ep + '/script/script.md','md']],
    'phase2': [['episodes/' + ep + '/characters/characters.json','json']],
    'phase3': [['episodes/' + ep + '/storyboard/storyboard.json','json']],
    'phase4': [['episodes/' + ep + '/panels/panels.json','json']],
    'phase5': [['episodes/' + ep + '/qa/qa.json','json']]
  };
  var phaseFiles = files[phaseId];
  if (!phaseFiles) { el.innerHTML = '<p>결과물 없음</p>'; return; }

  var html = '';
  for (var i = 0; i < phaseFiles.length; i++) {
    var path = phaseFiles[i][0];
    var type = phaseFiles[i][1];
    if (type === 'json') {
      var data = await loadJson(path);
      if (data) html += renderPhaseJson(phaseId, data);
      else html += '<p class="meta">데이터를 불러올 수 없습니다: ' + path + '</p>';
    } else {
      var text = await loadText(path);
      if (text) html += '<div class="output-section"><pre class="output-md">' + escapeHtml(text) + '</pre></div>';
    }
  }
  el.innerHTML = html || '<p>결과물 없음</p>';
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderPhaseJson(phaseId, d) {
  if (phaseId === 'phase1') {
    var scenes = (d.scenes||[]).map(function(s) {
      var dl = (s.dialogue||[]).map(function(x) { return '<div class="dialogue"><span class="char">' + (x.character||'') + ':</span> <span class="line">"' + (x.line||'') + '"</span></div>'; }).join('');
      return '<div class="output-item"><div class="output-title">장면 ' + s.scene_number + '</div>' +
        '<div class="output-desc">' + (s.description||'') + '</div>' + dl + '</div>';
    }).join('');
    return '<div class="output-section"><h4>' + (d.title||'') + '</h4>' + scenes + '</div>';
  }
  if (phaseId === 'phase2') {
    var chars = (d.characters||[]).map(function(c) {
      return '<div class="output-item"><div class="output-title">' + c.name + '</div>' +
        '<div class="output-desc">외모: ' + (c.appearance||'') + '</div>' +
        '<div class="output-desc">성격: ' + (c.personality||'') + '</div>' +
        '<div class="output-desc">스타일: ' + (c.style_notes||'') + '</div></div>';
    }).join('');
    return '<div class="output-section">' + chars + '</div>';
  }
  if (phaseId === 'phase3') {
    var pages = (d.pages||[]).map(function(pg) {
      var panels = (pg.panels||[]).map(function(p) {
        return '<div class="output-item"><span class="panel-id">' + p.panel_id + '</span> <span class="output-desc">' + (p.description||'') + '</span>' +
          '<span class="meta"> ' + (p.camera_angle||'') + (p.characters_in_frame && p.characters_in_frame.length ? ' · ' + p.characters_in_frame.join(', ') : '') + '</span></div>';
      }).join('');
      return '<div class="output-item"><div class="output-title">페이지 ' + pg.page_number + '</div>' +
        '<div class="output-desc">' + (pg.layout||'') + '</div>' + panels + '</div>';
    }).join('');
    return '<div class="output-section">' + pages + '</div>';
  }
  if (phaseId === 'phase4') {
    var panels = (d.panels||[]).map(function(p) {
      return '<div class="output-item"><span class="panel-id">' + p.panel_id + '</span>' +
        ' <span class="panel-score">AI ' + (p.ai_score||'-') + '/50</span>' +
        '<div class="output-desc">' + (p.description||'') + '</div>' +
        '<div class="output-prompt">' + (p.generation_prompt||'') + '</div>' +
        '<div class="placeholder-small">🖼️ [DRY RUN] ' + (p.image_path||'') + '</div></div>';
    }).join('');
    return '<div class="output-section">' + panels + '</div>';
  }
  if (phaseId === 'phase5') {
    var items = (d.items||[]).map(function(it) {
      return '<div class="output-item"><span class="output-title">' + it.category + ': ' + it.score + '/10</span>' +
        '<div class="output-desc">' + (it.notes||'') + '</div></div>';
    }).join('');
    return '<div class="output-section"><div class="output-title">총점: ' + (d.overall_score||'-') + '/50</div>' + items + '</div>';
  }
  return '<pre class="output-md">' + escapeHtml(JSON.stringify(d, null, 2)) + '</pre>';
}

// ===== Episode =====
async function renderEpisode() {
  setLoading();
  var state = await loadState();
  var episodes = state && state.episodes ? state.episodes : {};
  var keys = Object.keys(episodes);

  var listHtml = keys.length === 0 ?
    '<div class="card"><p>아직 에피소드가 없습니다.</p><p class="meta">EP001이 파이프라인을 거치면 표시됩니다.</p></div>' :
    keys.map(function(ep) {
      var d = episodes[ep];
      return '<div class="card"><h3>' + ep + ': ' + (d.title || ep) + '</h3>' +
        '<span class="badge badge-' + (d.status || 'pending') + '">' + (d.status || '대기') + '</span>' +
        '<p>현재 단계: ' + (d.current_phase || '-') + '</p></div>';
    }).join('');

  app.innerHTML = headerHtml() + navHtml() + patBanner() +
    '<div class="content"><h2>📖 에피소드</h2>' + listHtml + '</div>';
}

// ===== Prompts =====
async function renderPrompts() {
  setLoading();
  var state = await loadState();
  var budget = state && state.improvement_budget ? state.improvement_budget : {};
  var rollbacks = state && state.rollback_history ? state.rollback_history : [];

  app.innerHTML = headerHtml() + navHtml() + patBanner() +
    '<div class="content"><h2>📝 프롬프트 관리</h2>' +
    '<div class="card"><h3>🎯 개선 예산</h3>' +
    '<div class="budget-bar"><div class="budget-fill" style="width:' + ((budget.used||0)/(budget.total||15)*100) + '%"></div></div>' +
    '<p>사용: ' + (budget.used||0) + ' / ' + (budget.total||15) + '회 (Phase당 ' + (budget.per_phase_limit||5) + '회)</p></div>' +
    '<div class="card"><h3>📋 프롬프트 디렉토리</h3>' +
    '<p><a href="https://github.com/' + GH_ORG + '/' + GH_REPO + '/tree/main/prompts" target="_blank">GitHub에서 보기 →</a></p>' +
    '<ul class="prompt-list"><li>📁 prompts/story/</li><li>📁 prompts/character/</li><li>📁 prompts/storyboard/</li><li>📁 prompts/image/</li><li>📁 prompts/qa/</li></ul></div>' +
    '<div class="card"><h3>📊 롤백 이력</h3>' + (rollbacks.length === 0 ? '<p>기록 없음</p>' : rollbacks.map(function(r){return '<div>'+r+'</div>';}).join('')) + '</div>' +
    '</div>';
}

// ===== Settings =====
function renderSettings() {
  var patDisplay = PAT ? '•'.repeat(20) : '';
  app.innerHTML = headerHtml() + navHtml() +
    '<div class="content"><h2>⚙️ 설정</h2>' +
    '<div class="card"><h3>GitHub 인증</h3>' +
    '<p>PAT를 입력하면 GitHub API로 데이터를 실시간 연동합니다.</p>' +
    '<p class="warn">⚠️ 토큰은 브라우저 localStorage에만 저장됩니다.</p>' +
    '<div class="input-group">' +
    '<input type="password" id="pat-input" placeholder="ghp_..." value="' + patDisplay + '" class="pat-input" />' +
    '<button onclick="savePAT()" class="btn btn-primary">저장</button>' +
    (PAT ? '<button onclick="clearPAT()" class="btn btn-danger">삭제</button>' : '') +
    '</div></div>' +
    '<div class="card"><h3>🔗 연동</h3>' +
    '<p>리포: <a href="https://github.com/' + GH_ORG + '/' + GH_REPO + '" target="_blank">' + GH_ORG + '/' + GH_REPO + '</a></p>' +
    '<p>Actions: <a href="https://github.com/' + GH_ORG + '/' + GH_REPO + '/actions" target="_blank">실행 이력</a></p></div>' +
    '<div class="card"><h3>🔔 Discord</h3><p>웹훅: GitHub Actions → Discord 자동 알림</p><p>승인: #cle3-approvals</p></div>' +
    '</div>';
}

// ===== PAT =====
function savePAT() {
  var input = document.getElementById('pat-input');
  var val = input.value.trim();
  if (!val || val.indexOf('•') === 0) { showToast('PAT를 입력하세요', 'error'); return; }
  PAT = val;
  localStorage.setItem('cle3_pat', val);
  showToast('✅ PAT 저장됨', 'success');
  location.hash = 'dashboard';
  render();
}

function clearPAT() {
  PAT = '';
  localStorage.removeItem('cle3_pat');
  showToast('🗑️ PAT 삭제됨', 'success');
  renderSettings();
}

// ===== Toast =====
function showToast(msg, type) {
  var t = document.createElement('div');
  t.className = 'toast toast-' + (type || 'info');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 3000);
}

// ===== Init =====
route();
