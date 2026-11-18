export type CameraMode = 'LEAD' | 'LAST' | 'TOP' | 'FREE';

export type WinningRule = 'FIRST' | 'LAST' | 'NTH';

export type MapTheme = 'PLAYGROUND' | 'TAEKWONDO' | 'DINOSAUR' | 'POOL' | 'FALLGUYS';

export type ObstacleDensity = 'NORMAL' | 'LIGHT';

export type FlickMode = 'OFF' | 'DOUBLE' | 'CHAOS';

export type RacerState = 'WAITING' | 'RUNNING' | 'RAGDOLL' | 'RECOVERING' | 'FINISHED';

export interface ParticipantEntry {
  id: string;
  name: string;
  color: string;
  accentColor: string;
}

export interface RaceConfig {
  participants: ParticipantEntry[];
  winningRule: WinningRule;
  targetRank: number; // 1-indexed
}

export interface RacerTelemetry {
  id: string;
  name: string;
  color: string;
  rank: number;
  progress: number; // 0 to 100
  zPos: number;
  state: RacerState;
  finishOrder: number | null;
  finishTime: number | null;
  ragdollCount: number;
}
