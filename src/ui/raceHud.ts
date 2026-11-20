import confetti from 'canvas-confetti';
import type { CameraMode, FlickMode, MapTheme, ObstacleDensity, WinningRule } from '../types';
import type { RagdollRacer } from '../entities/RagdollRacer';
import {
  getPrankFlickButtonConfig,
  getQuickFlickButtonConfig,
  getQuickMapButtonConfig,
  MAP_DISPLAY_NAMES,
} from '../game/mapThemeConfig';
import type { GeneratedShareCard } from './shareCard';

interface LeaderRowNodes {
  row: HTMLDivElement;
  rankSpan: HTMLSpanElement;
  nameSpan: HTMLSpanElement;
  metaSpan: HTMLSpanElement;
  dot: HTMLDivElement;
  lastRankText: string;
  lastMetaText: string;
  lastMetaClass: string;
  lastRowClass: string;
}

const leaderNodesMap = new Map<string, LeaderRowNodes>();
let latestShareCard: GeneratedShareCard | null = null;
let shareListenersBound = false;
let latestClassSummaryText = '';

export function showHudBanner(msg: string): void {
  const banner = document.getElementById('flick-banner');
  const textEl = document.getElementById('flick-banner-text');
  if (banner && textEl) {
    textEl.textContent = msg;
    banner.classList.remove('hidden');
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
  }
}

export function hideHudBanner(): void {
  document.getElementById('flick-banner')?.classList.add('hidden');
}

export function setSlowMoHud(active: boolean): void {
  document.body.classList.toggle('slowmo-active', active);
  document.getElementById('slowmo-banner')!.classList.toggle('hidden', !active);
  document.getElementById('btn-slowmo-toggle')!.classList.toggle('active', active);
}

export function syncCameraButtons(mode: CameraMode): void {
  document.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cam === mode);
  });
}

export function syncFlickModeUI(mapTheme: MapTheme, flickMode: FlickMode): void {
  document.querySelectorAll<HTMLButtonElement>('.flick-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.flick === flickMode);
  });

  const quickFlickBtn = document.getElementById('btn-quick-flick-toggle');
  if (quickFlickBtn) {
    const cfg = getQuickFlickButtonConfig(mapTheme, flickMode);
    if (cfg.html !== undefined) {
      quickFlickBtn.innerHTML = cfg.html;
    } else if (cfg.text !== undefined) {
      quickFlickBtn.textContent = cfg.text;
    }
    quickFlickBtn.classList.toggle('off-active', flickMode === 'OFF');
    quickFlickBtn.classList.toggle('chaos-active', flickMode === 'CHAOS');
  }
}

export function syncMapThemeUI(mapTheme: MapTheme, flickMode: FlickMode): void {
  document.querySelectorAll<HTMLButtonElement>('.map-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.map === mapTheme);
  });

  const quickMapBtn = document.getElementById('btn-quick-map-toggle');
  if (quickMapBtn) {
    const cfg = getQuickMapButtonConfig(mapTheme);
    if (cfg.html !== undefined) {
      quickMapBtn.innerHTML = cfg.html;
    } else if (cfg.text !== undefined) {
      quickMapBtn.textContent = cfg.text;
    }
    quickMapBtn.classList.toggle('tkd-active', mapTheme === 'TAEKWONDO');
    quickMapBtn.classList.toggle('dino-active', mapTheme === 'DINOSAUR');
    quickMapBtn.classList.toggle('pool-active', mapTheme === 'POOL');
    quickMapBtn.classList.toggle('fg-active', mapTheme === 'FALLGUYS');
    quickMapBtn.title = cfg.title;
  }

  const prankFlickBtn = document.getElementById('btn-prank-flick');
  if (prankFlickBtn) {
    const cfg = getPrankFlickButtonConfig(mapTheme);
    if (cfg.html !== undefined) {
      prankFlickBtn.innerHTML = cfg.html;
    } else if (cfg.text !== undefined) {
      prankFlickBtn.textContent = cfg.text;
    }
    prankFlickBtn.title = cfg.title;
  }

  syncFlickModeUI(mapTheme, flickMode);
}

