import type { MapTheme } from '../types';
import { GROUP_ENV, GROUP_LIMB, GROUP_TORSO, makeCollisionGroups } from '../entities/RagdollRacer';

export const TRACK_LENGTH = 146;
export const FINISH_Z = 132;
export const DINO_TRACK_LENGTH = 244;
export const DINO_FINISH_Z = 228;
export const TRACK_SLOPE = 0.088;

export function envCollisionGroup(): number {
  return makeCollisionGroups(GROUP_ENV, GROUP_TORSO | GROUP_LIMB | GROUP_ENV);
}

export function getTrackCenterX(z: number): number {
  // Keep starting grid & initial sprint (z <= 14) 100% straight so racers never snag at start
  if (z <= 14) return 0;
  const s = z - 14;
  const ease = Math.min(1, s / 18);
  const smoothEase = ease * ease * (3 - 2 * ease);
  return smoothEase * (Math.sin(s * 0.036) * 8.2 - Math.sin(s * 0.014) * 2.0);
}

export function getTrackYawAtZ(z: number): number {
  const dz = 0.5;
  const dx = getTrackCenterX(z + dz) - getTrackCenterX(z - dz);
  return Math.atan2(dx, dz * 2);
}

export function getTrackHeightAtZ(z: number): number {
  return -Math.tan(TRACK_SLOPE) * z;
}

export function getTrackHalfWidthAtZ(z: number, mapTheme: MapTheme): number {
  // 수영장·폴가이즈 맵은 좁아지는 병목 다리 없이 넓은 트랙을 유지한다
  if (mapTheme === 'POOL' || mapTheme === 'FALLGUYS') {
    return 9.0;
  }

  if (mapTheme === 'DINOSAUR') {
    // Narrow Canyon Bridge near end of long Dinosaur Kart track (Z = 180 .. 214)
    if (z >= 180 && z < 186) {
      const t = (z - 180) / 6;
      return 9.0 * (1 - t) + 5.6 * t;
    }
    if (z >= 186 && z <= 208) {
      return 5.6;
    }
    if (z > 208 && z <= 214) {
      const t = (z - 208) / 6;
      return 5.6 * (1 - t) + 9.0 * t;
    }
    return 9.0;
  }

  // Narrow bottleneck bridge in Zone 4 (Z = 102 .. 124)
  if (z >= 98 && z < 105) {
    const t = (z - 98) / 7;
    return 9.0 * (1 - t) + 4.8 * t;
  }
  if (z >= 105 && z <= 122) {
    return 4.8;
  }
  if (z > 122 && z <= 128) {
    const t = (z - 122) / 6;
    return 4.8 * (1 - t) + 9.0 * t;
  }
  return 9.0;
}

export function hasFloorPitAtZ(z: number, mapTheme: MapTheme): boolean {
  return mapTheme === 'FALLGUYS' && z >= 104 && z <= 120;
}

export function getZoneLabelAtZ(z: number, mapTheme: MapTheme, finishZ: number): string {
  if (mapTheme === 'TAEKWONDO') {
    if (z < 42) return '🥋 태비태권도장';
    if (z < 72) return '🪵 송판 & 기와 격파';
    if (z < 100) return '🥁 기합 장풍 존';
    if (z < finishZ) return '⚔️ 대련장';
    return '🏆 승단 심사';
  }
  if (mapTheme === 'DINOSAUR') {
    if (z < 62) return '🏎️ 공룡 정글 서킷';
    if (z < 120) return '🦖 티라노 추격 지대';
    if (z < 180) return '💩 익룡 똥 & 화산 계곡';
    if (z < finishZ) return '🌋 최후의 공룡 협곡';
    return '🏆 정글 탈출 성공';
  }
  if (mapTheme === 'POOL') {
    if (z < 42) return '🎢 워터슬라이드 · 튜브 탑승';
    if (z < 66) return '🛟 튜브 슬라럼';
    if (z < 82) return '💧 물벼락 낙하 존';
    if (z < 100) return '🌊 물살 컨베이어 · 대포';
    if (z < finishZ) return '🏄 파도 물살 밀림 풀';
    return '🏁 수영장 완주!';
  }
  if (mapTheme === 'FALLGUYS') {
    if (z < 42) return '🫧 에어 쿠션 범퍼 존';
    if (z < 72) return '🌀 대형 회전 빔 점프';
    if (z < 100) return '🥊 풍선 펀치월 · 피스톤';
    if (z < finishZ) return '🟨 사라지는 바닥 존';
    return '👑 왕관 결승선!';
  }
  if (z < 42) return '🏠 교실';
  if (z < 72) return '❓ 복도 관문';
  if (z < 100) return '💨 강풍 통로';
  if (z < finishZ) return '🏃 운동장';
  return '🏁 결승선';
}
