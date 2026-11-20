import * as THREE from 'three';
import type { FlickMode, MapTheme, ObstacleDensity, ParticipantEntry } from '../types';

export const PALETTE = [
  { main: '#ef4444', accent: '#b91c1c' },
  { main: '#3b82f6', accent: '#1d4ed8' },
  { main: '#22c55e', accent: '#15803d' },
  { main: '#f59e0b', accent: '#b45309' },
  { main: '#06b6d4', accent: '#0e7490' },
  { main: '#ec4899', accent: '#be185d' },
  { main: '#a855f7', accent: '#7e22ce' },
  { main: '#f97316', accent: '#c2410c' },
  { main: '#14b8a6', accent: '#0f766e' },
  { main: '#eab308', accent: '#a16207' },
  { main: '#6366f1', accent: '#4338ca' },
  { main: '#f43f5e', accent: '#be123c' },
];

export const PRESETS: Record<string, string> = {
  class20: Array.from({ length: 20 }, (_, i) => `${i + 1}번`).join(', '),
  coffee:
    '김팀장, 이선임, 박대리, 최사원, 정과장, 강매니저, 조디자이너, 윤개발, 장기획, 한마케터',
  weighted: '김부장*4, 박차장*3, 이과장*2, 최대리*2, 정사원*1, 막내인턴*1',
  mass: Array.from({ length: 28 }, (_, i) => `${i + 1}번`).join(', '),
};

export function parseInitialRaceOptions(search: string): {
  mapTheme: MapTheme;
  obstacleDensity: ObstacleDensity;
  flickMode: FlickMode;
} {
  const urlParams = new URLSearchParams(search);
  let mapTheme: MapTheme = 'PLAYGROUND';
  const mapParam = urlParams.get('map')?.toUpperCase();
  if (mapParam === 'TAEKWONDO' || mapParam === 'TAEBI') {
    mapTheme = 'TAEKWONDO';
  } else if (mapParam === 'DINOSAUR' || mapParam === 'DINO') {
    mapTheme = 'DINOSAUR';
  } else if (mapParam === 'POOL' || mapParam === 'SWIM' || mapParam === 'WATER') {
    mapTheme = 'POOL';
  } else if (mapParam === 'FALLGUYS' || mapParam === 'FALL') {
    mapTheme = 'FALLGUYS';
  }

  let obstacleDensity: ObstacleDensity = 'NORMAL';
  const densityParam = urlParams.get('density')?.toUpperCase();
  if (densityParam === 'LIGHT') {
    obstacleDensity = 'LIGHT';
  }

  let flickMode: FlickMode = 'DOUBLE';
  const flickParam = urlParams.get('flick')?.toUpperCase();
  if (flickParam === 'OFF' || flickParam === '0') {
    flickMode = 'OFF';
  } else if (flickParam === 'CHAOS' || flickParam === '4') {
    flickMode = 'CHAOS';
  }

  return { mapTheme, obstacleDensity, flickMode };
}

export function applySkyTheme(scene: THREE.Scene, mapTheme: MapTheme): void {
  if (mapTheme === 'TAEKWONDO') {
    scene.background = new THREE.Color('#fde68a');
    scene.fog = new THREE.FogExp2('#fef3c7', 0.003);
  } else if (mapTheme === 'DINOSAUR') {
    scene.background = new THREE.Color('#bbf7d0');
    scene.fog = new THREE.FogExp2('#dcfce7', 0.0028);
  } else if (mapTheme === 'POOL') {
    scene.background = new THREE.Color('#b6f2ff');
    scene.fog = new THREE.FogExp2('#d9fbff', 0.0026);
  } else if (mapTheme === 'FALLGUYS') {
    // 폴가이즈 맵: 화사한 하늘색과 부드러운 구름 안개
    scene.background = new THREE.Color('#9fe8ff');
    scene.fog = new THREE.FogExp2('#e3f9ff', 0.0022);
  } else {
    scene.background = new THREE.Color('#cce7ff');
    scene.fog = new THREE.FogExp2('#e0f2fe', 0.0032);
  }
}

