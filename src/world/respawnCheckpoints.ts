import type { MapTheme, ObstacleDensity } from '../types';

/**
 * 마지막 구간(finishZ - 34 이후)에서 떨어지거나 밀려난 레이서가 다시 시작할 지점.
 *
 * 원칙: 장애물 "입구"가 아니라 장애물을 통과한 직후, 움직이는 장애물의 판정 범위 밖에 둔다.
 * 레이서는 자기가 떨어진 위치(z)보다 뒤에 있는 체크포인트 중 가장 앞의 것으로 돌아간다.
 */
export interface RespawnCheckpoint {
  z: number;
  /** 트랙 중심 기준 좌우 오프셋(m). 회전 막대 등을 피하려고 한쪽으로 치우칠 때 사용. */
  xOffset?: number;
  /** 좌우 무작위 분산 폭(±m). 기본 1.2m. */
  spread?: number;
}

export function getRespawnCheckpoints(
  mapTheme: MapTheme,
  obstacleDensity: ObstacleDensity,
  finishZ: number,
  baseObstaclesCleared: boolean
): RespawnCheckpoint[] {
  // 기본 장애물을 지운 커스텀 맵: 장애물 위치를 알 수 없으므로 기존 위치 하나만 사용
  if (baseObstaclesCleared) {
    return [{ z: finishZ - 32 }];
  }

  const isLight = obstacleDensity === 'LIGHT';

  switch (mapTheme) {
    case 'PLAYGROUND':
      // z 99: 좌우로 움직이는 보스 장애물, z 105~122: 좁은 다리,
      // 진자: 108 / 115 / 121 (적음: 114)
      return isLight
        ? [{ z: 102.5 }, { z: 118 }]
        : [{ z: 102.5 }, { z: 111.5 }, { z: 118 }, { z: 125 }];

    case 'TAEKWONDO':
      // z 99: 보스 장애물, 103.5: 팝업 범퍼(좌우 ±2.2), 105~122: 좁은 다리,
      // 샌드백 108 / 118, 호구 방패 113, 팝업 범퍼 122.5 (적음: 샌드백 114, 범퍼 122.5)
      return isLight
        ? [{ z: 102.5 }, { z: 118 }, { z: 125.5 }]
        : [{ z: 102.5 }, { z: 110.5 }, { z: 115.5 }, { z: 125.5 }];

    case 'POOL':
      // 역방향 벨트·물대포 ~97, 파도 존 101~111.5(→) / 112.5~123(←),
      // 회전 막대 z114(x-1.5, 반경 5) / z125(반경 5.6)
      // 두 파도 존 사이(z 110.5~113.5)는 회전 막대(z114, x-1.5) 반경 밖인 오른쪽(x+4)으로 둔다.
      return isLight
        ? [{ z: 99 }]
        : [
            { z: 99 },
            { z: 112, xOffset: 4.0, spread: 0.6 },
            // 두 회전 막대(z114·z125) 판정 반경 밖, 트랙 오른쪽 끝
            { z: 119.5, xOffset: 6.5, spread: 0.5 },
          ];

    case 'FALLGUYS':
      // 펀치 월 z 98, 사라지는 바닥 104~120.
      // 가운데 타일이 가장 먼저 사라지므로 바닥 앞 리스폰은 트랙 전체 폭으로 흩뿌린다.
      return [{ z: 101, spread: 6.0 }, { z: 122, spread: 4.0 }];

    case 'DINOSAUR':
      // 좁은 협곡 다리 186~208, 용암 간헐천 190/198/201, 트리케라톱스 207, 터보 패드 213~214
      return [{ z: finishZ - 32 }, { z: finishZ - 12 }];

    default:
      return [{ z: finishZ - 32 }];
  }
}

/** 떨어진 위치보다 뒤에 있는 체크포인트 중 가장 앞의 것. 없으면 첫 체크포인트. */
export function pickRespawnCheckpoint(
  checkpoints: RespawnCheckpoint[],
  fallZ: number
): RespawnCheckpoint {
  let picked = checkpoints[0];
  for (const cp of checkpoints) {
    if (cp.z <= fallZ && cp.z > picked.z) picked = cp;
  }
  return picked;
}
