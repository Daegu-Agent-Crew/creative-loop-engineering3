/* CLE3 - Three Body comic creation workspace */

const GH_ORG = 'Daegu-Agent-Crew';
const GH_REPO = 'creative-loop-engineering3';
const GH_API = `https://api.github.com/repos/${GH_ORG}/${GH_REPO}`;
const CLE2_API = `https://api.github.com/repos/${GH_ORG}/creative-loop-engineering2`;
const REMOTE_RAW_BASE = `https://raw.githubusercontent.com/${GH_ORG}/${GH_REPO}/main/`;
const PAT_STORAGE_KEY = 'cle3_pat';
const QA_REVIEW_STORAGE_KEY = 'cle3_qa_reviews';

let PAT = localStorage.getItem(PAT_STORAGE_KEY) || '';
let currentView = 'dashboard';
let currentParam = null;
let currentSubView = null;

const app = document.getElementById('app');

const PHASE_SEQUENCE = [
  ['phase0', '인프라', '리포, Actions, Discord Bot, 스키마'],
  ['phase0.5', '드라이런', '더미 데이터 전 파이프라인 테스트'],
  ['phase1', '스토리', '원작 -> 분석 -> 구조 -> 장면 -> 대본'],
  ['phase2', '캐릭터', '캐릭터 시트, 외모 일관성'],
  ['phase3', '스토리보드', '페이지/패널 레이아웃'],
  ['phase4', '패널', '이미지 생성 및 패널 프롬프트'],
  ['phase5', 'QA', '품질 검수와 승인'],
  ['phase6', '배포', 'GitHub Pages 게시']
];

const EPISODE_TABS = [
  ['overview', '개요'],
  ['script', '대본'],
  ['characters', '캐릭터'],
  ['storyboard', '콘티'],
  ['panels', '패널'],
  ['qa', 'QA']
];

const SUBPHASE_LABELS = {
  characters: '캐릭터 디자인',
  story: '스토리 설계',
  storyboard: '콘티 설계',
  panels: '패널 생성',
  qa: '품질 검수',
  deploy: '배포 준비'
};

const PHASE_OUTPUTS = {
  phase1: { label: '스토리 대본', files: ['script/script.json', 'script/script.md'] },
  phase2: { label: '캐릭터 시트', files: ['characters/characters.json'] },
  phase3: { label: '스토리보드', files: ['storyboard/storyboard.json'] },
  phase4: { label: '패널 산출물', files: ['panels/panels.json'] },
  phase5: { label: 'QA 리포트', files: ['qa/qa.json'] }
};

window.addEventListener('hashchange', route);

function route() {
  const hash = location.hash.slice(1) || 'dashboard';
  const parts = hash.split('/');
  currentView = parts[0] || 'dashboard';
  currentParam = parts[1] || null;
  currentSubView = parts[2] || null;
  render();
}