export function syncDensityUI(obstacleDensity: ObstacleDensity): void {
  document.querySelectorAll<HTMLButtonElement>('.density-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.density === obstacleDensity);
  });

  const quickDensityBtn = document.getElementById('btn-quick-density-toggle');
  if (quickDensityBtn) {
    quickDensityBtn.textContent =
      obstacleDensity === 'LIGHT' ? '🌿 장애물: 적음' : '🔥 장애물: 많음';
    quickDensityBtn.classList.toggle('light-active', obstacleDensity === 'LIGHT');
  }
}

export function updateRuleTelemetryUI(winningRule: WinningRule, totalRacers: number): number {
  const countBadge = document.getElementById('parsed-count-badge')!;
  const hudRule = document.getElementById('hud-win-rule')!;
  const nthInput = document.getElementById('nth-rank-input') as HTMLInputElement;

  countBadge.textContent = `${totalRacers}명 준비됨`;
  nthInput.max = String(totalRacers);

  if (winningRule === 'FIRST') {
    hudRule.textContent = '🏆 1등 당첨';
    return 1;
  }
  if (winningRule === 'LAST') {
    hudRule.textContent = `💀 꼴찌(${totalRacers}등)`;
    return totalRacers;
  }

  const requested = Math.max(1, Math.min(totalRacers, parseInt(nthInput.value, 10) || 2));
  hudRule.textContent = `🎯 ${requested}등 당첨`;
  return requested;
}

export function renderLeaderboardUI(
  sortedRacers: RagdollRacer[],
  focusedRacerId: string | null,
  targetRank: number,
  finishZ: number,
  getZoneLabelAtZ: (z: number) => string,
  onSelectRacer: (racerId: string) => void,
  rebuildDOM: boolean = false
): void {
  const listEl = document.getElementById('leaderboard-list')!;
  const dotsEl = document.getElementById('minimap-dots')!;

  if (rebuildDOM) {
    listEl.innerHTML = '';
    dotsEl.innerHTML = '';
    leaderNodesMap.clear();

    const listFrag = document.createDocumentFragment();
    const dotsFrag = document.createDocumentFragment();

    for (const r of sortedRacers) {
      const item = document.createElement('div');
      item.className = 'leader-item';
      item.id = `leader-row-${r.id}`;
      item.addEventListener('click', () => {
        onSelectRacer(r.id);
      });

      const rankSpan = document.createElement('span');
      rankSpan.className = 'leader-rank';

      const swatchSpan = document.createElement('span');
      swatchSpan.className = 'leader-swatch';
      swatchSpan.style.background = r.color;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'leader-name';
      nameSpan.textContent = r.name;

      const metaSpan = document.createElement('span');
      metaSpan.className = 'leader-meta';

      item.append(rankSpan, swatchSpan, nameSpan, metaSpan);
      listFrag.appendChild(item);

      const dot = document.createElement('div');
      dot.className = 'minimap-dot';
      dot.id = `minimap-dot-${r.id}`;
      dot.style.backgroundColor = r.color;
      dotsFrag.appendChild(dot);

      leaderNodesMap.set(r.id, {
        row: item,
        rankSpan,
        nameSpan,
        metaSpan,
        dot,
        lastRankText: '',
        lastMetaText: '',
        lastMetaClass: '',
        lastRowClass: '',
      });
    }

    listEl.appendChild(listFrag);
    dotsEl.appendChild(dotsFrag);
  }

  for (let idx = 0; idx < sortedRacers.length; idx++) {
    const r = sortedRacers[idx];
    const rank = idx + 1;
    r.rank = rank;
    r.isTargetRankCandidate = rank === targetRank;

    const nodes = leaderNodesMap.get(r.id);
    if (nodes) {
      nodes.row.style.order = String(rank);

      let rowClass = 'leader-item';
      if (rank === 1) rowClass += ' rank-1';
      else if (rank === 2) rowClass += ' rank-2';
      else if (rank === 3) rowClass += ' rank-3';
      if (focusedRacerId === r.id) rowClass += ' focused';
      if (rank === targetRank) rowClass += ' target-winner';
      if (nodes.lastRowClass !== rowClass) {
        nodes.row.className = rowClass;
        nodes.lastRowClass = rowClass;
      }

      const rankStr = String(rank);
      if (nodes.lastRankText !== rankStr) {
        nodes.rankSpan.textContent = rankStr;
        nodes.lastRankText = rankStr;
      }

      let metaText = '';
      let metaClass = 'leader-meta';
      if (r.state === 'FINISHED') {
        metaText = '🏁';
        metaClass = 'leader-meta state-pill goal';
      } else if (r.state === 'RAGDOLL') {
        metaText = '💫';
        metaClass = 'leader-meta state-pill ragdoll';
      } else if (r.isRidingTube()) {
        metaText = '🛟';
        metaClass = 'leader-meta state-pill goal';
      } else if (r.isSlowed()) {
        metaText = '💩';
        metaClass = 'leader-meta state-pill ragdoll';
      } else if (r.isBoosted()) {
        metaText = '⚡';
        metaClass = 'leader-meta state-pill goal';
      }

      if (nodes.lastMetaText !== metaText) {
        nodes.metaSpan.textContent = metaText;
        nodes.lastMetaText = metaText;
      }
      if (nodes.lastMetaClass !== metaClass) {
        nodes.metaSpan.className = metaClass;
        nodes.lastMetaClass = metaClass;
      }

      const pct = Math.min(97, Math.max(2, (r.getPosition().z / finishZ) * 93));
      nodes.dot.style.left = `${pct.toFixed(1)}%`;
      nodes.dot.style.zIndex = rank === targetRank ? '10' : '2';
    }
  }

  if (sortedRacers.length > 0) {
    const leadZ = sortedRacers[0].getPosition().z;
    const zoneEl = document.getElementById('hud-zone-badge');
    if (zoneEl) {
      zoneEl.textContent = getZoneLabelAtZ(leadZ);
    }
  }
}

