#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function exists(rootDir, relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function parseArgs(argv) {
  const args = { episodes: [], force: false };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--episode') args.episodes.push(argv[++index]);
    else if (argv[index] === '--force') args.force = true;
    else if (argv[index] === '--help') args.help = true;
  }
  return args;
}

function referencesForEpisode(rootDir, episodeId) {
  const candidates = [
    ['story', `episodes/${episodeId}/script/script.md`, '장면 의도와 패널 대사의 기준'],
    ['character', `episodes/${episodeId}/characters/characters.json`, '캐릭터 외형과 참조 자산의 기준'],
    ['storyboard', `episodes/${episodeId}/storyboard/storyboard.json`, '페이지와 패널 구도의 기준'],
    ['policy', 'config/panel-generation-policy.json', '동시성, 재시도, QA와 에스컬레이션 기준']
  ];
  return candidates.filter((item) => exists(rootDir, item[1])).map((item) => ({
    type: item[0],
    path: item[1],
    purpose: item[2]
  }));
}

function completedPhaseCount(episode) {
  return Object.values(episode.phases || {}).filter((phase) => phase.status === 'completed').length;
}

function gateStatus(episode, phaseId) {
  const phase = (episode.phases || {})[phaseId] || {};
  return phase.status === 'completed' ? 'provisional' : 'pending';
}

function phaseStarted(episode, phaseId) {
  const status = ((episode.phases || {})[phaseId] || {}).status;
  return status === 'active' || status === 'in_progress' || status === 'completed';
}

function buildDiscovery(rootDir, episodeId, episode) {
  const knownUnknown = [
    {
      id: 'KU-001',
      summary: '명시적인 사람 승인 기록이 없는 완료 Phase는 공식 승인 여부를 확인해야 한다.',
      status: 'open',
      blocking: false,
      next_action: '완료 Phase를 provisional gate로 표시하고 다음 기준선 변경 전에 운영자가 확인'
    }
  ];
  const phaseNotes = Object.values(episode.phases || {}).map((phase) => phase.note || '').join(' ');
  if (/구조 차이|rebaseline/i.test(phaseNotes)) {
    knownUnknown.push({
      id: 'KU-002',
      summary: 'script와 storyboard/panels 사이의 구조 차이를 rebaseline해야 한다.',
      status: 'open',
      blocking: false,
      next_action: '다음 대량 생성 전에 페이지와 패널 기준선을 확정'
    });
  }

  return {
    $schema: '../../../schemas/discovery.schema.json',
    episode_id: episodeId,
    objective: `CLE3 내부 산출물만 사용해 ${episodeId} ${episode.title || ''}의 현재 Phase를 진행하고 판단과 불확실성을 검토 가능하게 관리한다.`.trim(),
    value_hypothesis: {
      user_value: '사람은 스토리와 시각 방향을 결정하고 AI는 조사, 생성, 검사와 재시도를 이어간다.',
      baseline_target: `현재 ${episode.current_phase || 'phase'}의 필수 산출물과 QA 기록을 CLE3 내부에 완성한다.`,
      challenge_target: '정상 작업 자동화와 예외 에스컬레이션으로 품질, 속도, 비용을 함께 개선한다.'
    },
    tools: [
      { name: 'CLE3 repository files', purpose: '에피소드 산출물과 상태의 원본 관리', status: 'available', fallback: null },
      { name: 'Codex tools', purpose: '코드, 문서, 이미지 생성과 검증', status: 'available', fallback: '실패 작업을 보류하거나 에스컬레이션' },
      { name: 'GitHub and GitHub Pages', purpose: '변경 검토와 Episode Workspace 조회', status: 'available', fallback: '로컬 검증 후 PR로 동기화' }
    ],
    references: referencesForEpisode(rootDir, episodeId),
    unknowns: {
      known_known: [
        { id: 'KK-001', summary: `${episodeId}의 현재 단계는 ${episode.current_phase || '미정'}이다.`, status: 'confirmed', blocking: false, next_action: null },
        { id: 'KK-002', summary: `${completedPhaseCount(episode)}개 Phase가 완료 상태로 기록되어 있다.`, status: 'confirmed', blocking: false, next_action: null }
      ],
      known_unknown: knownUnknown,
      unknown_known: [
        { id: 'UK-001', summary: '운영자가 이 에피소드에서 가장 우선하는 품질 기준을 다음 사람 리뷰에서 확인해야 한다.', status: 'open', blocking: false, next_action: '다음 승인 또는 QA에 우선순위 기록' }
      ],
      unknown_unknown_candidates: [
        { id: 'UU-001', summary: '다음 Phase에서 현재 입력의 암묵적 가정이 시각 또는 구조 드리프트로 나타날 수 있다.', status: 'assumed', blocking: false, next_action: 'Phase 전환 전 인접 산출물 정합성 검사' }
      ]
    },
    assumptions: [
      '현재 state.json과 존재하는 에피소드 파일을 작업 기준선으로 사용한다.',
      '명시적 승인 기록이 없는 완료 Phase는 provisional이며 승인으로 추정하지 않는다.',
      '정상 작업은 계속하고 가치 판단, 정책 예외와 최종 배포만 사람에게 요청한다.'
    ],
    human_decisions: [
      { id: 'HD-001', question: '현재 완료 Phase를 다음 작업의 공식 기준선으로 승인할 것인가?', status: 'pending', blocking: false },
      { id: 'HD-002', question: `${episodeId}의 Phase 5 통과 후 공개 배포를 승인할 것인가?`, status: 'pending', blocking: true }
    ],
    preflight: {
      status: 'ready_with_assumptions',
      checked_at: '2026-07-14T00:00:00+09:00',
      notes: '사용 가능한 도구와 현재 파일을 확인했다. 과거 사람 승인 기록은 provisional로 관리한다.'
    }
  };
}

