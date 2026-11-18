import * as THREE from 'three';
import { getTrackCenterX, getTrackHeightAtZ } from '../courseMath';
import type { CourseBuildContext } from '../courseTypes';

/** 수영장 부품: 야자수·파라솔·튜브 부표·사다리로 물놀이 분위기를 만든다 */
export function buildPoolScenery(ctx: CourseBuildContext): void {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
  const frondMats = [
    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.6 }),
  ];
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.5 });

  // 1. 야자수 가로수
  for (let tz = 8; tz <= 142; tz += 11) {
    const cx = getTrackCenterX(tz);
    const ty = getTrackHeightAtZ(tz) - 1.15;
    for (const side of [-1, 1]) {
      const palm = new THREE.Group();
      palm.position.set(
        cx + side * (12.5 + Math.random() * 4.5),
        ty,
        tz + (Math.random() - 0.5) * 3.5
      );
      const lean = (Math.random() - 0.5) * 0.16;
      const height = 4.6 + Math.random() * 2.2;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.52, height, 8),
        trunkMat
      );
      trunk.position.y = height * 0.5;
      trunk.rotation.z = lean;
      trunk.castShadow = true;
      palm.add(trunk);

      const crown = new THREE.Group();
      crown.position.set(-Math.sin(lean) * height, height, 0);
      const frondCount = 7;
      for (let f = 0; f < frondCount; f++) {
        const a = (f / frondCount) * Math.PI * 2 + Math.random() * 0.25;
        const frond = new THREE.Mesh(
          new THREE.BoxGeometry(2.4 + Math.random() * 0.9, 0.1, 0.8),
          frondMats[f % frondMats.length]
        );
        frond.position.set(Math.cos(a) * 1.25, 0.05 - Math.random() * 0.1, Math.sin(a) * 1.25);
        frond.rotation.y = -a;
        frond.rotation.z = -0.3;
        frond.castShadow = true;
        crown.add(frond);
      }
      for (let c = 0; c < 3; c++) {
        const coconut = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
        );
        const a = (c / 3) * Math.PI * 2;
        coconut.position.set(Math.cos(a) * 0.42, -0.35, Math.sin(a) * 0.42);
        crown.add(coconut);
      }
      palm.add(crown);
      ctx.courseGroup.add(palm);
    }
  }

  // 2. 파라솔 & 선베드 (트랙 바깥 물가)
  const parasolColors = [0xf472b6, 0x22d3ee, 0xfde047, 0xa855f7];
  for (let tz = 16; tz <= 136; tz += 22) {
    const cx = getTrackCenterX(tz);
    const ty = getTrackHeightAtZ(tz) - 2.3;
    for (const side of [-1, 1]) {
      const stand = new THREE.Group();
      stand.position.set(cx + side * (11.2 + Math.random() * 2.5), ty, tz + side * 3);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8), whiteMat);
      pole.position.y = 1.7;
      stand.add(pole);

      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 0.95, 8),
        new THREE.MeshStandardMaterial({
          color: parasolColors[Math.floor(Math.random() * parasolColors.length)],
          roughness: 0.45,
        })
      );
      canopy.position.y = 3.45;
      canopy.castShadow = true;
      stand.add(canopy);

      const bedMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.7 });
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 3.1), bedMat);
      bed.position.set(side * 1.1, 0.32, 0);
      bed.rotation.y = side * 0.2;
      bed.castShadow = true;
      stand.add(bed);

      const pillow = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.2, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.6 })
      );
      pillow.position.set(side * 1.1, 0.47, -1.2);
      stand.add(pillow);
      ctx.courseGroup.add(stand);
    }
  }

  // 3. 물 위에 떠 있는 컬러 튜브 부표
  const floatColors = [0xf472b6, 0xfde047, 0x22d3ee, 0xa855f7, 0xfb923c, 0x4ade80];
  for (let tz = 12; tz <= 140; tz += 6.5) {
    const cx = getTrackCenterX(tz);
    const wy = getTrackHeightAtZ(tz) - 2.05;
    for (const side of [-1, 1]) {
      if (Math.random() < 0.25) continue;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.85 + Math.random() * 0.35, 0.28, 10, 20),
        new THREE.MeshStandardMaterial({
          color: floatColors[Math.floor(Math.random() * floatColors.length)],
          roughness: 0.35,
        })
      );
      ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      ring.rotation.z = Math.random() * Math.PI;
      ring.position.set(
        cx + side * (10.6 + Math.random() * 7.5),
        wy + (Math.random() - 0.5) * 0.15,
        tz + (Math.random() - 0.5) * 3.2
      );
      ctx.courseGroup.add(ring);
    }
  }

  // 4. 수영장 사다리 (출발 지점 옆)
  for (const side of [-1, 1]) {
    const ladderZ = 12.5;
    const lcx = getTrackCenterX(ladderZ);
    const ly = getTrackHeightAtZ(ladderZ) - 2.4;
    const ladder = new THREE.Group();
    ladder.position.set(lcx + side * 10.4, ly, ladderZ);
    for (const rail of [-0.55, 0.55]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.6, 8), metalMat);
      r.position.set(rail, 1.8, 0);
      ladder.add(r);
    }
    for (let lr = 0; lr < 4; lr++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), metalMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.5 + lr * 0.85, 0);
      ladder.add(rung);
    }
    ctx.courseGroup.add(ladder);
  }

  // 5. 안전요원 의자 (물벼락 존 옆)
  const chairZ = 66;
  const ccx = getTrackCenterX(chairZ);
  const chY = getTrackHeightAtZ(chairZ) - 2.35;
  const chair = new THREE.Group();
  chair.position.set(ccx + 10.6, chY, chairZ);
  const chairMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
  for (const lx of [-0.6, 0.6]) {
    for (const lz of [-0.6, 0.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.0, 0.16), chairMat);
      leg.position.set(lx * 1.2, 1.5, lz * 1.2);
      chair.add(leg);
    }
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.7), whiteMat);
  seat.position.y = 3.05;
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.2, 0.18), chairMat);
  back.position.set(0, 3.7, -0.8);
  chair.add(back);
  const umbrella = new THREE.Mesh(
    new THREE.ConeGeometry(1.9, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.5 })
  );
  umbrella.position.y = 5.4;
  chair.add(umbrella);
  ctx.courseGroup.add(chair);
}

