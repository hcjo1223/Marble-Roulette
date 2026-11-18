import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  TRACK_SLOPE,
  envCollisionGroup,
  getTrackCenterX,
  getTrackHalfWidthAtZ,
  getTrackHeightAtZ,
  getTrackYawAtZ,
} from '../courseMath';
import {
  createAthleticTrackTexture,
  createCheckeredTexture,
  createCurvedFloorStripGeometry,
  createPastelTileTexture,
  createTaekwondoMatTexture,
  createWoodFloorTexture,
} from '../courseTextures';
import type { CourseBuildContext } from '../courseTypes';

export function addArchSign(
  ctx: CourseBuildContext,
  z: number,
  title: string,
  borderHex: string,
  bgHex: string,
  textHex: string,
  showTaebiIcon: boolean = false
): void {
  const cx = getTrackCenterX(z);
  const y = getTrackHeightAtZ(z);
  const yaw = getTrackYawAtZ(z);
  const halfW = getTrackHalfWidthAtZ(z, ctx.mapTheme);

  const group = new THREE.Group();
  group.position.set(cx, y, z);
  group.rotation.y = yaw;

  const pillarColor =
    ctx.mapTheme === 'TAEKWONDO'
      ? 0xb91c1c
      : ctx.mapTheme === 'DINOSAUR'
      ? 0x78350f
      : ctx.mapTheme === 'POOL'
      ? 0x0891b2
      : 0x16a34a;
  const pillarMat = new THREE.MeshStandardMaterial({ color: pillarColor, roughness: 0.4 });
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 8.8, 12), pillarMat);
    pillar.position.set(side * (halfW + 0.1), 4.4, 0);
    group.add(pillar);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 96;
  const ctx2d = canvas.getContext('2d')!;
  const drawBannerBase = () => {
    ctx2d.clearRect(0, 0, 1024, 96);
    ctx2d.fillStyle = bgHex;
    ctx2d.beginPath();
    ctx2d.roundRect(10, 6, 1004, 84, 18);
    ctx2d.fill();
    ctx2d.strokeStyle = borderHex;
    ctx2d.lineWidth = 8;
    ctx2d.stroke();

    ctx2d.fillStyle = textHex;
    ctx2d.font = '800 44px "Plus Jakarta Sans", "Pretendard", sans-serif';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillText(title, showTaebiIcon ? 544 : 512, 49);
  };
  drawBannerBase();

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if (showTaebiIcon) {
    const iconImg = new Image();
    iconImg.onload = () => {
      drawBannerBase();
      const cxIcon = 120;
      const cyIcon = 48;
      const rxIcon = 30;
      const ryIcon = 35;
      ctx2d.save();
      ctx2d.beginPath();
      ctx2d.ellipse(cxIcon, cyIcon, rxIcon, ryIcon, 0, 0, Math.PI * 2);
      ctx2d.clip();
      ctx2d.fillStyle = '#ffffff';
      ctx2d.fillRect(cxIcon - rxIcon, cyIcon - ryIcon, rxIcon * 2, ryIcon * 2);
      ctx2d.drawImage(iconImg, cxIcon - rxIcon, cyIcon - ryIcon, rxIcon * 2, ryIcon * 2);
      ctx2d.restore();
      ctx2d.strokeStyle = borderHex;
      ctx2d.lineWidth = 4;
      ctx2d.beginPath();
      ctx2d.ellipse(cxIcon, cyIcon, rxIcon, ryIcon, 0, 0, Math.PI * 2);
      ctx2d.stroke();
      tex.needsUpdate = true;
    };
    iconImg.src = './taebi-icon.jpg';
  }

  const bannerMat = new THREE.MeshBasicMaterial({
    map: tex,
    toneMapped: false,
    transparent: true,
    opacity: 1,
  });
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2 + 0.7, 1.45, 0.35),
    bannerMat
  );
  banner.position.set(0, 8.4, 0);
  group.add(banner);
  ctx.overheadBanners.push({ mat: bannerMat, z });
  ctx.courseGroup.add(group);
}