export function getNextMapTheme(current: MapTheme): MapTheme {
  if (current === 'PLAYGROUND') return 'TAEKWONDO';
  if (current === 'TAEKWONDO') return 'DINOSAUR';
  if (current === 'DINOSAUR') return 'POOL';
  if (current === 'POOL') return 'FALLGUYS';
  return 'PLAYGROUND';
}

export function getNextFlickMode(current: FlickMode): FlickMode {
  if (current === 'DOUBLE') return 'CHAOS';
  if (current === 'CHAOS') return 'OFF';
  return 'DOUBLE';
}

export function parseParticipantsText(raw: string): ParticipantEntry[] {
  const tokens = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const entries: ParticipantEntry[] = [];
  let colorIdx = 0;

  for (const token of tokens) {
    const match = token.match(/^(.+?)\*(\d+)$/);
    const baseName = match ? match[1].trim() : token;
    const count = match ? Math.min(20, Math.max(1, parseInt(match[2], 10))) : 1;
    const paletteItem = PALETTE[colorIdx % PALETTE.length];
    colorIdx++;

    for (let i = 0; i < count; i++) {
      if (entries.length >= 48) break;
      const suffix = count > 1 ? `#${i + 1}` : '';
      entries.push({
        id: `racer-${entries.length}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${baseName}${suffix}`,
        color: paletteItem.main,
        accentColor: paletteItem.accent,
      });
    }
    if (entries.length >= 48) break;
  }

  if (entries.length < 2) {
    return [
      { id: 'r-1', name: '1번', color: PALETTE[0].main, accentColor: PALETTE[0].accent },
      { id: 'r-2', name: '2번', color: PALETTE[1].main, accentColor: PALETTE[1].accent },
    ];
  }

  return entries;
}

export function getFinishFlickBannerMessage(
  mapTheme: MapTheme,
  racerName: string,
  flickNum: number,
  isManual: boolean
): string {
  if (mapTheme === 'PLAYGROUND') {
    return isManual
      ? `🏃💥 무스탕 보스 출동! [${racerName}] 몸통 박치기로 날려버렸다!`
      : `🏃💥 ${flickNum}등 [${racerName}] 거대 캐릭터와 정면 충돌! 대역전 찬스!`;
  }
  if (mapTheme === 'DINOSAUR') {
    return isManual
      ? `🦖💥 거대 공룡 돌진! [${racerName}] 정면으로 날려버렸다!`
      : `🦖💥 ${flickNum}등 [${racerName}] 결승 직전 공룡 돌진! 대역전 찬스!`;
  }
  if (mapTheme === 'POOL') {
    return isManual
      ? `💧💥 거대 물벼락 강타! [${racerName}] 물바다로 날아갔다!`
      : `💧💥 ${flickNum}등 [${racerName}] 결승 직전 물벼락! 대역전 찬스!`;
  }
  if (mapTheme === 'FALLGUYS') {
    return isManual
      ? `🎪💥 대형 펀치 강타! [${racerName}] 젤리빈이 데굴데굴!`
      : `🎪💥 ${flickNum}등 [${racerName}] 결승 직전 펀치! 대역전 찬스!`;
  }
  return isManual
    ? `👆💥 사범님 장난 딱밤! [${racerName}] 날아갔다!`
    : `👆💥 ${flickNum}등 [${racerName}] 거대 딱밤 맞고 날아감! 대역전 찬스!`;
}

export function getManualFlickBusyMessage(mapTheme: MapTheme): string {
  if (mapTheme === 'PLAYGROUND') return '🏃 거대 캐릭터가 출동 중이에요! 잠시만요!';
  if (mapTheme === 'DINOSAUR') return '🦖 거대 공룡이 출동 중이에요! 잠시만요!';
  if (mapTheme === 'POOL') return '💧 거대 물벼락이 준비 중이에요! 잠시만요!';
  if (mapTheme === 'FALLGUYS') return '🎪 대형 펀치가 출동 중이에요! 잠시만요!';
  return '👆 딱밤 손가락이 출동 중이에요! 잠시만요!';
}