/** 도넛 튜브 범퍼 메쉬 (알록달록 물놀이 튜브) */
export function createTubeBumperMesh(colorHex: number): THREE.Group {
  const group = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(1.12, 0.46, 12, 26),
    new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 })
  );
  torus.rotation.x = Math.PI / 2;
  torus.castShadow = true;
  group.add(torus);

  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2 + Math.PI / 4;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.22), stripeMat);
    stripe.position.set(Math.cos(a) * 1.12, 0.16, Math.sin(a) * 1.12);
    group.add(stripe);
  }
  return group;
}

export function createWaterBalloonMesh(): THREE.Group {
  const group = new THREE.Group();
  const balloon = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 18, 14),
    new THREE.MeshStandardMaterial({
      color: 0xff5fa2,
      transparent: true,
      opacity: 0.92,
      roughness: 0.08,
      metalness: 0.2,
      emissive: 0xe0417f,
      emissiveIntensity: 0.35,
    })
  );
  balloon.scale.set(1, 1.12, 1);
  balloon.castShadow = true;
  group.add(balloon);

  // 하늘에서도 잘 보이도록 두른 흰색 밴딩
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.13, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
  );
  band.rotation.x = Math.PI / 2;
  group.add(band);

  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 })
  );
  shine.position.set(-0.46, 0.6, 0.84);
  group.add(shine);

  const knot = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0xe0417f, roughness: 0.3 })
  );
  knot.position.y = -1.45;
  knot.rotation.x = Math.PI;
  group.add(knot);
  return group;
}

export function createRubberDuckMesh(): THREE.Group {
  const group = new THREE.Group();
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.32 });
  const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), yellowMat);
  bodyMesh.scale.set(1.15, 0.9, 1.25);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 12), yellowMat);
  head.position.set(0, 0.92, 0.62);
  head.castShadow = true;
  group.add(head);

  const beak = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.22, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 })
  );
  beak.position.set(0, 0.82, 1.24);
  group.add(beak);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
    eye.position.set(side * 0.24, 1.1, 1.06);
    group.add(eye);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 8), yellowMat);
  tail.position.set(0, 0.35, -1.34);
  tail.rotation.x = -Math.PI * 0.42;
  group.add(tail);
  return group;
}