export function buildCurvedTrackAndScenery(
  ctx: CourseBuildContext,
  buildThemeScenery?: () => void
): void {
  const envGroup = envCollisionGroup();
  const isTkd = ctx.mapTheme === 'TAEKWONDO';
  const isDino = ctx.mapTheme === 'DINOSAUR';
  const isPool = ctx.mapTheme === 'POOL';
  const isFg = ctx.mapTheme === 'FALLGUYS';

  const zone1Mat = new THREE.MeshStandardMaterial({
    map: isTkd
      ? createTaekwondoMatTexture('#2563eb', '#dc2626')
      : isFg
      ? createCheckeredTexture('#ffd1e3', '#fff6fb', 6, 10)
      : isDino
      ? createPastelTileTexture('#86efac', '#4ade80')
      : isPool
      ? createPastelTileTexture('#a5f3fc', '#67e8f9')
      : createWoodFloorTexture(),
    roughness: isPool ? 0.24 : isFg ? 0.3 : 0.58,
    metalness: isPool ? 0.14 : isFg ? 0.1 : 0.05,
  });
  const zone2Mat = new THREE.MeshStandardMaterial({
    map: isTkd
      ? createWoodFloorTexture()
      : isFg
      ? createPastelTileTexture('#fff2ae', '#b8f5e0')
      : isDino
      ? createPastelTileTexture('#fde68a', '#fcd34d')
      : isPool
      ? createPastelTileTexture('#99f6e4', '#5eead4')
      : createPastelTileTexture('#bae6fd', '#e0f2fe'),
    roughness: isPool ? 0.24 : isFg ? 0.3 : 0.5,
    metalness: isPool ? 0.14 : isFg ? 0.1 : 0.05,
  });
  const zone3Mat = new THREE.MeshStandardMaterial({
    map: isTkd
      ? createTaekwondoMatTexture('#1e3a8a', '#1d4ed8')
      : isFg
      ? createPastelTileTexture('#c2ebff', '#ffffff')
      : isDino
      ? createPastelTileTexture('#475569', '#334155')
      : isPool
      ? createPastelTileTexture('#bfdbfe', '#93c5fd')
      : createPastelTileTexture('#a5f3fc', '#cffafe'),
    roughness: isPool ? 0.24 : isFg ? 0.3 : 0.45,
    metalness: isPool ? 0.14 : isFg ? 0.1 : 0.05,
  });
  const zone4Mat = new THREE.MeshStandardMaterial({
    map: isTkd
      ? createTaekwondoMatTexture('#b91c1c', '#1e40af')
      : isFg
      ? createCheckeredTexture('#ffe066', '#a8e6ff', 6, 14)
      : isDino
      ? createWoodFloorTexture()
      : isPool
      ? createCheckeredTexture('#38bdf8', '#f0fdff', 6, 14)
      : createAthleticTrackTexture(),
    roughness: isPool ? 0.24 : isFg ? 0.34 : 0.68,
    metalness: isPool ? 0.14 : isFg ? 0.08 : 0.02,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    color: isTkd
      ? 0xfef3c7
      : isDino
      ? 0x57534e
      : isPool
      ? 0xf0fdff
      : isFg
      ? 0xffffff
      : 0xf8fafc,
    roughness: 0.65,
  });
  const wallCapMat = new THREE.MeshStandardMaterial({
    color: isTkd
      ? 0x92400e
      : isDino
      ? 0x16a34a
      : isPool
      ? 0x22d3ee
      : isFg
      ? 0xff6fb5
      : 0xfbbf24,
    roughness: 0.4,
  });

  const coplanarFloorQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(TRACK_SLOPE, 0, 0)
  );

  const stepZ = 4.0;
  for (let z0 = -4; z0 < ctx.trackLength; z0 += stepZ) {
    const z1 = z0 + stepZ;
    const zMid = (z0 + z1) * 0.5;
    const x0 = getTrackCenterX(z0);
    const x1 = getTrackCenterX(z1);
    const xMid = (x0 + x1) * 0.5;
    const yMid = getTrackHeightAtZ(zMid);

    const dx = x1 - x0;
    const dz = z1 - z0;
    const yaw = Math.atan2(dx, dz);
    const floorSegLen = dz / Math.cos(TRACK_SLOPE) + 0.4;
    const halfW = getTrackHalfWidthAtZ(zMid, ctx.mapTheme);
    const floorHalfW = halfW + Math.abs(dx) * 0.6 + 0.45;

    const wallQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(TRACK_SLOPE, yaw, 0, 'YXZ')
    );

    let floorMat = zone1Mat;
    if (isDino) {
      if (zMid >= 62 && zMid < 120) floorMat = zone2Mat;
      else if (zMid >= 120 && zMid < 180) floorMat = zone3Mat;
      else if (zMid >= 180) floorMat = zone4Mat;
    } else {
      if (zMid >= 42 && zMid < 72) floorMat = zone2Mat;
      else if (zMid >= 72 && zMid < 100) floorMat = zone3Mat;
      else if (zMid >= 100) floorMat = zone4Mat;
    }

    const floorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(floorHalfW * 2, 1.2, floorSegLen),
      floorMat
    );
    floorMesh.position.set(xMid, yMid - 0.6, zMid);
    floorMesh.quaternion.copy(coplanarFloorQuat);
    floorMesh.receiveShadow = true;
    ctx.courseGroup.add(floorMesh);

    const floorBody = ctx.createBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(xMid, yMid - 0.6, zMid)
        .setRotation({
          x: coplanarFloorQuat.x,
          y: coplanarFloorQuat.y,
          z: coplanarFloorQuat.z,
          w: coplanarFloorQuat.w,
        })
    );
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(floorHalfW, 0.6, floorSegLen * 0.5)
        .setFriction(isDino ? 0.05 : isFg ? 0.09 : 0.12)
        .setRestitution(0.15)
        .setCollisionGroups(envGroup),
      floorBody
    );

    const isBridge =
      isPool || isFg
        ? false
        : isDino
        ? zMid >= 184 && zMid <= 210
        : zMid >= 103 && zMid <= 123;
    const wallCutoffZ = isDino ? 120 : 72;
    const wallHeight = isFg ? 1.9 : zMid < wallCutoffZ ? 3.0 : isBridge ? 0.95 : 1.75;
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const hw0 = getTrackHalfWidthAtZ(z0, ctx.mapTheme);
    const hw1 = getTrackHalfWidthAtZ(z1, ctx.mapTheme);

    for (const side of [-1, 1]) {
      const wx0 = x0 + side * (hw0 + 0.35);
      const wx1 = x1 + side * (hw1 + 0.35);
      const wx = (wx0 + wx1) * 0.5;
      const wz = zMid;
      const wy = yMid + wallHeight * 0.5;

      const wDx = wx1 - wx0;
      const wYaw = Math.atan2(wDx, dz);
      const wSegLen = Math.hypot(wDx, dz) / Math.cos(TRACK_SLOPE) + 0.85;
      const sideWallQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(TRACK_SLOPE, wYaw, 0, 'YXZ')
      );

      const wallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, wallHeight, wSegLen),
        wallMat
      );
      wallMesh.position.set(wx, wy, wz);
      wallMesh.quaternion.copy(sideWallQuat);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      ctx.courseGroup.add(wallMesh);

      if (!isBridge) {
        const capColor = isPool
          ? zMid >= 100
            ? 0xf472b6
            : null
          : isFg
          ? [0xff6fb5, 0x5ee7c7, 0xffe066, 0x7cc9ff][Math.floor(Math.abs(zMid) / 8) % 4]
          : isDino
          ? zMid >= 120 && zMid < 180
            ? 0xea580c
            : zMid >= 180
            ? 0xca8a04
            : null
          : zMid >= 100
          ? isTkd
            ? 0xdc2626
            : 0x22c55e
          : null;
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(0.78, 0.22, wSegLen),
          capColor !== null
            ? new THREE.MeshStandardMaterial({ color: capColor })
            : wallCapMat
        );
        cap.position.set(wx, yMid + wallHeight + 0.1, wz);
        cap.quaternion.copy(sideWallQuat);
        ctx.courseGroup.add(cap);
      }

      const colliderHalfH = isBridge ? wallHeight * 0.5 + 0.2 : wallHeight * 0.5 + 2.2;
      const colliderCenterY = isBridge ? wy : yMid + colliderHalfH;
      const wallBody = ctx.createBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(wx, colliderCenterY, wz)
          .setRotation({
            x: sideWallQuat.x,
            y: sideWallQuat.y,
            z: sideWallQuat.z,
            w: sideWallQuat.w,
          })
      );
      ctx.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.42, colliderHalfH, wSegLen * 0.5)
          .setFriction(0.0)
          .setRestitution(0.4)
          .setCollisionGroups(envGroup),
        wallBody
      );
    }

    if (zMid >= 10 && zMid <= (isDino ? 58 : 40) && Math.round(z0) % 12 === 0) {
      for (const side of [-1, 1]) {
        const decoX = xMid + side * rightX * (halfW - 0.05);
        const decoZ = zMid + side * rightZ * (halfW - 0.05);
        const decoY = yMid + 2.0;

        if (isTkd) {
          const board = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 1.5, 4.2),
            new THREE.MeshStandardMaterial({
              color: side === -1 ? 0x1e3a8a : 0x991b1b,
              roughness: 0.5,
            })
          );
          board.position.set(decoX, decoY, decoZ);
          board.quaternion.copy(wallQuat);
          ctx.courseGroup.add(board);
        } else if (isDino) {
          const vine = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 1.4, 4.0),
            new THREE.MeshStandardMaterial({
              color: side === -1 ? 0x15803d : 0x65a30d,
              roughness: 0.75,
            })
          );
          vine.position.set(decoX, decoY, decoZ);
          vine.quaternion.copy(wallQuat);
          ctx.courseGroup.add(vine);
        } else if (isPool) {
          const rope = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.42, 4.0),
            new THREE.MeshStandardMaterial({
              color: side === -1 ? 0x0ea5e9 : 0x22d3ee,
              roughness: 0.35,
            })
          );
          rope.position.set(decoX, yMid + 0.9, decoZ);
          rope.quaternion.copy(wallQuat);
          ctx.courseGroup.add(rope);
        } else if (isFg) {
          const panelColor = side === -1 ? 0xff8cc0 : 0x7fe7cf;
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.9, 4.0),
            new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.35 })
          );
          panel.position.set(decoX, yMid + 1.0, decoZ);
          panel.quaternion.copy(wallQuat);
          ctx.courseGroup.add(panel);

          const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
          for (let d = -1; d <= 1; d++) {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), dotMat);
            dot.position.set(decoX, yMid + 1.0, decoZ + d * 1.15);
            dot.scale.set(0.6, 1, 1);
            ctx.courseGroup.add(dot);
          }
        } else if (side === -1) {
          const board = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 1.5, 4.4),
            new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 })
          );
          board.position.set(decoX, decoY, decoZ);
          board.quaternion.copy(wallQuat);
          ctx.courseGroup.add(board);
        } else {
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 1.4, 3.4),
            new THREE.MeshStandardMaterial({
              color: 0x7dd3fc,
              emissive: 0x38bdf8,
              emissiveIntensity: 0.2,
            })
          );
          win.position.set(decoX, decoY, decoZ);
          win.quaternion.copy(wallQuat);
          ctx.courseGroup.add(win);
        }
      }
    }
  }

  // Back wall behind starting area
  const backBody = ctx.createBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, getTrackHeightAtZ(-3.5) + 2, -3.5)
  );
  ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(9.5, 2.5, 0.5).setCollisionGroups(envGroup),
    backBody
  );

  const groundW = isDino ? 190 : 130;
  const groundL = isDino ? 290 : 160;
  const groundCenterZ = isDino ? 134 : 86;
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(groundW, groundL),
    new THREE.MeshStandardMaterial({
      color: isTkd
        ? 0xfde68a
        : isDino
        ? 0x15803d
        : isPool
        ? 0x0ea5e9
        : isFg
        ? 0xffd1e8
        : 0x4ade80,
      roughness: 0.9,
    })
  );
  groundMesh.rotation.x = -Math.PI / 2 + TRACK_SLOPE;
  groundMesh.position.set(
    getTrackCenterX(groundCenterZ),
    getTrackHeightAtZ(groundCenterZ) - 2.4,
    groundCenterZ
  );
  groundMesh.receiveShadow = true;
  ctx.courseGroup.add(groundMesh);

  if (buildThemeScenery) {
    buildThemeScenery();
  } else {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: isTkd ? 0x15803d : 0x22c55e,
      roughness: 0.65,
    });
    for (let tz = 96; tz <= 144; tz += 9) {
      const cx = getTrackCenterX(tz);
      const ty = getTrackHeightAtZ(tz) - 1.2;
      for (const side of [-1, 1]) {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(cx + side * (12 + Math.random() * 6), ty, tz);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.2, 8), trunkMat);
        trunk.position.y = 1.6;
        trunk.castShadow = true;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 10), leafMat);
        crown.position.y = 4.2;
        crown.castShadow = true;
        treeGroup.add(trunk, crown);
        ctx.courseGroup.add(treeGroup);
      }
    }
  }

  if (isTkd) {
    addArchSign(ctx, 11, '태비태권도 수련 시작!', '#dc2626', '#fef2f2', '#991b1b', true);
    addArchSign(ctx, 43, '🪵 송판 & 기와 격파!', '#d97706', '#fef3c7', '#92400e');
    addArchSign(ctx, 72, '🥁 기합 장풍 & 품새 스텝', '#2563eb', '#dbeafe', '#1e3a8a');
    addArchSign(ctx, 103, '⚔️ 챔피언 대련장', '#1e293b', '#f8fafc', '#0f172a');
  } else if (isDino) {
    addArchSign(ctx, 11, '🏎️ 공룡 정글 카트 출발!', '#15803d', '#dcfce7', '#14532d');
    addArchSign(ctx, 62, '🦖 티라노가 달려온다!!', '#dc2626', '#fee2e2', '#7f1d1d');
    addArchSign(ctx, 120, '💩 익룡 똥 폭격 & 화산 계곡', '#d97706', '#fef3c7', '#78350f');
    addArchSign(ctx, 182, '🌋 최후의 공룡 협곡 스퍼트!', '#7c2d12', '#ffedd5', '#431407');
  } else if (isPool) {
    addArchSign(ctx, 11, '🏊 수영장 스플래시 출발!', '#0891b2', '#ecfeff', '#0e7490');
    addArchSign(ctx, 43, '🛟 튜브 범퍼 슬라럼', '#f472b6', '#fdf2f8', '#be185d');
    addArchSign(ctx, 66, '💧 물벼락 낙하 존!', '#0284c7', '#e0f2fe', '#075985');
    addArchSign(ctx, 84, '🌊 물살 컨베이어', '#22d3ee', '#f0fdff', '#0e7490');
    addArchSign(ctx, 101, '🏄 빅웨이브 파도 풀!', '#a855f7', '#f5f3ff', '#6b21a8');
  } else if (isFg) {
    addArchSign(ctx, 11, '🎪 폴가이즈 스타트!', '#ec4899', '#fdf2f8', '#be185d');
    addArchSign(ctx, 43, '🫧 에어 쿠션 범퍼 존', '#0ea5b7', '#ecfeff', '#0f766e');
    addArchSign(ctx, 72, '🌀 대형 회전 빔 점프!', '#d97706', '#fef9c3', '#92400e');
    addArchSign(ctx, 88, '🥊 풍선 펀치월 & 피스톤', '#7c3aed', '#f5f3ff', '#5b21b6');
    addArchSign(ctx, 101, '🟢 슬라임 램프 → 👑 왕관 결승', '#16a34a', '#ecfdf5', '#15803d');
  } else {
    addArchSign(ctx, 11, '🏫 교실 출발!', '#f59e0b', '#fef3c7', '#92400e');
    addArchSign(ctx, 43, '❓ 미스터리 관문', '#0284c7', '#e0f2fe', '#075985');
    addArchSign(ctx, 72, '💨 강풍 & 컨베이어', '#0891b2', '#cffafe', '#155e75');
    addArchSign(ctx, 103, '🏃 운동장', '#16a34a', '#dcfce7', '#14532d');
  }
}

