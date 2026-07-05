/* CLE3 — 삼체 만화 창작 시스템 GitHub 연동 */

const GH_ORG = 'Daegu-Agent-Crew';
const GH_REPO = 'creative-loop-engineering3';
const GH_API = `https://api.github.com/repos/${GH_ORG}/${GH_REPO}`;
const CLE2_API = `https://api.github.com/repos/${GH_ORG}/creative-loop-engineering2`;

// ===== State =====
let PAT = localStorage.getItem('cle3_pat') || '';
let currentView = 'dashboard';

// ===== DOM =====
const app = document.getElementById('app');

// ===== Router =====
function route() {
  const hash = location.hash.slice(1) || 'dashboard';
  currentView = hash;
  render();
}

window.addEventListener('hashchange', route);

// ===== GitHub API =====
async function ghFetch(url, method = 'GET', body = null) {
  if (!PAT) { showSettings(); return null; }
  const opts = {
    method,
    headers: {
      'Authorization': `token ${PAT}`,
      'Accept': 'application/vnd.github+json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) { showToast('❌ PAT 인증 실패', 'error'); showSettings(); return null; }
  if (!res.ok) { showToast(`⚠️ ${res.status}`, 'error'); return null; }
  return method === 'DELETE' ? null : res.json();
}

// ===== Data Load =====
async function loadState() {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${GH_ORG}/${GH_REPO}/main/state.json`);
    return await res.json();
  } catch { return null; }
}

async function loadIssues() {
  return await ghFetch(`${CLE2_API}/issues?state=all&per_page=100&sort=created&direction=desc`) || [];
}

async function loadEpisodeData(epId) {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${GH_ORG}/${GH_REPO}/main/episodes/${epId}/script/script.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ===== Views =====
function render() {
  if (!PAT) { renderSettings(); return; }
  switch (currentView) {
    case 'dashboard': renderDashboard(); break;
    case 'settings': renderSettings(); break;
    case 'episode': renderEpisode(); break;
    case 'pipeline': renderPipeline(); break;
    case 'prompts': renderPrompts(); break;
    default: renderDashboard();
  }
}

function renderNav() {
  return `
    <nav class="navbar">
      <a href="#dashboard" class="${currentView==='dashboard'?'active':''}">📊 대시보드</a>
      <a href="#pipeline" class="${currentView==='pipeline'?'active':''}">🔄 파이프라인</a>
      <a href="#episode" class="${currentView==='episode'?'active':''}">📖 에피소드</a>
      <a href="#prompts" class="${currentView==='prompts'?'active':''}">📝 프롬프트</a>
      <a href="#settings" class="${currentView==='settings'?'active':''}">⚙️ 설정</a>
    </nav>
  `;
}

async function renderDashboard() {
  app.innerHTML = `<div class="loading">로딩 중...</div>`;
  const [state, issues] = await Promise.all([loadState(), loadIssues()]);
  const cle3Issue = issues.find(i => i.title.includes('[CLE2-9]'));

  let issueCard = '';
  if (cle3Issue) {
    issueCard = `
      <div class="card">
        <h3>📋 GitHub Issue</h3>
        <p><a href="${cle3Issue.html_url}" target="_blank">#${cle3Issue.number}: ${cle3Issue.title}</a></p>
        <span class="badge badge-${cle3Issue.state}">${cle3Issue.state === 'open' ? '진행 중' : '완료'}</span>
        <p class="meta">댓글 ${cle3Issue.comments}개 · ${new Date(cle3Issue.created_at).toLocaleDateString('ko-KR')}</p>
      </div>
    `;
  }

  const episodes = state?.episodes || {};
  const epCount = Object.keys(episodes).length;
  const currentEp = state?.current_episode || '-';
  const currentPhase = state?.current_phase || '-';
  const budget = state?.improvement_budget || {};
  const budgetUsed = budget.used || 0;
  const budgetTotal = budget.total || 15;

  app.innerHTML = `
    ${renderNav()}
    <div class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${epCount}</div>
          <div class="stat-label">에피소드</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${currentEp}</div>
          <div class="stat-label">현재 에피소드</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${currentPhase}</div>
          <div class="stat-label">현재 단계</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${budgetUsed}/${budgetTotal}</div>
          <div class="stat-label">개선 예산</div>
        </div>
      </div>

      ${issueCard}

      <div class="card">
        <h3>🔄 파이프라인 상태</h3>
        ${renderPipelineVisual(state)}
      </div>

      <div class="card">
        <h3>📚 최근 커밋</h3>
        <div id="commits" class="loading">로딩 중...</div>
      </div>
    </div>
  `;

  loadCommits();
}

function renderPipelineVisual(state) {
  const phases = [
    { id: 'phase0', name: '인프라', num: 0 },
    { id: 'phase1', name: '스토리', num: 1 },
    { id: 'phase2', name: '캐릭터', num: 2 },
    { id: 'phase3', name: '콘티', num: 3 },
    { id: 'phase4', name: '이미지', num: 4 },
    { id: 'phase5', name: '교정', num: 5 },
    { id: 'phase6', name: '배포', num: 6 }
  ];
  const currentPhase = state?.current_phase || '';
  const ep = state?.episodes?.[state?.current_episode];
  const phaseStatus = ep?.phases || {};

  let html = '<div class="pipeline-visual">';
  phases.forEach(p => {
    const status = phaseStatus[p.id]?.status || (currentPhase === p.id ? 'active' : 'pending');
    const cls = status === 'completed' ? 'completed' : status === 'active' ? 'active' : 'pending';
    html += `
      <div class="pipe-phase ${cls}">
        <div class="pipe-num">${p.num}</div>
        <div class="pipe-name">${p.name}</div>
        ${status === 'completed' ? '<div class="pipe-check">✅</div>' : ''}
        ${status === 'active' ? '<div class="pipe-pulse">🔄</div>' : ''}
      </div>
    `;
    if (p.num < 6) html += '<div class="pipe-arrow">→</div>';
  });
  html += '</div>';
  return html;
}

async function loadCommits() {
  const el = document.getElementById('commits');
  if (!el) return;
  const data = await ghFetch(`${GH_API}/commits?per_page=10`);
  if (!data) { el.innerHTML = '<p>로딩 실패</p>'; return; }
  el.innerHTML = data.map(c => `
    <div class="commit">
      <code class="sha">${c.sha.slice(0,7)}</code>
      <span class="msg">${c.commit.message.split('\n')[0]}</span>
      <span class="meta">${new Date(c.commit.author.date).toLocaleString('ko-KR')}</span>
    </div>
  `).join('');
}

async function renderPipeline() {
  app.innerHTML = `<div class="loading">로딩 중...</div>`;
  const state = await loadState();

  const phases = [
    { id: 'phase0', name: '인프라 구축', desc: '리포, Actions, Discord Bot, 스키마' },
    { id: 'phase0.5', name: '드라이런', desc: '더미 데이터 전 파이프라인 테스트' },
    { id: 'phase1', name: '스토리 각색', desc: '원작 → 대본/스크립트' },
    { id: 'phase2', name: '캐릭터 디자인', desc: '캐릭터 시트, 외모 일관성' },
    { id: 'phase3', name: '콘티/스토리보드', desc: '장면 구성, 페이지 레이아웃' },
    { id: 'phase4', name: '이미지 생성', desc: 'Codex CLI 패널 생성' },
    { id: 'phase5', name: '교정/QA', desc: '품질 검증, 수정 (≥42/50)' },
    { id: 'phase6', name: '배포', desc: 'GitHub Pages 에피소드 게시' }
  ];

  const ep = state?.episodes?.[state?.current_episode] || {};
  const phaseStatus = ep.phases || {};

  app.innerHTML = `
    ${renderNav()}
    <div class="content">
      <h2>🔄 파이프라인</h2>
      <div class="phase-list">
        ${phases.map(p => {
          const st = phaseStatus[p.id]?.status || (state?.current_phase === p.id ? 'active' : 'pending');
          const score = phaseStatus[p.id]?.score;
          const cls = st === 'completed' ? 'completed' : st === 'active' ? 'active' : 'pending';
          return `
            <div class="phase-row ${cls}">
              <div class="phase-icon">
                ${st === 'completed' ? '✅' : st === 'active' ? '🔄' : '⏳'}
              </div>
              <div class="phase-info">
                <div class="phase-title">${p.name}</div>
                <div class="phase-desc">${p.desc}</div>
                ${score ? `<div class="phase-score">평가: ${score}/50</div>` : ''}
              </div>
              <div class="phase-badge ${cls}">
                ${st === 'completed' ? '완료' : st === 'active' ? '진행 중' : '대기'}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="card">
        <h3>📊 평가 루브릭</h3>
        <p>각 Phase: 5개 항목 × 10점 = 50점 만점</p>
        <p>통과 기준: ≥40/50 (Phase 5는 ≥42/50)</p>
        <p><a href="https://github.com/${GH_ORG}/${GH_REPO}/blob/main/evaluation-rubric.md" target="_blank">상세 루브릭 보기 →</a></p>
      </div>
    </div>
  `;
}

async function renderEpisode() {
  app.innerHTML = `<div class="loading">로딩 중...</div>`;
  const state = await loadState();
  const episodes = state?.episodes || {};
  const epKeys = Object.keys(episodes);

  app.innerHTML = `
    ${renderNav()}
    <div class="content">
      <h2>📖 에피소드</h2>
      ${epKeys.length === 0 ? `
        <div class="card">
          <p>아직 에피소드가 없습니다.</p>
          <p class="meta">EP001이 파이프라인을 거치면 여기에 표시됩니다.</p>
        </div>
      ` : epKeys.map(ep => {
        const data = episodes[ep];
        return `
          <div class="card" onclick="location.href='#episode/${ep}'">
            <h3>${ep}: ${data.title || ep}</h3>
            <span class="badge badge-${data.status || 'pending'}">${data.status || '대기'}</span>
            <p>현재 단계: ${data.current_phase || '-'}</p>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function renderPrompts() {
  app.innerHTML = `<div class="loading">로딩 중...</div>`;
  const state = await loadState();
  const budget = state?.improvement_budget || {};

  app.innerHTML = `
    ${renderNav()}
    <div class="content">
      <h2>📝 프롬프트 관리</h2>

      <div class="card">
        <h3>🎯 개선 예산</h3>
        <div class="budget-bar">
          <div class="budget-fill" style="width: ${(budget.used||0)/(budget.total||15)*100}%"></div>
        </div>
        <p>사용: ${budget.used||0} / ${budget.total||15}회 (Phase당 ${budget.per_phase_limit||5}회)</p>
        <p>이월: ${budget.rollover ? '가능' : '불가'}</p>
      </div>

      <div class="card">
        <h3>📋 프롬프트 디렉토리</h3>
        <p><a href="https://github.com/${GH_ORG}/${GH_REPO}/tree/main/prompts" target="_blank">GitHub에서 프롬프트 보기 →</a></p>
        <ul class="prompt-list">
          <li>📁 prompts/story/ — 스토리 각색 프롬프트</li>
          <li>📁 prompts/character/ — 캐릭터 디자인 프롬프트</li>
          <li>📁 prompts/storyboard/ — 콘티 프롬프트</li>
          <li>📁 prompts/image/ — 이미지 생성 프롬프트</li>
          <li>📁 prompts/qa/ — QA 평가 프롬프트</li>
        </ul>
      </div>

      <div class="card">
        <h3>📊 롤백 이력</h3>
        ${(state?.rollback_history||[]).length === 0 ? '<p>롤백 기록 없음</p>' :
          state.rollback_history.map(r => `<div class="rollback-entry">${r}</div>`).join('')
        }
      </div>
    </div>
  `;
}

function renderSettings() {
  app.innerHTML = `
    ${renderNav()}
    <div class="content">
      <h2>⚙️ 설정</h2>
      <div class="card">
        <h3>GitHub 인증</h3>
        <p>PAT(Personal Access Token)를 입력하면 GitHub API로 이슈, 커밋, 에피소드 데이터를 실시간 연동합니다.</p>
        <p class="warn">⚠️ 토큰은 이 브라우저 localStorage에만 저장됩니다.</p>

        <div class="input-group">
          <input type="password" id="pat-input" placeholder="ghp_..." value="${PAT ? '•'.repeat(20) : ''}" class="pat-input" />
          <button onclick="savePAT()" class="btn btn-primary">저장</button>
          ${PAT ? '<button onclick="clearPAT()" class="btn btn-danger">삭제</button>' : ''}
        </div>
        <div id="pat-status"></div>
      </div>

      <div class="card">
        <h3>🔗 연동 정보</h3>
        <p>리포: <a href="https://github.com/${GH_ORG}/${GH_REPO}" target="_blank">${GH_ORG}/${GH_REPO}</a></p>
        <p>CLE2 이슈: <a href="https://github.com/${GH_ORG}/creative-loop-engineering2" target="_blank">${GH_ORG}/creative-loop-engineering2</a></p>
        <p>Actions: <a href="https://github.com/${GH_ORG}/${GH_REPO}/actions" target="_blank">실행 이력</a></p>
      </div>

      <div class="card">
        <h3>🔔 Discord</h3>
        <p>웹훅 알림: GitHub Actions → Discord 자동 전송</p>
        <p>승인 게이트: #cle3-approvals (✅/🔄/⏭️ 리액션)</p>
      </div>
    </div>
  `;
}

// ===== PAT =====
function savePAT() {
  const input = document.getElementById('pat-input');
  const val = input.value.trim();
  if (!val || val.startsWith('•')) { showToast('PAT를 입력하세요', 'error'); return; }
  if (!val.startsWith('ghp_') && !val.startsWith('github_pat_')) {
    showToast('올바른 PAT 형식이 아닙니다', 'error'); return;
  }
  PAT = val;
  localStorage.setItem('cle3_pat', val);
  input.value = '•'.repeat(20);
  showToast('✅ PAT 저장됨', 'success');
  setTimeout(() => location.hash = 'dashboard', 500);
}

function clearPAT() {
  PAT = '';
  localStorage.removeItem('cle3_pat');
  showToast('🗑️ PAT 삭제됨', 'success');
  showSettings();
}

function showSettings() {
  location.hash = 'settings';
}

// ===== Toast =====
function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== Init =====
route();
