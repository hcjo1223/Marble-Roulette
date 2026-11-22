import type { MapTheme, WinningRule } from '../types';
import type { RagdollRacer } from '../entities/RagdollRacer';
import { MAP_DISPLAY_NAMES } from '../game/mapThemeConfig';

export interface ShareCardPayload {
  winner: RagdollRacer;
  sortedRacers: RagdollRacer[];
  winningRule: WinningRule;
  targetRank: number;
  raceElapsed: number;
  mapTheme: MapTheme;
  screenshotDataUrl: string | null;
}

export interface GeneratedShareCard {
  dataUrl: string;
  blob: Blob | null;
  filename: string;
}


function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function generateFallguysShareCard(
  payload: ShareCardPayload
): Promise<GeneratedShareCard> {
  const { winner, sortedRacers, winningRule, targetRank, raceElapsed, mapTheme, screenshotDataUrl } =
    payload;

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 1. Fall Guys Pastel Sky-to-Berry Gradient Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#ffe3f1');
  bg.addColorStop(0.5, '#dff6ff');
  bg.addColorStop(1, '#f1e7ff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft pastel bokeh bubbles
  const bubbles = [
    { x: 110, y: 150, r: 140, c: 'rgba(255, 95, 162, 0.16)' },
    { x: 960, y: 210, r: 170, c: 'rgba(43, 223, 232, 0.18)' },
    { x: 910, y: 1160, r: 190, c: 'rgba(255, 225, 77, 0.22)' },
    { x: 160, y: 1120, r: 160, c: 'rgba(180, 140, 255, 0.18)' },
  ];
  for (const b of bubbles) {
    ctx.fillStyle = b.c;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cheerful confetti dots
  const confettiColors = ['#ff5fa2', '#2bdfe8', '#ffe14d', '#b48cff', '#7df7c0'];
  for (let i = 0; i < 42; i++) {
    ctx.save();
    const cx = ((i * 197 + 73) % (W - 80)) + 40;
    const cy = ((i * 263 + 41) % (H - 80)) + 40;
    ctx.translate(cx, cy);
    ctx.rotate((i * 0.7) % Math.PI);
    ctx.fillStyle = confettiColors[i % confettiColors.length];
    ctx.globalAlpha = 0.55;
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 8 + (i % 5) * 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-10, -5, 20, 10);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Helper for Fall Guys 3D Jelly Pill / Card
  const drawJellyCard = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    shadowColor: string,
    shadowOffset: number = 10
  ) => {
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.roundRect(x, y + shadowOffset, w, h, r);
    ctx.fill();

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };

  // 2. Top Title & Map Badge
  drawJellyCard(72, 46, W - 144, 86, 43, '#ff5fa2', '#e0417f', 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 38px "Jua", "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👑 총총 래그돌 달리기 3D · RESULT CARD', W / 2, 91);

  drawJellyCard(250, 152, W - 500, 54, 27, '#ffffff', '#dfd1e8', 6);
  ctx.fillStyle = '#2b2440';
  ctx.font = '700 26px "Jua", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${MAP_DISPLAY_NAMES[mapTheme].label}  ·  참가자 ${sortedRacers.length}명`, W / 2, 180);

  // 3. Framed 3D WebGL Race Screenshot
  const shotX = 72;
  const shotY = 230;
  const shotW = W - 144;
  const shotH = 440;
  drawJellyCard(shotX, shotY, shotW, shotH, 34, '#ffffff', '#d8c5e3', 12);

  const shotPad = 14;
  const innerX = shotX + shotPad;
  const innerY = shotY + shotPad;
  const innerW = shotW - shotPad * 2;
  const innerH = shotH - shotPad * 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(innerX, innerY, innerW, innerH, 24);
  ctx.clip();

  const img = screenshotDataUrl ? await loadImage(screenshotDataUrl) : null;
  if (img && img.width > 0 && img.height > 0) {
    // Cover-crop 3D viewport snapshot cleanly
    const imgAspect = img.width / img.height;
    const boxAspect = innerW / innerH;
    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;
    if (imgAspect > boxAspect) {
      sw = img.height * boxAspect;
      sx = (img.width - sw) * 0.5;
    } else {
      sh = img.width / boxAspect;
      sy = (img.height - sh) * 0.5;
    }
    ctx.drawImage(img, sx, sy, sw, sh, innerX, innerY, innerW, innerH);
  } else {
    const fallbackGrad = ctx.createLinearGradient(innerX, innerY, innerX + innerW, innerY + innerH);
    fallbackGrad.addColorStop(0, '#7cc9ff');
    fallbackGrad.addColorStop(1, '#ff8cc0');
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(innerX, innerY, innerW, innerH);
  }
  ctx.restore();

  // Sticker badge on corner of screenshot
  drawJellyCard(shotX + 30, shotY + 26, 238, 48, 24, '#ffe14d', '#edc512', 5);
  ctx.fillStyle = '#2b2440';
  ctx.font = '800 24px "Jua", "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📸 CROWN FINISH!', shotX + 30 + 119, shotY + 51);

  // 4. Winner Main Card
  const cardX = 72;
  const cardY = 696;
  const cardW = W - 144;
  const cardH = 594;
  drawJellyCard(cardX, cardY, cardW, cardH, 38, '#ffffff', '#decce7', 12);

  const ruleText =
    winningRule === 'FIRST'
      ? '🏆 1등 우승 당첨!'
      : winningRule === 'LAST'
      ? '💀 최후의 꼴찌 당첨!'
      : `🎯 ${targetRank}등 목표 당첨!`;

  drawJellyCard(W / 2 - 190, cardY + 24, 380, 54, 27, '#ffe14d', '#edc512', 6);
  ctx.fillStyle = '#5c3c00';
  ctx.font = '800 28px "Jua", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(ruleText, W / 2, cardY + 52);

  // Winner Color Pill + Name
  ctx.fillStyle = winner.color;
  ctx.beginPath();
  ctx.arc(W / 2 - 220, cardY + 138, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = winner.color;
  ctx.font = '800 72px "Jua", "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  const displayWinner = winner.name.length > 12 ? `${winner.name.slice(0, 12)}…` : winner.name;
  ctx.fillText(displayWinner, W / 2 + 12, cardY + 140);

  // 3 Telemetry Boxes
  const statW = (cardW - 84 - 36) / 3;
  const statY = cardY + 200;
  const stats = [
    { label: '최종 순위', value: `#${winner.finishOrder ?? 1}위`, bg: '#fff4fa', sh: '#f2d7e6' },
    {
      label: '완주 기록',
      value: `${(winner.finishTime || raceElapsed).toFixed(2)}초`,
      bg: '#e8f8ff',
      sh: '#bfe9f5',
    },
    { label: '래그돌 피격', value: `💥 ${winner.ragdollCount}회`, bg: '#fff9df', sh: '#f0dc9a' },
  ];
  stats.forEach((st, idx) => {
    const sx = cardX + 42 + idx * (statW + 18);
    drawJellyCard(sx, statY, statW, 108, 22, st.bg, st.sh, 6);
    ctx.fillStyle = '#6b6285';
    ctx.font = '700 22px "Jua", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(st.label, sx + statW / 2, statY + 34);
    ctx.fillStyle = '#2b2440';
    ctx.font = '800 34px "Jua", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(st.value, sx + statW / 2, statY + 74);
  });

  // Top Podium Standings Rows (up to 4 rows)
  const listY = cardY + 332;
  const shown = sortedRacers.slice(0, 4);
  if (!shown.some((r) => r.id === winner.id)) {
    shown[shown.length - 1] = winner;
  }

  shown.forEach((r, idx) => {
    const ry = listY + idx * 58;
    const isWin = r.id === winner.id;
    drawJellyCard(
      cardX + 42,
      ry,
      cardW - 84,
      48,
      24,
      isWin ? '#ffe14d' : '#f8f4fc',
      isWin ? '#edc512' : '#e6d8ef',
      4
    );
    const rankNum = sortedRacers.findIndex((sr) => sr.id === r.id) + 1;
    const medal = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : `#${rankNum}`;

    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(cardX + 74, ry + 24, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2b2440';
    ctx.font = '800 24px "Jua", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${medal}  ${r.name}`, cardX + 98, ry + 25);

    ctx.textAlign = 'right';
    const timeStr =
      r.finishTime !== null ? `${r.finishTime.toFixed(2)}s (💥${r.ragdollCount})` : `주행 중 (💥${r.ragdollCount})`;
    ctx.fillText(timeStr, cardX + cardW - 68, ry + 25);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7e7499';
  ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `Marble Roulette · Ragdoll Derby 3D  |  ${new Date().toLocaleDateString('ko-KR')}`,
    W / 2,
    H - 28
  );

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  const safeName = winner.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
  const filename = `ragdoll-derby-${safeName}-result.png`;
  return { dataUrl, blob, filename };
}