/** 결과 화면·공유 카드 등에 쓰는 맵 표시 이름 (한 곳에서만 관리). */
export const MAP_DISPLAY_NAMES: Record<MapTheme, { icon: string; name: string; label: string }> = {
  PLAYGROUND: { icon: '🏫', name: '운동장', label: '🏫 맵1 · 운동장 경주' },
  TAEKWONDO: { icon: '🥋', name: '태비태권도', label: '🥋 맵2 · 태비태권도' },
  DINOSAUR: { icon: '🏎️', name: '공룡 카트', label: '🏎️ 맵3 · 공룡 카트' },
  POOL: { icon: '🏊', name: '수영장', label: '🏊 맵4 · 수영장 스플래시' },
  FALLGUYS: { icon: '🎪', name: '폴가이즈', label: '🎪 맵5 · 폴가이즈' },
};

export function getQuickMapButtonConfig(mapTheme: MapTheme): {
  html?: string;
  text?: string;
  title: string;
} {
  const title = '클릭하여 맵 테마 변경 (운동장 → 태비태권도 → 공룡 정글 → 수영장 → 폴가이즈)';
  if (mapTheme === 'TAEKWONDO') {
    return {
      html: '<img src="./taebi-icon.jpg" alt="태비태권도" class="map-pill-icon" /><span>맵2: 태비태권도</span>',
      title,
    };
  }
  if (mapTheme === 'DINOSAUR') {
    return { text: '🏎️ 맵3: 공룡 카트', title };
  }
  if (mapTheme === 'POOL') {
    return { text: '🏊 맵4: 수영장', title };
  }
  if (mapTheme === 'FALLGUYS') {
    return { text: '🎪 맵5: 폴가이즈', title };
  }
  return { text: '🗺️ 맵1: 🏫 운동장', title };
}

export function getPrankFlickButtonConfig(mapTheme: MapTheme): {
  html?: string;
  text?: string;
  title: string;
} {
  if (mapTheme === 'PLAYGROUND') {
    return {
      html: '<img src="./boss-character.jpg" alt="캐릭터 박치기" class="boss-pill-icon" /><span>1등 박치기!</span>',
      title: '현재 1등에게 거대 캐릭터 몸통 박치기 발동!',
    };
  }
  if (mapTheme === 'DINOSAUR') {
    return {
      text: '🦖 1등 공룡돌진!',
      title: '현재 1등에게 즉시 거대 공룡 돌진 발동!',
    };
  }
  if (mapTheme === 'POOL') {
    return {
      text: '💧 1등 물벼락!',
      title: '현재 1등에게 즉시 거대 물벼락 발동!',
    };
  }
  if (mapTheme === 'FALLGUYS') {
    return {
      text: '🎪 1등 펀치!',
      title: '현재 1등에게 즉시 대형 펀치 발동!',
    };
  }
  return {
    text: '👆 1등 딱밤!',
    title: '현재 1등에게 즉시 거대 딱밤 발사!',
  };
}

export function getQuickFlickButtonConfig(
  mapTheme: MapTheme,
  flickMode: FlickMode
): { html?: string; text?: string } {
  const iconHtml = '<img src="./boss-character.jpg" alt="캐릭터" class="boss-pill-icon" />';
  const trapLabel =
    mapTheme === 'PLAYGROUND'
      ? '박치기'
      : mapTheme === 'DINOSAUR'
      ? '공룡돌진'
      : mapTheme === 'POOL'
      ? '물벼락'
      : mapTheme === 'FALLGUYS'
      ? '펀치'
      : '딱밤';
  const trapIcon =
    mapTheme === 'DINOSAUR'
      ? '🦖'
      : mapTheme === 'POOL'
      ? '💧'
      : mapTheme === 'FALLGUYS'
      ? '🎪'
      : '👆';

  if (flickMode === 'OFF') {
    return { text: `🚫 ${trapLabel}: 끔` };
  }
  if (flickMode === 'CHAOS') {
    return mapTheme === 'PLAYGROUND'
      ? { html: `${iconHtml}<span>${trapLabel}: 4명</span>` }
      : { text: `💥 ${trapLabel}: 4명` };
  }
  return mapTheme === 'PLAYGROUND'
    ? { html: `${iconHtml}<span>${trapLabel}: 2명</span>` }
    : { text: `${trapIcon} ${trapLabel}: 2명` };
}