export function buildStartGate(ctx: CourseBuildContext): {
  startGateMesh: THREE.Mesh;
  startGateBody: RAPIER.RigidBody;
} {
  const z = 8.5;
  const cx = getTrackCenterX(z);
  const y = getTrackHeightAtZ(z);
  const isTkd = ctx.mapTheme === 'TAEKWONDO';
  const isDino = ctx.mapTheme === 'DINOSAUR';
  const isPool = ctx.mapTheme === 'POOL';
  const isFg = ctx.mapTheme === 'FALLGUYS';
  const gateTex = createCheckeredTexture(
    isTkd ? '#dc2626' : isDino ? '#16a34a' : isFg ? '#ff6fb5' : isPool ? '#22d3ee' : '#fbbf24',
    isTkd ? '#2563eb' : isDino ? '#facc15' : '#ffffff',
    12,
    2
  );

  const startGateMesh = new THREE.Mesh(
    new THREE.BoxGeometry(17.8, 2.5, 0.5),
    new THREE.MeshStandardMaterial({ map: gateTex, roughness: 0.3 })
  );
  startGateMesh.position.set(cx, y + 1.25, z);
  startGateMesh.castShadow = true;
  ctx.courseGroup.add(startGateMesh);

  const startGateBody = ctx.createBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(cx, y + 1.25, z)
  );
  ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(8.9, 1.25, 0.25).setCollisionGroups(envCollisionGroup()),
    startGateBody
  );

  return { startGateMesh, startGateBody };
}