function buildDecisions(episodeId) {
  return {
    $schema: '../../../schemas/decision-log.schema.json',
    episode_id: episodeId,
    decisions: [
      {
        id: 'DEC-20260714-001',
        made_at: '2026-07-14T00:00:00+09:00',
        phase: 'phase0.5',
        decision: 'CLE3 내부 산출물과 현재 state.json을 작업 기준선으로 사용한다.',
        rationale: '에피소드별 생성 이력과 품질 책임 경계를 CLE3 안에서 유지해야 한다.',
        evidence: [`episodes/${episodeId}/`, 'state.json'],
        confidence: 'high',
        uncertainties: ['명시적 과거 사람 승인 기록의 부재'],
        alternatives_considered: ['외부 저장소 생성 결과 재사용'],
        human_approval: 'provisional',
        impact: '다음 Phase 산출물, 판단과 QA 기록을 해당 에피소드 폴더에 저장한다.'
      },
      {
        id: 'DEC-20260714-002',
        made_at: '2026-07-14T00:00:00+09:00',
        phase: 'phase0.5',
        decision: '판단 기록에는 결정 근거, 가정, 불확실성, 대안과 승인 상태만 저장한다.',
        rationale: '검토 가능성과 재현성에 필요한 운영 정보만 구조화한다.',
        evidence: ['schemas/decision-log.schema.json'],
        confidence: 'high',
        uncertainties: ['장기 실행 시 기록 보존 기간'],
        alternatives_considered: ['자유 형식 전체 작업 로그 저장'],
        human_approval: 'not_required',
        impact: 'Workspace는 검토 가능한 판단 요약만 노출한다.'
      }
    ]
  };
}

function buildApprovals(episodeId, episode) {
  const gate = (id, label, phase, nextPhase, evidence) => ({
    id,
    label,
    phase,
    status: gateStatus(episode, phase),
    blocking: gateStatus(episode, phase) === 'provisional' && !phaseStarted(episode, nextPhase),
    approved_by: null,
    approved_at: null,
    evidence: evidence.filter((item) => item),
    notes: gateStatus(episode, phase) === 'provisional'
      ? 'Phase 완료 기록은 있으나 명시적 사람 승인 레코드가 없어 provisional로 표시한다.'
      : '해당 Phase 산출물이 준비되면 사람이 방향과 가치를 승인한다.'
  });
  return {
    $schema: '../../../schemas/approvals.schema.json',
    episode_id: episodeId,
    policy: {
      normal_work_continues: true,
      exception_escalation: true,
      notes: '사람은 네 Phase 게이트와 최대 재시도 초과, 입력 충돌 또는 정책 불확실성만 검토한다.'
    },
    gates: [
      gate('story-lock', 'Story Lock', 'phase1', 'phase2', [`episodes/${episodeId}/script/script.md`]),
      gate('character-lock', 'Character Lock', 'phase2', 'phase3', exists(process.cwd(), `episodes/${episodeId}/characters/characters.json`) ? [`episodes/${episodeId}/characters/characters.json`] : []),
      gate('storyboard-lock', 'Storyboard Lock', 'phase3', 'phase4', exists(process.cwd(), `episodes/${episodeId}/storyboard/storyboard.json`) ? [`episodes/${episodeId}/storyboard/storyboard.json`] : []),
      {
        id: 'release',
        label: 'Release Approval',
        phase: 'phase6',
        status: 'pending',
        blocking: true,
        approved_by: null,
        approved_at: null,
        evidence: [],
        notes: 'Phase 5 QA 통과 후 사람이 공개 가치를 최종 승인한다.'
      }
    ]
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node scripts/init-episode-governance.js [--episode EP002] [--force]');
    return;
  }
  const rootDir = process.cwd();
  const state = readJson(path.join(rootDir, 'state.json'));
  const episodeIds = args.episodes.length ? args.episodes : Object.keys(state.episodes || {});
  episodeIds.forEach((episodeId) => {
    const episode = state.episodes[episodeId];
    if (!episode) throw new Error(`Unknown episode: ${episodeId}`);
    const targets = [
      ['discovery/context.json', buildDiscovery(rootDir, episodeId, episode)],
      ['decisions/implementation-notes.json', buildDecisions(episodeId)],
      ['approvals/gates.json', buildApprovals(episodeId, episode)]
    ];
    targets.forEach(([relativePath, value]) => {
      const target = path.join(rootDir, 'episodes', episodeId, relativePath);
      if (fs.existsSync(target) && !args.force) return;
      writeJson(target, value);
      console.log(`wrote ${path.relative(rootDir, target)}`);
    });
  });
}

main();