function isLocalDataMode() {
  return location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

function dataUrl(path) {
  if (isLocalDataMode()) {
    return `../${path}`;
  }
  return REMOTE_RAW_BASE + path;
}

function assetUrl(path) {
  if (!path) return '';
  return dataUrl(path);
}

function repoBlobUrl(path) {
  return `https://github.com/${GH_ORG}/${GH_REPO}/blob/main/${path}`;
}

function episodeDocUrl(episodeId) {
  if (isLocalDataMode()) {
    return `episodes/${episodeId}/`;
  }
  return `episodes/${episodeId}/`;
}

function currentEpisodeId(state) {
  if (currentParam) return currentParam;
  if (state && state.current_episode) return state.current_episode;
  return 'EP001';
}

function phaseLabel(phaseId) {
  const match = PHASE_SEQUENCE.find(function (item) { return item[0] === phaseId; });
  return match ? match[1] : phaseId;
}

function detailPhaseLabel(phaseId) {
  if (!phaseId) return '-';
  if (phaseId.indexOf('_') >= 0) {
    const major = phaseId.split('_')[0];
    const rest = phaseId.split('_').slice(1).map(function (item) {
      return SUBPHASE_LABELS[item] || item;
    }).join(' / ');
    return phaseLabel(major) + ' / ' + rest;
  }
  return phaseLabel(phaseId);
}

function statusBadgeClass(status) {
  if (status === 'completed' || status === 'done') return 'completed';
  if (status === 'active' || status === 'in_progress' || status === 'open') return 'active';
  return 'pending';
}

function statusText(status) {
  if (status === 'completed' || status === 'done') return '완료';
  if (status === 'active' || status === 'in_progress' || status === 'open') return '진행 중';
  return '대기';
}

function workflowStatusText(status) {
  if (status === 'in_progress') return '진행 중';
  if (status === 'completed' || status === 'done') return '완료';
  if (status === 'pending') return '대기';
  return status || '-';
}

async function ghFetch(url, method, body) {
  if (!PAT) return null;
  const options = {
    method: method || 'GET',
    headers: {
      Authorization: 'token ' + PAT,
      Accept: 'application/vnd.github+json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(url, options);
    if (res.status === 401) {
      showToast('PAT 인증 실패', 'error');
      return null;
    }
    if (!res.ok) return null;
    if (method === 'DELETE') return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

async function loadState() {
  return loadJson('state.json');
}

async function loadIssues() {
  if (!PAT) return [];
  return await ghFetch(CLE2_API + '/issues?state=all&per_page=100&sort=created&direction=desc') || [];
}

async function loadCommits() {
  if (!PAT) return [];
  return await ghFetch(GH_API + '/commits?per_page=10') || [];
}

async function loadJson(path) {
  try {
    const res = await fetch(dataUrl(path));
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

async function loadText(path) {
  try {
    const res = await fetch(dataUrl(path));
    if (!res.ok) return null;
    return await res.text();
  } catch (error) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMarkdownHeading(text) {
  const match = text && text.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function extractMarkdownTableValue(text, label) {
  if (!text) return '';
  const pattern = new RegExp('\\|\\s*' + escapeRegExp(label) + '\\s*\\|\\s*([^|]+)\\|');
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
}

function extractMarkdownLineValue(text, prefix) {
  if (!text) return '';
  const pattern = new RegExp('^(?:>|-)\\s*' + escapeRegExp(prefix) + '\\s*:?\\s*(.+)$', 'm');
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
}

function extractMarkdownSection(text, heading) {
  if (!text) return '';
  const pattern = new RegExp('^##\\s+' + escapeRegExp(heading) + '\\s*\\n([\\s\\S]*?)(?=^##\\s+|\\Z)', 'm');
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
}

function markdownListItems(sectionText) {
  if (!sectionText) return [];
  return sectionText
    .split('\n')
    .map(function (line) { return line.trim(); })
    .filter(function (line) { return /^- /.test(line); })
    .map(function (line) { return line.replace(/^- /, '').trim(); });
}

function markdownChecklistItems(sectionText) {
  if (!sectionText) return [];
  return sectionText
    .split('\n')
    .map(function (line) { return line.trim(); })
    .filter(function (line) { return /^- \[.\]/.test(line); })
    .map(function (line) { return line.replace(/^- \[(.| )\]\s*/, '').trim(); });
}

function renderMarkdownPreview(text) {
  if (!text) return '<p class="meta">원본 markdown이 없습니다.</p>';
  return `<pre class="output-md">${escapeHtml(text)}</pre>`;
}

function loadQaReviews() {
  try {
    return JSON.parse(localStorage.getItem(QA_REVIEW_STORAGE_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function defaultPanelReview() {
  return {
    status: 'pending',
    note: '',
    composition: 'unchecked',
    clarity: 'unchecked',
    emotion: 'unchecked',
    consistency: 'unchecked',
    action_required: ''
  };
}

function normalizePanelReview(review) {
  return Object.assign(defaultPanelReview(), review || {});
}

function normalizeQaReview(review) {
  const base = Object.assign({
    status: 'pending',
    verdict: '',
    note: '',
    updatedAt: '',
    panels: {}
  }, review || {});
  const normalizedPanels = {};
  Object.keys(base.panels || {}).forEach(function (panelId) {
    normalizedPanels[panelId] = normalizePanelReview(base.panels[panelId]);
  });
  base.panels = normalizedPanels;
  return base;
}

function loadQaReview(episodeId) {
  const review = loadQaReviews()[episodeId];
  return review ? normalizeQaReview(review) : null;
}

function saveQaReviewRecord(episodeId, record) {
  const all = loadQaReviews();
  all[episodeId] = normalizeQaReview(record);
  localStorage.setItem(QA_REVIEW_STORAGE_KEY, JSON.stringify(all));
}

function panelCriterionLabel(key) {
  if (key === 'composition') return '구도';
  if (key === 'clarity') return '가독성';
  if (key === 'emotion') return '감정';
  if (key === 'consistency') return '일관성';
  return key;
}

function criterionStatusLabel(value) {
  if (value === 'pass') return '양호';
  if (value === 'warn') return '보완';
  if (value === 'fail') return '문제';
  return '미확인';
}

function panelCriteriaSummary(panelReview) {
  const fields = ['composition', 'clarity', 'emotion', 'consistency'];
  return fields.map(function (field) {
    return panelCriterionLabel(field) + ' ' + criterionStatusLabel((panelReview || {})[field] || 'unchecked');
  }).join(' / ');
}

function storyboardPanelIds(storyboard) {
  const ids = [];
  ((storyboard && storyboard.pages) || []).forEach(function (page) {
    (page.panels || []).forEach(function (panel) {
      if (panel && panel.panel_id) ids.push(panel.panel_id);
    });
  });
  return ids;
}

function summarizeCriterionCounts(panelList, panels) {
  const summary = { pass: 0, warn: 0, fail: 0, unchecked: 0 };
  (panelList || []).forEach(function (panel) {
    const panelId = typeof panel === 'string' ? panel : panel.panel_id;
    ['composition', 'clarity', 'emotion', 'consistency'].forEach(function (field) {
      const value = (panels && panels[panelId] && panels[panelId][field]) || 'unchecked';
      if (summary[value] == null) summary[value] = 0;
      summary[value] += 1;
    });
  });
  return summary;
}

function summarizePanelActionItems(panelList, panels) {
  return (panelList || []).map(function (panel) {
    const panelId = typeof panel === 'string' ? panel : panel.panel_id;
    const review = normalizePanelReview(panels && panels[panelId]);
    if (!review.action_required) return null;
    return `${panelId}: ${review.action_required}`;
  }).filter(Boolean);
}

function loadPanelReviewFromForm(episodeId, panelId, currentReview) {
  const review = Object.assign(defaultPanelReview(), currentReview || {});
  const noteEl = document.getElementById('panel-note-' + episodeId + '-' + panelId);
  const actionEl = document.getElementById('panel-action-' + episodeId + '-' + panelId);
  review.note = noteEl ? noteEl.value.trim() : (review.note || '');
  review.action_required = actionEl ? actionEl.value.trim() : (review.action_required || '');
  ['composition', 'clarity', 'emotion', 'consistency'].forEach(function (field) {
    const fieldEl = document.getElementById('panel-' + field + '-' + episodeId + '-' + panelId);
    review[field] = fieldEl ? fieldEl.value : (review[field] || 'unchecked');
  });
  return review;
}

function asNumberLike(value) {
  if (value == null) return null;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function buildConsistencyReport(context) {
  const issues = [];
  const script = context.script || {};
  const storyboard = context.storyboard || {};
  const panels = context.panels || {};
  const qa = context.qa || {};
  const scriptPageCount = asNumberLike(script.page_count || extractMarkdownTableValue(context.scriptMd || '', '페이지 수'));
  const storyboardPageCount = storyboard.pages && storyboard.pages.length ? storyboard.pages.length : asNumberLike(extractMarkdownTableValue(context.storyboardMd || '', '총 페이지'));
  const panelCount = panels.panels && panels.panels.length ? panels.panels.length : null;
  const storyboardPanelCount = storyboardPanelIds(storyboard).length || null;
  const castFromJson = script.main_characters || [];
  const castFromMd = extractMarkdownTableValue(context.scriptMd || '', '주요 등장인물')
    .split(',')
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
  const publishedViewer = extractMarkdownLineValue(context.resultsMd || '', 'published_viewer');
  const sourcePanels = extractMarkdownLineValue(context.resultsMd || '', 'source_panels');
  const hasManifest = !!context.manifestMd;

  if (!scriptPageCount) {
    issues.push({ level: 'warn', label: 'script', message: '대본 페이지 수를 확인할 수 없습니다.' });
  }

  if (!storyboardPageCount) {
    issues.push({ level: 'warn', label: 'storyboard', message: '스토리보드 페이지 수를 확인할 수 없습니다.' });
  }

  if (scriptPageCount && storyboardPageCount && scriptPageCount !== storyboardPageCount) {
    issues.push({ level: 'error', label: 'page-count', message: `대본 페이지 수(${scriptPageCount})와 스토리보드 페이지 수(${storyboardPageCount})가 다릅니다.` });
  }

  if (storyboardPanelCount && panelCount && storyboardPanelCount !== panelCount) {
    issues.push({ level: 'error', label: 'panel-count', message: `스토리보드 패널 수(${storyboardPanelCount})와 panels.json 패널 수(${panelCount})가 다릅니다.` });
  }

  if (storyboardPanelCount && !panelCount) {
    issues.push({ level: 'warn', label: 'panel-count', message: `스토리보드에는 패널 ${storyboardPanelCount}개가 있으나 panels.json이 아직 없습니다.` });
  }

  if (storyboardPanelCount && panelCount) {
    const storyboardIds = storyboardPanelIds(storyboard);
    const panelIds = panels.panels.map(function (panel) { return panel.panel_id; });
    const missingInPanels = storyboardIds.filter(function (id) { return panelIds.indexOf(id) === -1; });
    const extraPanels = panelIds.filter(function (id) { return storyboardIds.indexOf(id) === -1; });
    if (missingInPanels.length) {
      issues.push({ level: 'error', label: 'panel-coverage', message: `스토리보드 기준 panels.json에 없는 패널: ${missingInPanels.slice(0, 5).join(', ')}${missingInPanels.length > 5 ? ' 외' : ''}` });
    }
    if (extraPanels.length) {
      issues.push({ level: 'warn', label: 'panel-coverage', message: `panels.json에만 있는 패널: ${extraPanels.slice(0, 5).join(', ')}${extraPanels.length > 5 ? ' 외' : ''}` });
    }
  }

  if (castFromJson.length && castFromMd.length) {
    const missingInJson = castFromMd.filter(function (name) { return castFromJson.indexOf(name) === -1; });
    if (missingInJson.length) {
      issues.push({ level: 'warn', label: 'characters', message: `script.md 등장인물 중 JSON에 없는 항목: ${missingInJson.join(', ')}` });
    }
  }

  if (!castFromJson.length && castFromMd.length) {
    issues.push({ level: 'info', label: 'characters', message: '캐릭터 JSON이 없어 script.md 기준 등장인물만 사용 중입니다.' });
  }

  if (sourcePanels && !hasManifest) {
    issues.push({ level: 'error', label: 'panels', message: 'results.md에는 source_panels가 있지만 panels/MANIFEST.md가 없습니다.' });
  }

  if (hasManifest && panelCount == null) {
    issues.push({ level: 'info', label: 'panels', message: '패널 manifest는 있으나 개별 패널 JSON/이미지 메타는 아직 없습니다.' });
  }

  if (panels.prompt_version && /dryrun/i.test(String(panels.prompt_version))) {
    issues.push({ level: 'warn', label: 'panels', message: `panels.json prompt_version이 ${panels.prompt_version}라 아직 드라이런 산출물일 가능성이 큽니다.` });
  }

  const currentStyle = stateStyleName(context.state);
  const staleStyles = ((panels.panels || []).map(function (panel) { return panel.style; }).filter(Boolean)).filter(function (style) {
    return currentStyle && style !== currentStyle;
  });
  if (staleStyles.length) {
    issues.push({ level: 'warn', label: 'style', message: `현재 art_style(${currentStyle})와 다른 패널 style이 남아 있습니다: ${Array.from(new Set(staleStyles)).join(', ')}` });
  }

  if (publishedViewer && !context.publishedViewerHtml) {
    issues.push({ level: 'warn', label: 'publish', message: `results.md에 공개 뷰어 경로(${publishedViewer})가 있으나 CLE3 저장소에는 아직 viewer 파일이 없습니다.` });
  }

  if (qa.overall_score == null && context.resultsMd) {
    issues.push({ level: 'info', label: 'qa', message: 'qa.json 대신 results.md 상태값만 존재합니다.' });
  }

  const errorCount = issues.filter(function (issue) { return issue.level === 'error'; }).length;
  const warnCount = issues.filter(function (issue) { return issue.level === 'warn'; }).length;
  const infoCount = issues.filter(function (issue) { return issue.level === 'info'; }).length;
  const status = errorCount ? '오류 있음' : (warnCount ? '검토 필요' : '정상');

  return {
    status: status,
    issues: issues,
    counts: { error: errorCount, warn: warnCount, info: infoCount }
  };
}

function stateStyleName(state) {
  return state && state.art_style && state.art_style.name ? state.art_style.name : '';
}

function buildVisionQaSnapshot(context, review, lintReport) {
  const panelList = (context.panels && context.panels.panels) || [];
  const panelReviewSummary = summarizePanelReviews(panelList, review.panels || {});
  const criterionSummary = summarizeCriterionCounts(panelList, review.panels || {});
  const actionItems = summarizePanelActionItems(panelList, review.panels || {});
  const qaScore = context.qa && context.qa.overall_score != null ? context.qa.overall_score : null;
  const releaseGate = lintReport.counts.error === 0 && review.status === 'approved' ? 'ready' : 'blocked';
  return {
    qaScore: qaScore,
    releaseGate: releaseGate,
    panelReviewSummary: panelReviewSummary,
    criterionSummary: criterionSummary,
    actionItems: actionItems
  };
}

function buildVisionQaResultsSection(context, review, lintReport) {
  const snapshot = buildVisionQaSnapshot(context, review, lintReport);
  const lines = [
    '## Vision QA Summary',
    `- review_status: ${renderQaStatusLabel(review.status || 'pending')}`,
    `- updated_at: ${review.updatedAt || '-'}`,
    `- qa_score: ${snapshot.qaScore != null ? snapshot.qaScore + '/50' : '-'}`,
    `- release_gate: ${snapshot.releaseGate}`,
    `- lint_gate: error ${lintReport.counts.error} / warn ${lintReport.counts.warn} / info ${lintReport.counts.info}`,
    '',
    '### Episode Verdict',
    review.verdict || '미작성',
    '',
    '### Reviewer Notes',
    review.note || '미작성',
    '',
    '### Panel QA Status',
    `- approved: ${snapshot.panelReviewSummary.approved}`,
    `- changes_requested: ${snapshot.panelReviewSummary.changes_requested}`,
    `- hold: ${snapshot.panelReviewSummary.hold}`,
    `- pending: ${snapshot.panelReviewSummary.pending}`,
    '',
    '### Panel QA Criteria',
    `- pass: ${snapshot.criterionSummary.pass}`,
    `- warn: ${snapshot.criterionSummary.warn}`,
    `- fail: ${snapshot.criterionSummary.fail}`,
    `- unchecked: ${snapshot.criterionSummary.unchecked}`,
    '',
    '### Action Required',
    snapshot.actionItems.length ? snapshot.actionItems.map(function (item) { return `- ${item}`; }).join('\n') : '- 없음'
  ];
  return lines.join('\n');
}

function navHtml() {
  const items = [
    ['dashboard', '대시보드'],
    ['pipeline', '파이프라인'],
    ['episode', '에피소드'],
    ['prompts', '프롬프트'],
    ['settings', '설정']
  ];

  return '<nav class="navbar">' + items.map(function (item) {
    const cls = currentView === item[0] ? 'active' : '';
    return `<a href="#${item[0]}" class="${cls}">${item[1]}</a>`;
  }).join('') + '</nav>';
}

function headerHtml() {
  return '<div class="header"><h1>CLE3</h1><div class="subtitle">삼체 만화 창작 시스템</div></div>';
}

function loadingHtml() {
  return headerHtml() + navHtml() + '<div class="content"><div class="loading">로딩 중...</div></div>';
}

function setLoading() {
  app.innerHTML = loadingHtml();
}

function patBanner() {
  if (PAT) return '';
  return '<div class="pat-banner">GitHub PAT가 아직 없습니다. 설정에서 저장하고 테스트하면 이슈와 커밋 연동이 활성화됩니다. <a href="#settings">설정 열기</a></div>';
}

function sourceModeBanner() {
  if (!isLocalDataMode()) return '';
  return '<div class="mode-banner">로컬 데이터 모드: 현재 브라우저는 저장소의 로컬 파일을 직접 읽고 있습니다.</div>';
}

function statCard(value, label) {
  return `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

function render() {
  switch (currentView) {
    case 'pipeline':
      renderPipeline();
      break;
    case 'episode':
      renderEpisode();
      break;
    case 'prompts':
      renderPrompts();
      break;
    case 'settings':
      renderSettings();
      break;
    default:
      renderDashboard();
  }
}

async function renderDashboard() {
  setLoading();
  const state = await loadState();
  const issues = await loadIssues();
  const commits = await loadCommits();
  const episodes = state && state.episodes ? state.episodes : {};
  const episodeKeys = Object.keys(episodes);
  const activeEpisodeId = currentEpisodeId(state);
  const activeEpisode = episodes[activeEpisodeId] || null;
  const cle3Issue = issues.find(function (issue) { return issue.title.indexOf('[CLE2-9]') >= 0; });
  const budget = state && state.improvement_budget ? state.improvement_budget : {};
  const phaseCards = episodeKeys.map(function (episodeId) {
    const episode = episodes[episodeId];
    return `<a class="episode-mini-card" href="#episode/${episodeId}/overview">
      <div class="episode-mini-title">${episodeId}</div>
      <div class="episode-mini-meta">${escapeHtml(episode.title || episodeId)}</div>
      <div class="episode-mini-meta">${detailPhaseLabel(episode.current_phase || '-')}</div>
    </a>`;
  }).join('');

  const issueHtml = cle3Issue ? `
    <div class="card">
      <h3>요구사항 기준 이슈</h3>
      <p><a href="${cle3Issue.html_url}" target="_blank">#${cle3Issue.number}: ${escapeHtml(cle3Issue.title)}</a></p>
      <span class="badge badge-${cle3Issue.state}">${cle3Issue.state === 'open' ? '진행 중' : '완료'}</span>
      <p class="meta">댓글 ${cle3Issue.comments}개</p>
    </div>` : '';

  const commitHtml = commits.length ? commits.map(function (commit) {
    return `<div class="commit">
      <code class="sha">${commit.sha.slice(0, 7)}</code>
      <span class="msg">${escapeHtml(commit.commit.message.split('\n')[0])}</span>
      <span class="meta">${new Date(commit.commit.author.date).toLocaleString('ko-KR')}</span>
    </div>`;
  }).join('') : '<p class="meta">PAT 저장 후 테스트를 통과하면 최근 커밋 이력이 표시됩니다.</p>';

  app.innerHTML = headerHtml() + navHtml() + patBanner() + sourceModeBanner() + `
    <div class="content">
      <div class="stats-grid">
        ${statCard(episodeKeys.length || 0, '에피소드')}
        ${statCard(activeEpisodeId, '현재 에피소드')}
        ${statCard(detailPhaseLabel(state && state.current_phase ? state.current_phase : '-'), '현재 단계')}
        ${statCard((budget.used || 0) + '/' + (budget.total || 15), '개선 예산')}
      </div>
      ${issueHtml}
      <div class="card">
        <h3>현재 작업 에피소드</h3>
        <p>${activeEpisode ? escapeHtml(activeEpisode.title || activeEpisodeId) : '-'}</p>
        <p class="meta">상태: ${activeEpisode ? escapeHtml(workflowStatusText(activeEpisode.status || '-')) : '-'} / 단계: ${activeEpisode ? detailPhaseLabel(activeEpisode.current_phase || '-') : '-'}</p>
        <p><a href="#episode/${activeEpisodeId}/overview">Episode Workspace 열기</a></p>
      </div>
      <div class="card">
        <h3>파이프라인 개요</h3>
        ${pipelineVisual(state, activeEpisodeId)}
      </div>
      <div class="card">
        <h3>에피소드 워크스페이스</h3>
        <div class="episode-mini-grid">${phaseCards || '<p class="meta">에피소드 데이터가 없습니다.</p>'}</div>
      </div>
      <div class="card">
        <h3>최근 커밋</h3>
        ${commitHtml}
      </div>
    </div>`;
}

function pipelineVisual(state, episodeId) {
  const episode = state && state.episodes ? state.episodes[episodeId] : null;
  const phases = episode && episode.phases ? episode.phases : {};

  let html = '<div class="pipeline-visual">';
  PHASE_SEQUENCE.forEach(function (phase, index) {
    const phaseId = phase[0];
    const phaseState = phases[phaseId] ? phases[phaseId].status : 'pending';
    const cls = statusBadgeClass(phaseState);
    const icon = cls === 'completed' ? '✓' : (cls === 'active' ? '●' : '');
    html += `<div class="pipe-phase ${cls}">
      <div class="pipe-num">${index}</div>
      <div class="pipe-name">${phase[1]}</div>
      ${icon ? `<div class="pipe-check">${icon}</div>` : ''}
    </div>`;
    if (index < PHASE_SEQUENCE.length - 1) {
      html += '<div class="pipe-arrow">→</div>';
    }
  });
  html += '</div>';
  return html;
}

async function renderPipeline() {
  setLoading();
  const state = await loadState();
  const episodeId = currentEpisodeId(state);
  const episode = state && state.episodes ? state.episodes[episodeId] : null;
  const phases = episode && episode.phases ? episode.phases : {};

  const listHtml = PHASE_SEQUENCE.map(function (phase) {
    const phaseId = phase[0];
    const phaseState = phases[phaseId] ? phases[phaseId].status : 'pending';
    const score = phases[phaseId] ? phases[phaseId].score : null;
    const cls = statusBadgeClass(phaseState);
    const toggleId = 'phase-output-' + phaseId.replace(/[^a-zA-Z0-9]/g, '');
    const hasOutput = !!PHASE_OUTPUTS[phaseId];
    return `<div class="phase-row ${cls}">
      <div class="phase-icon">${cls === 'completed' ? '✓' : (cls === 'active' ? '●' : '…')}</div>
      <div class="phase-info">
        <div class="phase-title">${phase[1]}${hasOutput ? ` <a href="javascript:void(0)" onclick="toggleOutput('${toggleId}','${phaseId}','${episodeId}')" class="expand-btn">결과물 보기</a>` : ''}</div>
        <div class="phase-desc">${phase[2]}</div>
        ${score ? `<div class="phase-score">평가: ${score}/50</div>` : ''}
      </div>
      <div class="phase-badge ${cls}">${statusText(phaseState)}</div>
    </div>
    ${hasOutput ? `<div id="${toggleId}" class="phase-output" style="display:none"></div>` : ''}`;
  }).join('');

  app.innerHTML = headerHtml() + navHtml() + patBanner() + sourceModeBanner() + `
    <div class="content">
      <h2>파이프라인</h2>
      <div class="card">
        <h3>${episodeId}</h3>
        <p>${episode ? escapeHtml(episode.title || episodeId) : '에피소드 정보 없음'}</p>
        <p class="meta">현재 단계: ${episode ? detailPhaseLabel(episode.current_phase || '-') : '-'}</p>
      </div>
      <div class="phase-list">${listHtml}</div>
      <div class="card">
        <h3>평가 루브릭</h3>
        <p>각 Phase는 5개 항목 x 10점 = 50점 기준으로 평가합니다.</p>
        <p>통과 기준은 일반 Phase 40점 이상, QA는 42점 이상입니다.</p>
        <p><a href="${repoBlobUrl('evaluation-rubric.md')}" target="_blank">루브릭 문서 열기</a></p>
      </div>
      <div class="card">
        <h3>작업 이동</h3>
        <p><a href="#episode/${episodeId}/overview">Episode Workspace 열기</a></p>
        <p><a href="${episodeDocUrl(episodeId)}" target="_blank">공개 뷰어 열기</a></p>
      </div>
    </div>`;
}

async function toggleOutput(elementId, phaseId, episodeId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  if (element.style.display !== 'none') {
    element.style.display = 'none';
    return;
  }

  element.style.display = 'block';
  element.innerHTML = '<div class="loading">결과물 로딩 중...</div>';

  const config = PHASE_OUTPUTS[phaseId];
  if (!config) {
    element.innerHTML = '<p class="meta">결과물 정의가 없습니다.</p>';
    return;
  }

  let html = `<div class="output-section"><h4>${config.label}</h4></div>`;
  for (let index = 0; index < config.files.length; index += 1) {
    const relativePath = `episodes/${episodeId}/${config.files[index]}`;
    if (relativePath.endsWith('.json')) {
      const json = await loadJson(relativePath);
      html += json ? renderPhaseJson(phaseId, json) : `<p class="meta">불러오지 못함: ${relativePath}</p>`;
    } else {
      const text = await loadText(relativePath);
      html += text ? `<pre class="output-md">${escapeHtml(text)}</pre>` : `<p class="meta">불러오지 못함: ${relativePath}</p>`;
    }
  }
  element.innerHTML = html;
}

function renderPhaseJson(phaseId, data) {
  if (phaseId === 'phase1') {
    const scenes = (data.scenes || []).map(function (scene) {
      const dialogue = (scene.dialogue || []).map(function (line) {
        return `<div class="dialogue"><span class="char">${escapeHtml(line.character || '')}:</span> <span class="line">"${escapeHtml(line.line || '')}"</span></div>`;
      }).join('');
      return `<div class="output-item">
        <div class="output-title">장면 ${scene.scene_number}: ${escapeHtml(scene.title || '')}</div>
        <div class="output-desc">${escapeHtml(scene.description || '')}</div>
        ${scene.narration ? `<div class="output-desc">내레이션: ${escapeHtml(scene.narration)}</div>` : ''}
        ${dialogue}
      </div>`;
    }).join('');
    return `<div class="output-section">${scenes}</div>`;
  }

  if (phaseId === 'phase2') {
    return `<div class="output-section">${(data.characters || []).map(function (character) {
      return `<div class="output-item">
        <div class="output-title">${escapeHtml(character.name || '')}</div>
        <div class="output-desc">외모: ${escapeHtml(character.appearance || '')}</div>
        <div class="output-desc">성격: ${escapeHtml(character.personality || '')}</div>
        <div class="output-desc">스타일 노트: ${escapeHtml(character.style_notes || '')}</div>
      </div>`;
    }).join('')}</div>`;
  }

  if (phaseId === 'phase3') {
    return `<div class="output-section">${(data.pages || []).map(function (page) {
      return `<div class="output-item">
        <div class="output-title">페이지 ${page.page_number}</div>
        <div class="output-desc">레이아웃: ${escapeHtml(page.layout || '')}</div>
        ${(page.panels || []).map(function (panel) {
          return `<div class="panel-summary">
            <span class="panel-id">${escapeHtml(panel.panel_id || '')}</span>
            <span class="meta">${escapeHtml(panel.camera_angle || '')}</span>
            <div class="output-desc">${escapeHtml(panel.description || '')}</div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}</div>`;
  }

  if (phaseId === 'phase4') {
    return `<div class="output-section">${(data.panels || []).map(function (panel) {
      return `<div class="output-item">
        <div class="output-title">${escapeHtml(panel.panel_id || '')} <span class="meta">AI ${escapeHtml(panel.ai_score || '-')} / 50</span></div>
        <div class="output-desc">${escapeHtml(panel.description || '')}</div>
        ${panel.generation_prompt ? `<div class="output-prompt">${escapeHtml(panel.generation_prompt)}</div>` : ''}
        ${panel.image_path ? `<div class="placeholder-small">${escapeHtml(panel.image_path)}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  if (phaseId === 'phase5') {
    return `<div class="output-section">
      <div class="output-title">총점: ${escapeHtml(data.overall_score || '-')} / 50</div>
      ${(data.items || []).map(function (item) {
        return `<div class="output-item">
          <div class="output-title">${escapeHtml(item.category || '')}: ${escapeHtml(item.score || '-')} / 10</div>
          <div class="output-desc">${escapeHtml(item.notes || '')}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  return `<pre class="output-md">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
}

async function renderEpisode() {
  setLoading();
  const state = await loadState();
  const episodes = state && state.episodes ? state.episodes : {};
  const episodeIds = Object.keys(episodes);
  const episodeId = currentEpisodeId(state);
  const episode = episodes[episodeId] || null;

  if (!currentParam) {
    const listHtml = episodeIds.length ? episodeIds.map(function (id) {
      const item = episodes[id];
      const externalUrl = id === 'EP001' ? episodeDocUrl(id) : repoBlobUrl(`episodes/${id}`);
      const externalLabel = id === 'EP001' ? '공개 뷰어' : '에피소드 소스';
      return `<div class="card">
        <h3>${id}: ${escapeHtml(item.title || id)}</h3>
        <p>상태: <span class="badge badge-${statusBadgeClass(item.status || 'pending')}">${statusText(item.status || 'pending')}</span></p>
        <p>현재 단계: ${detailPhaseLabel(item.current_phase || '-')}</p>
        <div class="action-row">
          <a class="btn-link" href="#episode/${id}/overview">Workspace 열기</a>
          <a class="btn-link" href="${externalUrl}" target="_blank">${externalLabel}</a>
        </div>
      </div>`;
    }).join('') : '<div class="card"><p>아직 에피소드가 없습니다.</p></div>';

    app.innerHTML = headerHtml() + navHtml() + patBanner() + sourceModeBanner() + `
      <div class="content">
        <h2>에피소드</h2>
        ${listHtml}
      </div>`;
    return;
  }

  const tab = currentSubView || 'overview';
  const tabNav = EPISODE_TABS.map(function (item) {
    const cls = tab === item[0] ? 'active' : '';
    return `<a href="#episode/${episodeId}/${item[0]}" class="tab-chip ${cls}">${item[1]}</a>`;
  }).join('');

  const [script, characters, storyboard, panels, qa, scriptMd, storyboardMd, resultsMd, manifestMd, publishedViewerHtml] = await Promise.all([
    loadJson(`episodes/${episodeId}/script/script.json`),
    loadJson(`episodes/${episodeId}/characters/characters.json`),
    loadJson(`episodes/${episodeId}/storyboard/storyboard.json`),
    loadJson(`episodes/${episodeId}/panels/panels.json`),
    loadJson(`episodes/${episodeId}/qa/qa.json`),
    loadText(`episodes/${episodeId}/script.md`),
    loadText(`episodes/${episodeId}/storyboard.md`),
    loadText(`episodes/${episodeId}/results.md`),
    loadText(`episodes/${episodeId}/panels/MANIFEST.md`),
    loadText(`docs/episodes/${episodeId}/index.html`)
  ]);

  const episodeExternalUrl = publishedViewerHtml ? episodeDocUrl(episodeId) : repoBlobUrl(`episodes/${episodeId}`);
  const episodeExternalLabel = publishedViewerHtml ? '공개 뷰어' : '에피소드 소스';

  const sourceDocs = [];
  if (script) sourceDocs.push({ label: 'script.json', path: `episodes/${episodeId}/script/script.json` });
  if (scriptMd) sourceDocs.push({ label: 'script.md', path: `episodes/${episodeId}/script.md` });
  if (storyboard) sourceDocs.push({ label: 'storyboard.json', path: `episodes/${episodeId}/storyboard/storyboard.json` });
  if (storyboardMd) sourceDocs.push({ label: 'storyboard.md', path: `episodes/${episodeId}/storyboard.md` });
  if (qa) sourceDocs.push({ label: 'qa.json', path: `episodes/${episodeId}/qa/qa.json` });
  if (resultsMd) sourceDocs.push({ label: 'results.md', path: `episodes/${episodeId}/results.md` });
  if (manifestMd) sourceDocs.push({ label: 'MANIFEST.md', path: `episodes/${episodeId}/panels/MANIFEST.md` });

  const sidebar = episodeIds.map(function (id) {
    const item = episodes[id];
    const cls = id === episodeId ? 'active' : '';
    return `<a href="#episode/${id}/overview" class="workspace-episode-link ${cls}">
      <div>${id}</div>
      <div class="meta">${escapeHtml(item.title || id)}</div>
    </a>`;
  }).join('');

  window.__CLE3_CONTEXT__ = {
    episodeId: episodeId,
    episode: episode,
    state: state,
    script: script,
    scriptMd: scriptMd,
    characters: characters,
    storyboard: storyboard,
    storyboardMd: storyboardMd,
    panels: panels,
    qa: qa,
    resultsMd: resultsMd,
    manifestMd: manifestMd,
    publishedViewerHtml: publishedViewerHtml
  };

  app.innerHTML = headerHtml() + navHtml() + patBanner() + sourceModeBanner() + `
    <div class="content">
      <div class="workspace-shell">
        <aside class="workspace-sidebar">
          <h3>Episode Workspace</h3>
          <div class="workspace-episode-list">${sidebar}</div>
          <div class="card compact">
            <p class="meta">기준 문서</p>
            ${sourceDocs.map(function (doc) {
              return `<p><a href="${repoBlobUrl(doc.path)}" target="_blank">${doc.label}</a></p>`;
            }).join('')}
          </div>
        </aside>
        <section class="workspace-main">
          <div class="card">
            <div class="workspace-header">
              <div>
                <h2>${episodeId}: ${escapeHtml(episode ? episode.title || episodeId : episodeId)}</h2>
                <p class="meta">상태: ${episode ? escapeHtml(workflowStatusText(episode.status || '-')) : '-'} / 현재 단계: ${episode ? detailPhaseLabel(episode.current_phase || '-') : '-'}</p>
              </div>
              <div class="action-row">
                <a class="btn-link" href="${episodeExternalUrl}" target="_blank">${episodeExternalLabel}</a>
                <a class="btn-link" href="#pipeline">파이프라인</a>
              </div>
            </div>
            <div class="tab-row">${tabNav}</div>
          </div>
          ${renderEpisodeTab(tab, window.__CLE3_CONTEXT__)}
        </section>
      </div>
    </div>`;
}

function renderEpisodeTab(tab, context) {
  if (tab === 'script') return renderScriptTab(context);
  if (tab === 'characters') return renderCharactersTab(context);
  if (tab === 'storyboard') return renderStoryboardTab(context);
  if (tab === 'panels') return renderPanelsTab(context);
  if (tab === 'qa') return renderQATab(context);
  return renderOverviewTab(context);
}

function renderOverviewTab(context) {
  const episode = context.episode || {};
  const script = context.script || {};
  const storyboard = context.storyboard || {};
  const qa = context.qa || {};
  const phases = episode.phases || {};
  const scriptTitle = script.title || extractMarkdownHeading(context.scriptMd || '');
  const pageCount = script.page_count || extractMarkdownTableValue(context.scriptMd || '', '페이지 수') || '-';
  const mainCharacters = script.main_characters || extractMarkdownTableValue(context.scriptMd || '', '주요 등장인물').split(',').map(function (item) {
    return item.trim();
  }).filter(Boolean);
  const overviewRef = script.source_reference || storyboard.source || extractMarkdownLineValue(context.resultsMd || '', 'source_panels') || '원본 참조 없음';
  const panelCount = context.panels && context.panels.panels ? context.panels.panels.length : (context.manifestMd ? extractMarkdownLineValue(context.manifestMd, '현재 상태') || '-' : '-');
  const sceneCount = (script.scenes || []).length || (extractMarkdownSection(context.scriptMd || '', 'ACT 구성') ? 3 : '-');
  const storyboardCount = (storyboard.pages || []).length || (extractMarkdownTableValue(context.storyboardMd || '', '총 페이지') || '-');
  const qaScore = qa.overall_score || extractMarkdownLineValue(context.resultsMd || '', 'status') || '-';
  const lintReport = buildConsistencyReport(context);
  const lintState = script.scenes || context.scriptMd ? lintReport.status : '입력 부족';
  const visionState = qa.overall_score ? (qa.overall_score >= 42 ? '통과' : '재검토') : (extractMarkdownLineValue(context.resultsMd || '', 'status') || 'pending');
  const review = loadQaReview(context.episodeId) || { status: 'pending', panels: {} };
  const panelList = (context.panels && context.panels.panels) || [];
  const panelReviewSummary = summarizePanelReviews(panelList, review.panels || {});
  const criterionSummary = summarizeCriterionCounts(panelList, review.panels || {});
  const qaSnapshot = buildVisionQaSnapshot(context, review, lintReport);

  return `
    <div class="workspace-grid">
      <div class="card">
        <h3>작업 요약</h3>
        <div class="stats-grid compact-grid">
          ${statCard(sceneCount, '장면')}
          ${statCard(storyboardCount || pageCount, '페이지')}
          ${statCard(panelCount, '패널')}
          ${statCard(qaScore, 'QA/결과')}
        </div>
      </div>
      <div class="card">
        <h3>Phase 상태</h3>
        <div class="phase-chip-list">
          ${PHASE_SEQUENCE.map(function (phase) {
            const phaseState = phases[phase[0]] ? phases[phase[0]].status : 'pending';
            return `<span class="phase-chip ${statusBadgeClass(phaseState)}">${phase[1]} · ${statusText(phaseState)}</span>`;
          }).join('')}
        </div>
      </div>
      <div class="card">
        <h3>원본 참조</h3>
        <p class="meta">${escapeHtml(overviewRef)}</p>
      </div>
      <div class="card">
        <h3>주요 캐릭터</h3>
        <p>${escapeHtml(mainCharacters.join(', ') || '-')}</p>
      </div>
      <div class="card">
        <h3>에피소드 메타</h3>
        <p>${escapeHtml(scriptTitle || context.episodeId)}</p>
        <p class="meta">페이지 수: ${escapeHtml(pageCount)}</p>
      </div>
      <div class="card">
        <h3>정합성 린트</h3>
        <p>${escapeHtml(lintState)}</p>
        <p class="meta">CLE2-10 범위: script / storyboard / panels / results 간 교차 점검</p>
        <p class="meta">error ${lintReport.counts.error} / warn ${lintReport.counts.warn} / info ${lintReport.counts.info}</p>
        ${lintReport.issues.length ? `<div class="lint-list">${lintReport.issues.slice(0, 3).map(function (issue) {
          return `<div class="output-desc">- [${issue.level}] ${escapeHtml(issue.message)}</div>`;
        }).join('')}</div>` : '<div class="output-desc">- 현재 규칙 기준으로 명시적 불일치가 없습니다.</div>'}
      </div>
      <div class="card">
        <h3>Vision QA</h3>
        <p>${escapeHtml(String(visionState))}</p>
        <p class="meta">CLE2-11 범위: 패널 시각 검수, 승인/반려, 결과 품질 게이트</p>
      </div>
      <div class="card">
        <h3>패널 QA 스냅샷</h3>
        <div class="stats-grid compact-grid">
          ${statCard(panelReviewSummary.approved, '승인')}
          ${statCard(panelReviewSummary.changes_requested, '수정 요청')}
          ${statCard(panelReviewSummary.hold, '보류')}
          ${statCard(panelReviewSummary.pending, '미검수')}
        </div>
        <p class="meta">criteria: pass ${criterionSummary.pass} / warn ${criterionSummary.warn} / fail ${criterionSummary.fail}</p>
      </div>
      <div class="card">
        <h3>출시 게이트</h3>
        <p>${escapeHtml(qaSnapshot.releaseGate === 'ready' ? '준비됨' : '차단됨')}</p>
        <p class="meta">lint error 0 + episode QA 승인 기준</p>
      </div>
    </div>`;
}

function renderScriptTab(context) {
  const script = context.script;
  if (!script && !context.scriptMd) {
    return '<div class="card"><p>script 데이터가 없습니다.</p></div>';
  }

  if (!script && context.scriptMd) {
    const pageCount = extractMarkdownTableValue(context.scriptMd, '페이지 수');
    const logline = extractMarkdownSection(context.scriptMd, '로그라인');
    const acts = markdownListItems(extractMarkdownSection(context.scriptMd, '페이지 설계 메모'));
    const checklist = markdownChecklistItems(extractMarkdownSection(context.scriptMd, '패널 작업 체크'));
    return `<div class="card">
      <h3>${escapeHtml(extractMarkdownHeading(context.scriptMd) || context.episodeId)}</h3>
      <p class="meta">페이지 ${escapeHtml(pageCount || '-')} / markdown source</p>
      ${logline ? `<div class="scene-card"><div class="output-title">로그라인</div><div class="output-desc">${escapeHtml(logline)}</div></div>` : ''}
      ${acts.length ? `<div class="scene-card"><div class="output-title">페이지 설계 메모</div>${acts.map(function (item) { return `<div class="output-desc">- ${escapeHtml(item)}</div>`; }).join('')}</div>` : ''}
      ${checklist.length ? `<div class="scene-card"><div class="output-title">패널 작업 체크</div>${checklist.map(function (item) { return `<div class="output-desc">- ${escapeHtml(item)}</div>`; }).join('')}</div>` : ''}
      <div class="scene-card">
        <div class="output-title">원본 markdown</div>
        ${renderMarkdownPreview(context.scriptMd)}
      </div>
    </div>`;
  }

  return `<div class="card">
    <h3>${escapeHtml(script.title || context.episodeId)}</h3>
    <p class="meta">페이지 ${escapeHtml(script.page_count || '-')} / 프롬프트 ${escapeHtml(script.prompt_version || '-')}</p>
    ${(script.scenes || []).map(function (scene) {
      return `<div class="scene-card">
        <div class="output-title">장면 ${scene.scene_number}: ${escapeHtml(scene.title || '')}</div>
        <div class="output-desc">${escapeHtml(scene.description || '')}</div>
        ${scene.narration ? `<div class="output-desc">내레이션: ${escapeHtml(scene.narration)}</div>` : ''}
        ${(scene.dialogue || []).map(function (line) {
          return `<div class="dialogue"><span class="char">${escapeHtml(line.character || '')}:</span> <span class="line">"${escapeHtml(line.line || '')}"</span></div>`;
        }).join('')}
      </div>`;
    }).join('')}
  </div>`;
}

function renderCharactersTab(context) {
  const characters = context.characters;
  if (!characters || !characters.characters) {
    const cast = extractMarkdownTableValue(context.scriptMd || '', '주요 등장인물');
    return `<div class="card">
      <h3>캐릭터</h3>
      <p>characters.json이 아직 없습니다.</p>
      <p class="meta">현재는 script.md 기준 주요 등장인물만 표시합니다.</p>
      <p>${escapeHtml(cast || '-')}</p>
    </div>`;
  }

  return `<div class="workspace-grid">
    ${characters.characters.map(function (character) {
      const hasAsset = !!character.image_path;
      return `<div class="card">
        <h3>${escapeHtml(character.name || '')}</h3>
        <p class="meta">${escapeHtml(character.role || '-')}</p>
        ${hasAsset ? `<img class="character-sheet-image" src="${assetUrl(character.image_path)}" alt="${escapeHtml(character.name || 'character')}" />` : `<div class="character-sheet-placeholder">
          <div class="output-title">생성 자산 대기</div>
          <div class="output-desc">CLE3 Phase 2 workflow로 새 character sheet를 생성해야 합니다.</div>
        </div>`}
        <p><strong>자산 상태</strong><br>${escapeHtml(character.generation_status || 'pending')}</p>
        <p><strong>자산 슬롯</strong><br><span class="meta">${escapeHtml(character.asset_slot || '-')}</span></p>
        ${character.source_prompt ? `<div class="output-section"><h4>생성 프롬프트</h4><div class="output-prompt">${escapeHtml(character.source_prompt)}</div></div>` : ''}
        <p><strong>외모</strong><br>${escapeHtml(character.appearance || '-')}</p>
        <p><strong>성격</strong><br>${escapeHtml(character.personality || '-')}</p>
        <p><strong>스타일</strong><br>${escapeHtml(character.style_notes || '-')}</p>
        <p><strong>컬러 톤</strong><br>${escapeHtml(character.color_tone || '-')}</p>
      </div>`;
    }).join('')}
  </div>`;
}

function renderStoryboardTab(context) {
  const storyboard = context.storyboard;
  if ((!storyboard || !storyboard.pages) && !context.storyboardMd) {
    return '<div class="card"><p>storyboard 데이터가 아직 없습니다.</p></div>';
  }

  if ((!storyboard || !storyboard.pages) && context.storyboardMd) {
    const totalPages = extractMarkdownTableValue(context.storyboardMd, '총 페이지');
    const cutStyle = extractMarkdownTableValue(context.storyboardMd, '컷 스타일');
    const keyCuts = extractMarkdownTableValue(context.storyboardMd, '키 컷');
    const sequenceSection = extractMarkdownSection(context.storyboardMd, '시퀀스별 콘티 가이드');
    const checklist = markdownChecklistItems(extractMarkdownSection(context.storyboardMd, '컷 설계 체크리스트'));
    return `<div class="card">
      <h3>스토리보드</h3>
      <p class="meta">총 페이지 ${escapeHtml(totalPages || '-')} / ${escapeHtml(cutStyle || '-')}</p>
      ${keyCuts ? `<div class="scene-card"><div class="output-title">키 컷</div><div class="output-desc">${escapeHtml(keyCuts)}</div></div>` : ''}
      ${sequenceSection ? `<div class="scene-card"><div class="output-title">시퀀스 가이드</div>${renderMarkdownPreview(sequenceSection)}</div>` : ''}
      ${checklist.length ? `<div class="scene-card"><div class="output-title">체크리스트</div>${checklist.map(function (item) { return `<div class="output-desc">- ${escapeHtml(item)}</div>`; }).join('')}</div>` : ''}
      <div class="scene-card">
        <div class="output-title">원본 markdown</div>
        ${renderMarkdownPreview(context.storyboardMd)}
      </div>
    </div>`;
  }

  return `<div class="card">
    <h3>스토리보드</h3>
    ${storyboard.pages.map(function (page) {
      return `<div class="scene-card">
        <div class="output-title">페이지 ${page.page_number}</div>
        <div class="output-desc">레이아웃: ${escapeHtml(page.layout || '-')}</div>
        ${(page.panels || []).map(function (panel) {
          const cast = panel.characters_in_frame && panel.characters_in_frame.length ? panel.characters_in_frame.join(', ') : '-';
          return `<div class="panel-summary">
            <div><span class="panel-id">${escapeHtml(panel.panel_id || '')}</span> <span class="meta">${escapeHtml(panel.camera_angle || '')}</span></div>
            <div class="output-desc">${escapeHtml(panel.description || '')}</div>
            <div class="meta">등장: ${escapeHtml(cast)}</div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}
  </div>`;
}

function renderPanelsTab(context) {
  const panels = context.panels;
  if ((!panels || !panels.panels) && !context.manifestMd) {
    return '<div class="card"><p>패널 데이터가 아직 없습니다.</p></div>';
  }

  if ((!panels || !panels.panels) && context.manifestMd) {
    const status = extractMarkdownSection(context.manifestMd, '현재 상태') || extractMarkdownLineValue(context.manifestMd, '현재 상태');
    const rules = extractMarkdownSection(context.manifestMd, '작업 규칙');
    return `<div class="card">
      <h3>패널 산출물</h3>
      ${status ? `<div class="scene-card"><div class="output-title">현재 상태</div><div class="output-desc">${escapeHtml(status)}</div></div>` : ''}
      ${rules ? `<div class="scene-card"><div class="output-title">작업 규칙</div>${renderMarkdownPreview(rules)}</div>` : ''}
      <div class="scene-card">
        <div class="output-title">MANIFEST</div>
        ${renderMarkdownPreview(context.manifestMd)}
      </div>
    </div>`;
  }

  const qaReview = loadQaReview(context.episodeId) || { panels: {} };
  const actionItems = summarizePanelActionItems(panels.panels, qaReview.panels || {});
  return `<div class="card">
    <h3>패널 산출물</h3>
    ${actionItems.length ? `<div class="scene-card"><div class="output-title">즉시 조치 필요</div>${actionItems.map(function (item) { return `<div class="output-desc">- ${escapeHtml(item)}</div>`; }).join('')}</div>` : ''}
    ${panels.panels.map(function (panel) {
      const panelReview = normalizePanelReview((qaReview.panels && qaReview.panels[panel.panel_id]) || {});
      return `<div class="scene-card">
        <div class="output-title">${escapeHtml(panel.panel_id || '')} <span class="meta">AI ${escapeHtml(panel.ai_score || '-')} / 50</span></div>
        <div class="output-desc">${escapeHtml(panel.description || '-')}</div>
        ${panel.image_path ? `<div class="placeholder-small">${escapeHtml(panel.image_path)}</div>` : ''}
        ${panel.generation_prompt ? `<div class="output-prompt">${escapeHtml(panel.generation_prompt)}</div>` : ''}
        <div class="panel-qa-inline">
          <span class="panel-qa-badge ${panelReview.status || 'pending'}">${escapeHtml(renderQaStatusLabel(panelReview.status || 'pending'))}</span>
          <span class="meta">${escapeHtml(panelCriteriaSummary(panelReview))}</span>
          <span class="meta">${panelReview.action_required ? '조치: ' + escapeHtml(panelReview.action_required) : '즉시 조치 항목 없음'}</span>
          <span class="meta">${panelReview.note ? escapeHtml(panelReview.note) : '패널 리뷰 메모 없음'}</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderQATab(context) {
  const qa = context.qa;
  const lintReport = buildConsistencyReport(context);
  const review = loadQaReview(context.episodeId) || {
    status: 'pending',
    verdict: '',
    note: '',
    updatedAt: '',
    panels: {}
  };
  const panelList = (context.panels && context.panels.panels) || [];
  const panelReviewSummary = summarizePanelReviews(panelList, review.panels || {});
  const criterionSummary = summarizeCriterionCounts(panelList, review.panels || {});
  if (!qa && !context.resultsMd) {
    return '<div class="card"><p>QA/결과 데이터가 아직 없습니다.</p></div>';
  }

  if (!qa && context.resultsMd) {
    const status = extractMarkdownLineValue(context.resultsMd, 'status');
    const owner = extractMarkdownLineValue(context.resultsMd, 'owner');
    const primary = extractMarkdownLineValue(context.resultsMd, 'primary_hypothesis');
    const nextActions = markdownChecklistItems(extractMarkdownSection(context.resultsMd, '다음 액션'));
    return `<div class="workspace-grid">
      <div class="card">
        <h3>결과 상태</h3>
        <div class="stat-value small">${escapeHtml(status || '-')}</div>
        <p class="meta">owner: ${escapeHtml(owner || '-')}</p>
        <p class="meta">primary hypothesis: ${escapeHtml(primary || '-')}</p>
      </div>
      ${renderQaReviewCard(context.episodeId, review)}
      ${renderPanelQaCard(context.episodeId, context.panels, review)}
      <div class="card">
        <h3>다음 액션</h3>
        ${nextActions.length ? nextActions.map(function (item) {
          return `<div class="output-desc">- ${escapeHtml(item)}</div>`;
        }).join('') : '<p class="meta">기록 없음</p>'}
      </div>
      <div class="card">
        <h3>정합성 게이트</h3>
        <p>${escapeHtml(lintReport.status)}</p>
        ${lintReport.issues.length ? lintReport.issues.map(function (issue) {
          return `<div class="output-item"><div class="output-title">${escapeHtml(issue.label)} · ${escapeHtml(issue.level)}</div><div class="output-desc">${escapeHtml(issue.message)}</div></div>`;
        }).join('') : '<p class="meta">현재 규칙 기준으로 린트 이슈 없음</p>'}
      </div>
      <div class="card">
        <h3>원본 results.md</h3>
        ${renderMarkdownPreview(context.resultsMd)}
      </div>
    </div>`;
  }

  return `<div class="workspace-grid">
    <div class="card">
      <h3>총평</h3>
      <div class="stat-value small">${escapeHtml(qa.overall_score || '-')} / 50</div>
      <p class="meta">${qa.overall_score >= 42 ? '배포 가능 범위' : '재작업 필요'}</p>
    </div>
    ${renderQaReviewCard(context.episodeId, review)}
    <div class="card">
      <h3>패널 검수 요약</h3>
      <div class="stats-grid compact-grid">
        ${statCard(panelReviewSummary.approved, '승인')}
        ${statCard(panelReviewSummary.changes_requested, '수정 요청')}
        ${statCard(panelReviewSummary.hold, '보류')}
        ${statCard(panelReviewSummary.pending, '미검수')}
      </div>
      <div class="stats-grid compact-grid panel-criterion-summary">
        ${statCard(criterionSummary.pass, '양호')}
        ${statCard(criterionSummary.warn, '보완')}
        ${statCard(criterionSummary.fail, '문제')}
        ${statCard(criterionSummary.unchecked, '미확인')}
      </div>
    </div>
    ${renderPanelQaCard(context.episodeId, context.panels, review)}
    <div class="card">
      <h3>세부 항목</h3>
      ${(qa.items || []).map(function (item) {
        return `<div class="output-item">
          <div class="output-title">${escapeHtml(item.category || '')}: ${escapeHtml(item.score || '-')} / 10</div>
          <div class="output-desc">${escapeHtml(item.notes || '-')}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="card">
      <h3>정합성 게이트</h3>
      <p>${escapeHtml(lintReport.status)}</p>
      ${lintReport.issues.length ? lintReport.issues.map(function (issue) {
        return `<div class="output-item"><div class="output-title">${escapeHtml(issue.label)} · ${escapeHtml(issue.level)}</div><div class="output-desc">${escapeHtml(issue.message)}</div></div>`;
      }).join('') : '<p class="meta">현재 규칙 기준으로 린트 이슈 없음</p>'}
    </div>
  </div>`;
}

function renderPanelQaCard(episodeId, panelsData, review) {
  const panels = panelsData && panelsData.panels ? panelsData.panels : [];
  if (!panels.length) {
    return '<div class="card"><h3>패널 단위 Vision QA</h3><p class="meta">패널 메타가 아직 없어 에피소드 단위 QA만 가능합니다.</p></div>';
  }

  return `<div class="card">
    <h3>패널 단위 Vision QA</h3>
    ${panels.map(function (panel) {
      const panelReview = normalizePanelReview((review.panels && review.panels[panel.panel_id]) || null);
      return `<div class="panel-review-card">
        <div class="panel-review-head">
          <div>
            <div class="output-title">${escapeHtml(panel.panel_id)}</div>
            <div class="meta">AI score ${escapeHtml(panel.ai_score || '-')} / 50</div>
          </div>
          <span class="panel-qa-badge ${panelReview.status || 'pending'}">${escapeHtml(renderQaStatusLabel(panelReview.status || 'pending'))}</span>
        </div>
        <div class="output-desc">${escapeHtml(panel.generation_prompt || panel.description || '-')}</div>
        <div class="segmented-row panel-segmented">
          <button class="segmented-btn ${panelReview.status === 'approved' ? 'active approved' : ''}" onclick="setPanelQaStatus('${episodeId}','${panel.panel_id}','approved')">승인</button>
          <button class="segmented-btn ${panelReview.status === 'changes_requested' ? 'active changes' : ''}" onclick="setPanelQaStatus('${episodeId}','${panel.panel_id}','changes_requested')">수정 요청</button>
          <button class="segmented-btn ${panelReview.status === 'hold' ? 'active hold' : ''}" onclick="setPanelQaStatus('${episodeId}','${panel.panel_id}','hold')">보류</button>
          <button class="segmented-btn ${panelReview.status === 'pending' ? 'active pending' : ''}" onclick="setPanelQaStatus('${episodeId}','${panel.panel_id}','pending')">미검수</button>
        </div>
        <div class="panel-criteria-grid">
          <label class="panel-criteria-field">구도
            <select id="panel-composition-${episodeId}-${panel.panel_id}" class="panel-select">
              <option value="unchecked" ${panelReview.composition === 'unchecked' ? 'selected' : ''}>미확인</option>
              <option value="pass" ${panelReview.composition === 'pass' ? 'selected' : ''}>양호</option>
              <option value="warn" ${panelReview.composition === 'warn' ? 'selected' : ''}>보완</option>
              <option value="fail" ${panelReview.composition === 'fail' ? 'selected' : ''}>문제</option>
            </select>
          </label>
          <label class="panel-criteria-field">가독성
            <select id="panel-clarity-${episodeId}-${panel.panel_id}" class="panel-select">
              <option value="unchecked" ${panelReview.clarity === 'unchecked' ? 'selected' : ''}>미확인</option>
              <option value="pass" ${panelReview.clarity === 'pass' ? 'selected' : ''}>양호</option>
              <option value="warn" ${panelReview.clarity === 'warn' ? 'selected' : ''}>보완</option>
              <option value="fail" ${panelReview.clarity === 'fail' ? 'selected' : ''}>문제</option>
            </select>
          </label>
          <label class="panel-criteria-field">감정
            <select id="panel-emotion-${episodeId}-${panel.panel_id}" class="panel-select">
              <option value="unchecked" ${panelReview.emotion === 'unchecked' ? 'selected' : ''}>미확인</option>
              <option value="pass" ${panelReview.emotion === 'pass' ? 'selected' : ''}>양호</option>
              <option value="warn" ${panelReview.emotion === 'warn' ? 'selected' : ''}>보완</option>
              <option value="fail" ${panelReview.emotion === 'fail' ? 'selected' : ''}>문제</option>
            </select>
          </label>
          <label class="panel-criteria-field">일관성
            <select id="panel-consistency-${episodeId}-${panel.panel_id}" class="panel-select">
              <option value="unchecked" ${panelReview.consistency === 'unchecked' ? 'selected' : ''}>미확인</option>
              <option value="pass" ${panelReview.consistency === 'pass' ? 'selected' : ''}>양호</option>
              <option value="warn" ${panelReview.consistency === 'warn' ? 'selected' : ''}>보완</option>
              <option value="fail" ${panelReview.consistency === 'fail' ? 'selected' : ''}>문제</option>
            </select>
          </label>
        </div>
        <input id="panel-action-${episodeId}-${panel.panel_id}" class="pat-input qa-input" type="text" value="${escapeHtml(panelReview.action_required || '')}" placeholder="즉시 조치 항목 예: 표정 재생성, 말풍선 배치 수정" />
        <textarea id="panel-note-${episodeId}-${panel.panel_id}" class="qa-textarea panel-note" placeholder="패널별 검수 메모">${escapeHtml(panelReview.note || '')}</textarea>
        <div class="action-row">
          <button class="btn btn-secondary" onclick="savePanelQaNote('${episodeId}','${panel.panel_id}')">패널 리뷰 저장</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderQaReviewCard(episodeId, review) {
  const exportMarkdown = buildQaReviewMarkdown(episodeId, review);
  const lintReport = buildConsistencyReport(window.__CLE3_CONTEXT__ || {});
  const resultsSummaryMarkdown = buildVisionQaResultsSection(window.__CLE3_CONTEXT__ || {}, review, lintReport);
  return `<div class="card">
    <h3>Vision QA 리뷰</h3>
    <div class="segmented-row">
      <button class="segmented-btn ${review.status === 'approved' ? 'active approved' : ''}" onclick="setQaStatus('${episodeId}','approved')">승인</button>
      <button class="segmented-btn ${review.status === 'changes_requested' ? 'active changes' : ''}" onclick="setQaStatus('${episodeId}','changes_requested')">수정 요청</button>
      <button class="segmented-btn ${review.status === 'hold' ? 'active hold' : ''}" onclick="setQaStatus('${episodeId}','hold')">보류</button>
      <button class="segmented-btn ${review.status === 'pending' ? 'active pending' : ''}" onclick="setQaStatus('${episodeId}','pending')">미검수</button>
    </div>
    <div class="output-item">
      <div class="output-title">현재 판정</div>
      <div class="output-desc">${escapeHtml(renderQaStatusLabel(review.status))}</div>
      <div class="meta">${review.updatedAt ? '업데이트: ' + escapeHtml(review.updatedAt) : '아직 저장된 리뷰가 없습니다.'}</div>
    </div>
    <div class="output-item">
      <div class="output-title">최종 판정 메모</div>
      <input id="qa-verdict-${episodeId}" class="pat-input qa-input" type="text" value="${escapeHtml(review.verdict || '')}" placeholder="예: EP002는 콘티 유지, 패널 생성 전 시각 효과 규칙 보강 필요" />
    </div>
    <div class="output-item">
      <div class="output-title">리뷰 노트</div>
      <textarea id="qa-note-${episodeId}" class="qa-textarea" placeholder="패널, 연출, 품질, 후킹에 대한 검수 메모">${escapeHtml(review.note || '')}</textarea>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" onclick="saveQaReview('${episodeId}')">리뷰 저장</button>
      <button class="btn btn-secondary" onclick="copyQaReviewMarkdown('${episodeId}')">Markdown 복사</button>
      <button class="btn btn-secondary" onclick="downloadQaReviewMarkdown('${episodeId}')">Markdown 다운로드</button>
      <button class="btn btn-secondary" onclick="copyQaResultsSummary('${episodeId}')">Results 요약 복사</button>
      <button class="btn btn-secondary" onclick="downloadQaResultsSummary('${episodeId}')">Results 요약 다운로드</button>
      <button class="btn btn-secondary" onclick="clearQaReview('${episodeId}')">리뷰 초기화</button>
    </div>
    <div class="output-item">
      <div class="output-title">Export Preview</div>
      <pre class="output-md qa-export-preview">${escapeHtml(exportMarkdown)}</pre>
    </div>
    <div class="output-item">
      <div class="output-title">results.md 반영용 Vision QA Summary</div>
      <pre class="output-md qa-results-preview">${escapeHtml(resultsSummaryMarkdown)}</pre>
    </div>
  </div>`;
}

function renderQaStatusLabel(status) {
  if (status === 'approved') return '승인';
  if (status === 'changes_requested') return '수정 요청';
  if (status === 'hold') return '보류';
  return '미검수';
}

function summarizePanelReviews(panelList, panels) {
  const summary = { approved: 0, changes_requested: 0, hold: 0, pending: 0 };
  (panelList || []).forEach(function (panel) {
    const panelId = typeof panel === 'string' ? panel : panel.panel_id;
    const status = (panels && panels[panelId] && panels[panelId].status) || 'pending';
    if (summary[status] == null) summary[status] = 0;
    summary[status] += 1;
  });
  return summary;
}

function setQaStatus(episodeId, status) {
  const review = loadQaReview(episodeId) || { panels: {} };
  review.status = status;
  review.verdict = (document.getElementById('qa-verdict-' + episodeId) || {}).value || review.verdict || '';
  review.note = (document.getElementById('qa-note-' + episodeId) || {}).value || review.note || '';
  review.updatedAt = new Date().toLocaleString('ko-KR');
  saveQaReviewRecord(episodeId, review);
  showToast('QA 상태 저장', 'success');
  render();
}

function saveQaReview(episodeId) {
  const verdictEl = document.getElementById('qa-verdict-' + episodeId);
  const noteEl = document.getElementById('qa-note-' + episodeId);
  const current = loadQaReview(episodeId) || { status: 'pending', panels: {} };
  current.verdict = verdictEl ? verdictEl.value.trim() : '';
  current.note = noteEl ? noteEl.value.trim() : '';
  current.updatedAt = new Date().toLocaleString('ko-KR');
  saveQaReviewRecord(episodeId, current);
  showToast('QA 리뷰 저장 완료', 'success');
  render();
}

function setPanelQaStatus(episodeId, panelId, status) {
  const review = loadQaReview(episodeId) || { status: 'pending', verdict: '', note: '', updatedAt: '', panels: {} };
  review.panels = review.panels || {};
  review.panels[panelId] = loadPanelReviewFromForm(episodeId, panelId, review.panels[panelId]);
  review.panels[panelId].status = status;
  review.updatedAt = new Date().toLocaleString('ko-KR');
  saveQaReviewRecord(episodeId, review);
  showToast('패널 QA 상태 저장', 'success');
  render();
}

function savePanelQaNote(episodeId, panelId) {
  const review = loadQaReview(episodeId) || { status: 'pending', verdict: '', note: '', updatedAt: '', panels: {} };
  review.panels = review.panels || {};
  review.panels[panelId] = loadPanelReviewFromForm(episodeId, panelId, review.panels[panelId]);
  review.updatedAt = new Date().toLocaleString('ko-KR');
  saveQaReviewRecord(episodeId, review);
  showToast('패널 QA 리뷰 저장', 'success');
  render();
}

function clearQaReview(episodeId) {
  const all = loadQaReviews();
  delete all[episodeId];
  localStorage.setItem(QA_REVIEW_STORAGE_KEY, JSON.stringify(all));
  showToast('QA 리뷰 초기화', 'success');
  render();
}

function buildQaReviewMarkdown(episodeId, review) {
  const panelLines = Object.keys((review && review.panels) || {}).sort().map(function (panelId) {
    const panelReview = normalizePanelReview(review.panels[panelId] || {});
    return [
      `- ${panelId}`,
      `  - status: ${renderQaStatusLabel(panelReview.status || 'pending')}`,
      `  - checks: ${panelCriteriaSummary(panelReview)}`,
      `  - action_required: ${panelReview.action_required || '-'}`,
      `  - note: ${panelReview.note || '메모 없음'}`
    ].join('\n');
  });
  const status = renderQaStatusLabel((review && review.status) || 'pending');
  const verdict = (review && review.verdict ? review.verdict : '미작성').trim();
  const note = (review && review.note ? review.note : '미작성').trim();
  const updatedAt = review && review.updatedAt ? review.updatedAt : '-';
  return [
    `## Vision QA Review - ${episodeId}`,
    '',
    `- status: ${status}`,
    `- updated_at: ${updatedAt}`,
    '',
    '### verdict',
    verdict,
    '',
    '### notes',
    note,
    '',
    '### panel_reviews',
    panelLines.length ? panelLines.join('\n') : '- 없음'
  ].join('\n');
}

function buildQaResultsSummaryMarkdown(episodeId) {
  const context = window.__CLE3_CONTEXT__ || {};
  const review = loadQaReview(episodeId) || { status: 'pending', verdict: '', note: '', updatedAt: '', panels: {} };
  const lintReport = buildConsistencyReport(context);
  return buildVisionQaResultsSection(context, review, lintReport);
}

async function copyQaReviewMarkdown(episodeId) {
  const review = loadQaReview(episodeId) || { status: 'pending', verdict: '', note: '', updatedAt: '' };
  const markdown = buildQaReviewMarkdown(episodeId, review);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(markdown);
      showToast('QA markdown 복사 완료', 'success');
      return;
    }
  } catch (error) {
  }
  showToast('클립보드 복사 실패', 'error');
}

function downloadQaReviewMarkdown(episodeId) {
  const review = loadQaReview(episodeId) || { status: 'pending', verdict: '', note: '', updatedAt: '' };
  const markdown = buildQaReviewMarkdown(episodeId, review);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${episodeId.toLowerCase()}-vision-qa-review.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast('QA markdown 다운로드 시작', 'success');
}

async function copyQaResultsSummary(episodeId) {
  const markdown = buildQaResultsSummaryMarkdown(episodeId);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(markdown);
      showToast('results 요약 복사 완료', 'success');
      return;
    }
  } catch (error) {
  }
  showToast('클립보드 복사 실패', 'error');
}

function downloadQaResultsSummary(episodeId) {
  const markdown = buildQaResultsSummaryMarkdown(episodeId);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${episodeId.toLowerCase()}-vision-qa-summary.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast('results 요약 다운로드 시작', 'success');
}

async function renderPrompts() {
  setLoading();
  const state = await loadState();
  const budget = state && state.improvement_budget ? state.improvement_budget : {};
  const rollbacks = state && state.rollback_history ? state.rollback_history : [];

  app.innerHTML = headerHtml() + navHtml() + patBanner() + sourceModeBanner() + `
    <div class="content">
      <h2>프롬프트</h2>
      <div class="card">
        <h3>개선 예산</h3>
        <div class="budget-bar"><div class="budget-fill" style="width:${((budget.used || 0) / (budget.total || 15)) * 100}%"></div></div>
        <p>사용: ${budget.used || 0} / ${budget.total || 15}회</p>
        <p class="meta">Phase당 최대 ${budget.per_phase_limit || 5}회, 롤오버 ${budget.rollover ? '허용' : '미허용'}</p>
      </div>
      <div class="card">
        <h3>프롬프트 디렉토리</h3>
        <ul class="prompt-list">
          <li><a href="${repoBlobUrl('prompts/story/v2.md')}" target="_blank">story/v2.md</a></li>
          <li><a href="${repoBlobUrl('prompts/character/v2.md')}" target="_blank">character/v2.md</a></li>
          <li><a href="${repoBlobUrl('prompts/storyboard/v2.md')}" target="_blank">storyboard/v2.md</a></li>
          <li><a href="${repoBlobUrl('prompts/image/v2.md')}" target="_blank">image/v2.md</a></li>
          <li><a href="${repoBlobUrl('prompts/qa/v2.md')}" target="_blank">qa/v2.md</a></li>
        </ul>
      </div>
      <div class="card">
        <h3>롤백 이력</h3>
        ${rollbacks.length ? rollbacks.map(function (item) {
          return `<div class="output-item">
            <div class="output-title">${escapeHtml(item.episode || '-')} / ${escapeHtml(item.phase || '-')}</div>
            <div class="output-desc">${escapeHtml(item.reason || '-')}</div>
            <div class="meta">${escapeHtml(item.date || '-')} / 이전 점수 ${escapeHtml(item.previous_score || '-')}</div>
          </div>`;
        }).join('') : '<p class="meta">기록 없음</p>'}
      </div>
    </div>`;
}

function renderSettings() {
  app.innerHTML = headerHtml() + navHtml() + `
    <div class="content">
      <h2>설정</h2>
      <div class="card">
        <h3>GitHub PAT</h3>
        <p>PAT는 브라우저의 localStorage에만 저장됩니다. GitHub Pages에서도 서버 없이 그대로 동작합니다.</p>
        <p class="warn">공용 브라우저에서는 사용 후 삭제하세요.</p>
        <div class="input-group">
          <input type="password" id="pat-input" placeholder="${PAT ? '저장된 PAT가 있습니다. 새 값 입력 시 교체됩니다.' : 'github_pat_...'}" class="pat-input" />
        </div>
        <div class="action-row">
          <button onclick="savePAT()" class="btn btn-primary">저장</button>
          <button onclick="testPAT()" class="btn btn-secondary">저장 테스트</button>
          ${PAT ? '<button onclick="clearPAT()" class="btn btn-danger">삭제</button>' : ''}
        </div>
        <p id="pat-status" class="meta">${PAT ? '저장된 PAT가 있습니다.' : '저장된 PAT가 없습니다.'}</p>
      </div>
      <div class="card">
        <h3>연동</h3>
        <p>리포: <a href="https://github.com/${GH_ORG}/${GH_REPO}" target="_blank">${GH_ORG}/${GH_REPO}</a></p>
        <p>CLE2 기준 이슈: <a href="https://github.com/${GH_ORG}/creative-loop-engineering2/issues/24" target="_blank">#24</a></p>
        <p>Actions: <a href="https://github.com/${GH_ORG}/${GH_REPO}/actions" target="_blank">실행 이력</a></p>
      </div>
    </div>`;
}

function updatePatStatus(message, type) {
  const status = document.getElementById('pat-status');
  if (!status) return;
  status.textContent = message;
  status.className = type === 'error' ? 'warn' : 'meta';
}

function savePAT() {
  const input = document.getElementById('pat-input');
  if (!input) return;
  const value = input.value.trim();
  if (!value) {
    showToast('PAT를 입력하세요', 'error');
    updatePatStatus('PAT를 입력해야 저장됩니다.', 'error');
    return;
  }
  PAT = value;
  localStorage.setItem(PAT_STORAGE_KEY, value);
  input.value = '';
  updatePatStatus('PAT가 localStorage에 저장되었습니다.', 'success');
  showToast('PAT 저장 완료', 'success');
}

async function testPAT() {
  if (!PAT) {
    showToast('먼저 PAT를 저장하세요', 'error');
    updatePatStatus('저장된 PAT가 없어 테스트할 수 없습니다.', 'error');
    return;
  }
  updatePatStatus('GitHub 연결을 확인하는 중...', 'success');
  const repo = await ghFetch(GH_API);
  if (!repo || !repo.full_name) {
    showToast('PAT 테스트 실패', 'error');
    updatePatStatus('GitHub API 연결 실패. 토큰 권한이나 값이 맞는지 확인하세요.', 'error');
    return;
  }
  showToast('PAT 테스트 성공', 'success');
  updatePatStatus(`연결 성공: ${repo.full_name}`, 'success');
}

function clearPAT() {
  PAT = '';
  localStorage.removeItem(PAT_STORAGE_KEY);
  showToast('PAT 삭제 완료', 'success');
  renderSettings();
}

function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'info');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function () {
    toast.remove();
  }, 3000);
}

route();