export function buildFinishArch(ctx: CourseBuildContext, isTkd: boolean): void {
  const isDino = ctx.mapTheme === 'DINOSAUR';
  const isPool = ctx.mapTheme === 'POOL';
  const isFg = ctx.mapTheme === 'FALLGUYS';
  const finishZ = ctx.finishZ;
  const cx = getTrackCenterX(finishZ);
  const yaw = getTrackYawAtZ(finishZ);
  const finishY = getTrackHeightAtZ(finishZ);
  const checkTex = createCheckeredTexture(
    isTkd ? '#facc15' : isDino ? '#bef264' : isFg ? '#ffd93d' : isPool ? '#22d3ee' : '#ffffff',
    isDino ? '#14532d' : isFg ? '#ff6fb5' : isPool ? '#0e7490' : '#0f172a',
    12,
    2
  );

  const finishStripGeo = createCurvedFloorStripGeometry(
    finishZ - 1.6,
    finishZ + 1.6,
    -8.8,
    8.8,
    0.08,
    4
  );
  const finishStrip = new THREE.Mesh(
    finishStripGeo,
    new THREE.MeshBasicMaterial({
      map: checkTex,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  ctx.courseGroup.add(finishStrip);

  const finishGroup = new THREE.Group();
  finishGroup.position.set(cx, finishY, finishZ);
  finishGroup.rotation.y = yaw;

  const archMat = new THREE.MeshStandardMaterial({
    color: isTkd ? 0x1e293b : isDino ? 0x15803d : isFg ? 0xffb703 : isPool ? 0x0891b2 : 0xfacc15,
    roughness: 0.25,
  });
  for (const side of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.4, 0.9), archMat);
    col.position.set(side * 8.6, 4.7, 0);
    col.castShadow = true;
    finishGroup.add(col);
  }

  const topBannerMat = new THREE.MeshStandardMaterial({
    map: checkTex,
    roughness: 0.3,
    transparent: true,
    opacity: 1,
  });
  const topBanner = new THREE.Mesh(new THREE.BoxGeometry(18.4, 1.8, 1.1), topBannerMat);
  topBanner.position.set(0, 9.0, 0);
  finishGroup.add(topBanner);
  ctx.overheadBanners.push({ mat: topBannerMat, z: finishZ });

  ctx.courseGroup.add(finishGroup);

  const endZ = finishZ + 14.5;
  const endCX = getTrackCenterX(endZ);
  const endY = getTrackHeightAtZ(endZ);
  const endYaw = getTrackYawAtZ(endZ);
  const endWallHeight = 3.6;

  const endWallGroup = new THREE.Group();
  endWallGroup.position.set(endCX, endY, endZ);
  endWallGroup.rotation.y = endYaw;

  const endWallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(20.6, endWallHeight, 1.0),
    new THREE.MeshStandardMaterial({
      color: isTkd ? 0x1e293b : isDino ? 0x14532d : isFg ? 0xff6fb5 : isPool ? 0x0e7490 : 0x16a34a,
      roughness: 0.5,
    })
  );
  endWallMesh.position.y = endWallHeight * 0.5;
  endWallMesh.castShadow = true;
  endWallMesh.receiveShadow = true;
  endWallGroup.add(endWallMesh);

  const endWallPad = new THREE.Mesh(
    new THREE.BoxGeometry(19.6, 1.1, 1.15),
    new THREE.MeshStandardMaterial({
      map: checkTex,
      roughness: 0.35,
    })
  );
  endWallPad.position.y = 1.8;
  endWallGroup.add(endWallPad);

  const endWallCap = new THREE.Mesh(
    new THREE.BoxGeometry(20.8, 0.32, 1.12),
    new THREE.MeshStandardMaterial({
      color: isTkd ? 0xdc2626 : isDino ? 0xf97316 : isFg ? 0xffd93d : isPool ? 0xf472b6 : 0xfacc15,
      roughness: 0.35,
    })
  );
  endWallCap.position.y = endWallHeight + 0.14;
  endWallGroup.add(endWallCap);

  ctx.courseGroup.add(endWallGroup);

  const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, endYaw, 0));
  const endBody = ctx.createBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(endCX, endY + 2.6, endZ)
      .setRotation({ x: endQuat.x, y: endQuat.y, z: endQuat.z, w: endQuat.w })
  );
  ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(10.8, 3.0, 0.65)
      .setFriction(0.5)
      .setRestitution(0.25)
      .setCollisionGroups(envCollisionGroup()),
    endBody
  );
}
