import confetti from 'canvas-confetti';
import type { CameraMode, FlickMode, MapTheme, ObstacleDensity, WinningRule } from '../types';
import type { RagdollRacer } from '../entities/RagdollRacer';
import {
  getPrankFlickButtonConfig,
  getQuickFlickButtonConfig,
  getQuickMapButtonConfig,
} from '../game/mapThemeConfig';

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

    for (const r of sortedRacers) {
      const item = document.createElement('div');
      item.className = 'leader-item';
      item.id = `leader-row-${r.id}`;
      item.addEventListener('click', () => {
        onSelectRacer(r.id);
      });
      listEl.appendChild(item);

      const dot = document.createElement('div');
      dot.className = 'minimap-dot';
      dot.id = `minimap-dot-${r.id}`;
      dot.style.backgroundColor = r.color;
      dotsEl.appendChild(dot);
    }
  }

  sortedRacers.forEach((r, idx) => {
    const rank = idx + 1;
    r.rank = rank;
    r.isTargetRankCandidate = rank === targetRank;

    const rowEl = document.getElementById(`leader-row-${r.id}`);
    if (rowEl) {
      rowEl.style.order = String(rank);
      rowEl.className = 'leader-item';
      if (rank === 1) rowEl.classList.add('rank-1');
      else if (rank === 2) rowEl.classList.add('rank-2');
      else if (rank === 3) rowEl.classList.add('rank-3');
      if (focusedRacerId === r.id) rowEl.classList.add('focused');
      if (rank === targetRank) rowEl.classList.add('target-winner');

      let badgeHtml = '';
      if (r.state === 'FINISHED') {
        badgeHtml = `<span class="state-pill goal">🏁</span>`;
      } else if (r.state === 'RAGDOLL') {
        badgeHtml = `<span class="state-pill ragdoll">💫</span>`;
      } else if (r.isSlowed()) {
        badgeHtml = `<span class="state-pill ragdoll">💩</span>`;
      } else if (r.isBoosted()) {
        badgeHtml = `<span class="state-pill goal">⚡</span>`;
      }

      rowEl.innerHTML = `
        <span class="leader-rank">${rank}</span>
        <span class="leader-swatch" style="background:${r.color}"></span>
        <span class="leader-name">${r.name}</span>
        <span class="leader-meta">${badgeHtml}</span>
      `;
    }

    const dotEl = document.getElementById(`minimap-dot-${r.id}`);
    if (dotEl) {
      const pct = Math.min(97, Math.max(2, (r.getPosition().z / finishZ) * 93));
      dotEl.style.left = `${pct}%`;
      dotEl.style.zIndex = rank === targetRank ? '10' : '2';
    }
  });

  // Update Zone Badge based on leader's current track position
  if (sortedRacers.length > 0) {
    const leadZ = sortedRacers[0].getPosition().z;
    const zoneEl = document.getElementById('hud-zone-badge');
    if (zoneEl) {
      zoneEl.textContent = getZoneLabelAtZ(leadZ);
    }
  }
}

export function showWinnerModal(
  winner: RagdollRacer,
  sortedRacers: RagdollRacer[],
  winningRule: WinningRule,
  targetRank: number,
  raceElapsed: number
): void {
  confetti({
    particleCount: 110,
    spread: 80,
    origin: { y: 0.55 },
  });

  const modal = document.getElementById('winner-modal')!;
  const badge = document.getElementById('modal-rule-badge')!;
  const title = document.getElementById('modal-winner-name')!;
  const desc = document.getElementById('modal-winner-desc')!;
  const statRank = document.getElementById('modal-winner-rank')!;
  const statTime = document.getElementById('modal-winner-time')!;
  const statRagdolls = document.getElementById('modal-winner-ragdolls')!;
  const rankList = document.getElementById('modal-rankings-list')!;

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

  modal.classList.remove('hidden');
}