function ensureShareCardListeners(): void {
  if (shareListenersBound) return;
  shareListenersBound = true;

  const statusEl = document.getElementById('share-card-status');
  const setStatus = (msg: string) => {
    if (statusEl) {
      statusEl.textContent = msg;
      setTimeout(() => {
        if (statusEl.textContent === msg) statusEl.textContent = '';
      }, 2600);
    }
  };

  document.getElementById('btn-share-download')?.addEventListener('click', () => {
    if (!latestShareCard) return;
    const a = document.createElement('a');
    a.href = latestShareCard.dataUrl;
    a.download = latestShareCard.filename;
    a.click();
    setStatus('저장 완료!');
  });

  document.getElementById('btn-share-copy')?.addEventListener('click', async () => {
    if (!latestShareCard?.blob) return;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': latestShareCard.blob }),
        ]);
        setStatus('이미지 복사됨!');
      } else {
        setStatus('브라우저 미지원 · 저장 이용');
      }
    } catch {
      setStatus('복사 권한 없음 · 저장 이용');
    }
  });

  document.getElementById('btn-share-native')?.addEventListener('click', async () => {
    if (!latestShareCard?.blob || !navigator.share) return;
    try {
      const file = new File([latestShareCard.blob], latestShareCard.filename, {
        type: 'image/png',
      });
      await navigator.share({
        title: '총총 래그돌 달리기 3D 결과',
        text: '방금 레이스 당첨 결과 공유 카드!',
        files: [file],
      });
    } catch {
      // Cancelled by user
    }
  });

  document.getElementById('btn-copy-class-log')?.addEventListener('click', async () => {
    if (!latestClassSummaryText) return;
    try {
      await navigator.clipboard.writeText(latestClassSummaryText);
      setStatus('수업 기록 복사됨!');
    } catch {
      setStatus('클립보드 복사 실패');
    }
  });
}

