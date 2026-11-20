import type { MapTheme } from '../types';

export type CustomObstacleKind =
  | 'SWEEPER'
  | 'POPUP_BUMPER'
  | 'PINBALL_BUMPER'
  | 'SLIDING_WALL'
  | 'PENDULUM'
  | 'SPRINGBOARD'
  | 'BOOST_BELT'
  | 'REVERSE_BELT'
  | 'WIND_FAN'
  | 'BREAKING_DOORS'
  | 'WAVE_CURRENT';

export interface CustomObstacleSpec {
  id: string;
  kind: CustomObstacleKind;
  z: number;
  offsetX: number;
  scale: number;
  speed: number;
  dir: 1 | -1;
}

export interface CustomCourseLayout {
  version: 1;
  name: string;
  baseMap: MapTheme;
  clearBaseObstacles: boolean;
  obstacles: CustomObstacleSpec[];
}

export interface CustomObstacleCatalogItem {
  kind: CustomObstacleKind;
  label: string;
  icon: string;
  defaultScale: number;
  defaultSpeed: number;
  defaultDir: 1 | -1;
}

export const CUSTOM_OBSTACLE_CATALOG: CustomObstacleCatalogItem[] = [
  { kind: 'SWEEPER', label: '회전 망치', icon: '🌀', defaultScale: 1.0, defaultSpeed: 3.0, defaultDir: 1 },
  { kind: 'POPUP_BUMPER', label: '팝업 범퍼', icon: '🟢', defaultScale: 1.0, defaultSpeed: 3.2, defaultDir: 1 },
  { kind: 'PINBALL_BUMPER', label: '핀볼 범퍼', icon: '🎯', defaultScale: 1.0, defaultSpeed: 1.0, defaultDir: 1 },
  { kind: 'SLIDING_WALL', label: '왕복 펀치월', icon: '🥊', defaultScale: 1.0, defaultSpeed: 1.4, defaultDir: 1 },
  { kind: 'PENDULUM', label: '진자 해머', icon: '🔨', defaultScale: 1.0, defaultSpeed: 2.3, defaultDir: 1 },
  { kind: 'SPRINGBOARD', label: '점프 발판', icon: '🚀', defaultScale: 1.0, defaultSpeed: 1.0, defaultDir: 1 },
  { kind: 'BOOST_BELT', label: '가속 벨트', icon: '⚡', defaultScale: 1.0, defaultSpeed: 14.0, defaultDir: 1 },
  { kind: 'REVERSE_BELT', label: '역주행 벨트', icon: '🐢', defaultScale: 1.0, defaultSpeed: 9.5, defaultDir: -1 },
  { kind: 'WIND_FAN', label: '강풍 선풍기', icon: '💨', defaultScale: 1.0, defaultSpeed: 28.0, defaultDir: 1 },
  { kind: 'BREAKING_DOORS', label: '격파 문', icon: '❓', defaultScale: 1.0, defaultSpeed: 1.0, defaultDir: 1 },
  { kind: 'WAVE_CURRENT', label: '파도 물살', icon: '🌊', defaultScale: 1.0, defaultSpeed: 2.0, defaultDir: 1 },
];