export function showWinnerModal(
  winner: RagdollRacer,
  sortedRacers: RagdollRacer[],
  winningRule: WinningRule,
  targetRank: number,
  raceElapsed: number,
  mapTheme: MapTheme = 'PLAYGROUND',
  screenshotDataUrl: string | null = null
): void {
  confetti({
    particleCount: 110,
    spread: 80,
    origin: { y: 0.55 },
  });

  ensureShareCardListeners();

  const modal = document.getElementById('winner-modal')!;
  const badge = document.getElementById('modal-rule-badge')!;
  const title = document.getElementById('modal-winner-name')!;
  const desc = document.getElementById('modal-winner-desc')!;
  const statRank = document.getElementById('modal-winner-rank')!;
  const statTime = document.getElementById('modal-winner-time')!;
  const statRagdolls = document.getElementById('modal-winner-ragdolls')!;
  const rankList = document.getElementById('modal-rankings-list')!;
  const previewImg = document.getElementById('share-card-preview') as HTMLImageElement | null;
  const shareTitleEl = document.getElementById('share-card-title');
  const mapName = MAP_DISPLAY_NAMES[mapTheme];
  if (shareTitleEl) shareTitleEl.textContent = `📸 ${mapName.icon} ${mapName.name} 결과 공유 카드`;
  if (previewImg) previewImg.alt = `${mapName.name} 결과 공유 카드 미리보기`;
  const nativeBtn = document.getElementById('btn-share-native');
  const statusEl = document.getElementById('share-card-status');

  badge.textContent =
    winningRule === 'FIRST'
      ? '🏆 1등 우승 당첨자 발표'
      : winningRule === 'LAST'
      ? '💀 최후의 꼴찌 당첨자 발표'
      : `🎯 목표 순위 (${targetRank}등) 당첨자 발표`;

  title.textContent = winner.name;
  title.style.color = winner.color;
  desc.textContent = `총 ${winner.ragdollCount}번의 장애물 충돌과 래그돌 몸싸움을 뚫고 #${winner.finishOrder}위로 결승선을 통과했습니다!`;

  statRank.textContent = `#${winner.finishOrder}위`;
  statTime.textContent = `${(winner.finishTime || raceElapsed).toFixed(2)}초`;
  statRagdolls.textContent = `💥 ${winner.ragdollCount}회`;

  rankList.innerHTML = '';
  sortedRacers.forEach((r, idx) => {
    const row = document.createElement('div');
    row.className = `modal-rank-row ${r.id === winner.id ? 'is-winner' : ''}`;
    const statusStr =
      r.finishOrder !== null
        ? `${r.finishTime?.toFixed(2)}s (💥${r.ragdollCount})`
        : `주행 중 (💥${r.ragdollCount})`;
    row.innerHTML = `
      <span>#${idx + 1} · ${r.name}</span>
      <span>${statusStr}</span>
    `;
    rankList.appendChild(row);
  });

  const perf = window.__MARBLE_PERF__;
  latestClassSummaryText = [
    `[수업 실사용 레이스 기록 - ${new Date().toLocaleString('ko-KR')}]`,
    `- 맵: ${mapTheme} | 참가자: ${sortedRacers.length}명 | 방식: ${winningRule} (#${targetRank})`,
    `- 당첨자: ${winner.name} (${(winner.finishTime || raceElapsed).toFixed(2)}초, 피격 ${winner.ragdollCount}회)`,
    perf
      ? `- 실측 프레임: ${perf.fps} FPS (평균 ${perf.frameMs.avg}ms / p95 ${perf.frameMs.p95}ms / 물리 ${perf.breakdownMs.worldStep}ms)`
      : `- 화면: ${window.innerWidth}x${window.innerHeight} (DPR ${window.devicePixelRatio})`,
    `- 학생 반응 / 메모: `,
  ].join('\n');

  if (previewImg) {
    previewImg.classList.add('hidden');
  }
  if (statusEl) {
    statusEl.textContent = '카드 생성 중...';
  }
  latestShareCard = null;

  import('./shareCard')
    .then(({ generateFallguysShareCard }) =>
      generateFallguysShareCard({
        winner,
        sortedRacers,
        winningRule,
        targetRank,
        raceElapsed,
        mapTheme,
        screenshotDataUrl,
      })
    )
    .then((card) => {
      latestShareCard = card;
      if (previewImg) {
        previewImg.src = card.dataUrl;
        previewImg.classList.remove('hidden');
      }
      if (statusEl) {
        statusEl.textContent = '';
      }
      if (nativeBtn && typeof navigator.share === 'function' && card.blob) {
        const testFile = new File([card.blob], card.filename, { type: 'image/png' });
        const canShareFiles =
          typeof navigator.canShare === 'function' ? navigator.canShare({ files: [testFile] }) : true;
        nativeBtn.classList.toggle('hidden', !canShareFiles);
      }
    })
    .catch((err) => {
      console.warn('Share card generation failed:', err);
      if (statusEl) statusEl.textContent = '';
    });

  modal.classList.remove('hidden');
}
