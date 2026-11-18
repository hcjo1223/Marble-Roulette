import * as THREE from 'three';
import type { MapTheme } from '../../types';
import { createDinosaurMesh } from '../maps/dinosaurModels';

export function createComicFlickSprite(mapTheme: MapTheme): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 130;
  const ctx = canvas.getContext('2d')!;

  const isPlayground = mapTheme === 'PLAYGROUND';
  const isDino = mapTheme === 'DINOSAUR';
  const isPool = mapTheme === 'POOL';
  const isFg = mapTheme === 'FALLGUYS';
  const labelText = isPlayground
    ? '💥 쾅!! 박치기!'
    : isDino
    ? '💥 공룡돌진!!'
    : isPool
    ? '💥 물벼락!!'
    : isFg
    ? '💥 펀치!!'
    : '💥 딱밤!!';

  ctx.fillStyle = isPlayground
    ? '#fde047'
    : isDino
    ? '#bbf7d0'
    : isPool
    ? '#a5f3fc'
    : isFg
    ? '#ffe1f0'
    : '#fef08a';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(12, 14, 336, 102, 30);
  ctx.fill();
  ctx.stroke();

  ctx.font =
    isPlayground || isDino
      ? '900 44px "Plus Jakarta Sans", "Pretendard", sans-serif'
      : '900 54px "Plus Jakarta Sans", "Pretendard", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeText(labelText, 180, 66);
  ctx.fillStyle = '#ef4444';
  ctx.fillText(labelText, 180, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(5.6, 2.05, 1);
  sprite.renderOrder = 1600;
  sprite.visible = false;
  return sprite;
}

/** 맵3(공룡맵): 1등 공룡돌진 거대 트랩 (가시·황금뿔 보스 티라노) */
export function createGiantDinoChargeTrap(): {
  root: THREE.Group;
  dinoBodyPivot: THREE.Group;
  dinoLeftLeg?: THREE.Mesh;
  dinoRightLeg?: THREE.Mesh;
  dinoHeadPivot?: THREE.Group;
} {
  const root = new THREE.Group();
  const dinoBodyPivot = new THREE.Group();
  root.add(dinoBodyPivot);

  const dino = createDinosaurMesh('TREX', 1.0, false);
  dinoBodyPivot.add(dino.group);

  const redSpikeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.3,
    emissive: 0x991b1b,
    emissiveIntensity: 0.2,
  });
  const orangeSpikeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.28,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.25,
    metalness: 0.25,
  });

  // 등줄기·꼬리를 따라 솟은 보스 공룡 화산 가시 (뒤에서 봐도 거대 공룡임을 한눈에 인식)
  const backSpikes: [number, number, number, number][] = [
    [3.68, 0.72, 0.34, 0.85],
    [3.7, 0.0, 0.38, 0.96],
    [3.6, -0.76, 0.32, 0.82],
    [2.6, -1.75, 0.26, 0.68],
    [2.38, -2.58, 0.22, 0.56],
  ];
  backSpikes.forEach(([sy, sz, rad, h], idx) => {
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(rad, h, 8),
      idx % 2 === 0 ? redSpikeMat : orangeSpikeMat
    );
    spike.position.set(0, sy, sz);
    spike.rotation.x = -0.34;
    spike.castShadow = true;
    dino.group.add(spike);
  });

  // 가슴~목에 황금 챔피언 스파이크 밴드
  const collar = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.34, 1.55), goldMat);
  collar.position.set(0, 3.22, 0.65);
  dino.group.add(collar);

  // 머리 위 쌍 뿔 + 눈빛 + 송곳니 추가
  if (dino.headPivot) {
    const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.95, 8), goldMat);
      horn.position.set(sx * 0.58, 1.18, 0.78);
      horn.rotation.x = 0.42;
      horn.rotation.z = -sx * 0.16;
      dino.headPivot.add(horn);

      const glowEye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.22), eyeGlowMat);
      glowEye.position.set(sx * 0.86, 0.62, 1.06);
      dino.headPivot.add(glowEye);

      const fang = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.36, 6),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
      );
      fang.position.set(sx * 0.46, -0.42, 1.62);
      fang.rotation.x = Math.PI;
      dino.headPivot.add(fang);
    }
    const headCrest = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 8), redSpikeMat);
    headCrest.position.set(0, 1.24, 0.32);
    headCrest.rotation.x = -0.3;
    dino.headPivot.add(headCrest);
  }

  return {
    root,
    dinoBodyPivot,
    dinoLeftLeg: dino.leftLeg,
    dinoRightLeg: dino.rightLeg,
    dinoHeadPivot: dino.headPivot,
  };
}

/** 맵4(수영장맵): 1등 물벼락 거대 트랩 (워터파크 초대형 덤프 양동이 + 물줄기 폭포) */
export function createGiantPoolSplashTrap(): {
  root: THREE.Group;
  bucketPivot: THREE.Group;
  splashJetGroup: THREE.Group;
} {
  const root = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28 });
  const cyanMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.24 });
  const deepCyanMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.25 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff5fa2, roughness: 0.25 });

  // 상단 워터파크 프레임 & 회전 축
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.32, 0.36), whiteMat);
  crossbar.position.set(0, 2.15, 0);
  crossbar.castShadow = true;
  root.add(crossbar);

  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.35, 0.28), deepCyanMat);
    strut.position.set(sx * 1.72, 1.5, 0);
    root.add(strut);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), pinkMat);
    cap.position.set(sx * 1.9, 0.85, 0);
    root.add(cap);
  }

  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.8, 12), yellowMat);
  axle.rotation.z = Math.PI * 0.5;
  axle.position.set(0, 0.85, 0);
  root.add(axle);

  const topBuoy = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 10, 20), pinkMat);
  topBuoy.position.set(0, 2.55, 0);
  root.add(topBuoy);

  // 덤프 버킷 피벗 (앞/뒤로 뒤집히며 물벼락 투하!)
  const bucketPivot = new THREE.Group();
  bucketPivot.position.set(0, 0.85, 0);
  root.add(bucketPivot);

  const bucketBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.04, 2.2, 22, 1, false),
    cyanMat
  );
  bucketBody.position.set(0, 0.15, 0);
  bucketBody.castShadow = true;
  bucketPivot.add(bucketBody);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.14, 10, 24), whiteMat);
  rim.rotation.x = Math.PI * 0.5;
  rim.position.set(0, 1.24, 0);
  bucketPivot.add(rim);

  const stripeYellow = new THREE.Mesh(
    new THREE.CylinderGeometry(1.33, 1.23, 0.42, 22),
    yellowMat
  );
  stripeYellow.position.set(0, 0.26, 0);
  bucketPivot.add(stripeYellow);

  const stripePink = new THREE.Mesh(
    new THREE.CylinderGeometry(1.21, 1.13, 0.22, 22),
    pinkMat
  );
  stripePink.position.set(0, -0.14, 0);
  bucketPivot.add(stripePink);

  const waterPool = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 22),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.28,
      roughness: 0.12,
    })
  );
  waterPool.rotation.x = -Math.PI * 0.5;
  waterPool.position.set(0, 1.18, 0);
  bucketPivot.add(waterPool);

  const foamMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.2 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.92 : 0.45;
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), foamMat);
    bubble.position.set(Math.cos(a) * r, 1.28, Math.sin(a) * r);
    bucketPivot.add(bubble);
  }

  // 쏟아지는 거대 물줄기 & 물방울 그룹 (IMPACT 시 분사!)
  const splashJetGroup = new THREE.Group();
  splashJetGroup.position.set(0, 0.35, 0);
  splashJetGroup.visible = false;
  root.add(splashJetGroup);

  const coreJet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 1.38, 4.1, 16),
    new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    })
  );
  coreJet.position.set(0, -2.05, 0);
  splashJetGroup.add(coreJet);

  const outerCone = new THREE.Mesh(
    new THREE.ConeGeometry(2.15, 4.3, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  outerCone.position.set(0, -2.15, 0);
  splashJetGroup.add(outerCone);

  const splashCrown = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.24, 10, 22),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    })
  );
  splashCrown.rotation.x = Math.PI * 0.5;
  splashCrown.position.set(0, -3.95, 0);
  splashJetGroup.add(splashCrown);

  const dropMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.12,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.25,
  });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rad = 1.15 + (i % 3) * 0.45;
    const dy = -1.9 - (i % 4) * 0.68;
    const droplet = new THREE.Mesh(
      new THREE.SphereGeometry(0.28 + (i % 2) * 0.12, 10, 8),
      i % 2 === 0 ? dropMat : foamMat
    );
    droplet.position.set(Math.cos(a) * rad, dy, Math.sin(a) * rad);
    splashJetGroup.add(droplet);
  }

  return { root, bucketPivot, splashJetGroup };
}

/** 맵5(폴가이즈맵): 1등 대형 펀치 거대 트랩 (스프링 복싱 글러브!) */
export function createGiantFallguysPunchTrap(): {
  root: THREE.Group;
  springGroup: THREE.Group;
  gloveGroup: THREE.Group;
} {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';

  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.22,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
  });
  const mintMat = new THREE.MeshStandardMaterial({ color: 0x6fe7c8, roughness: 0.28 });
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xffe066,
    roughness: 0.22,
    emissive: 0xfacc15,
    emissiveIntensity: 0.18,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.65,
  });
  const pinkGloveMat = new THREE.MeshPhysicalMaterial({
    color: 0xff4fa3,
    roughness: 0.16,
    clearcoat: 0.95,
    clearcoatRoughness: 0.1,
  });

  // 후방 런처 드럼 (뒤쪽/측면에서 모두 선명히 보이는 민트/화이트/옐로우 부스터!)
  const mountDrum = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.26, 0.58, 20), whiteMat);
  mountDrum.rotation.x = Math.PI * 0.5;
  mountDrum.position.set(0, 0, 1.45);
  mountDrum.castShadow = true;
  root.add(mountDrum);

  const mountRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.15, 10, 22), yellowMat);
  mountRing.position.set(0, 0, 1.2);
  root.add(mountRing);

  const rearCap = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.98, 0.3, 18), mintMat);
  rearCap.rotation.x = Math.PI * 0.5;
  rearCap.position.set(0, 0, 1.8);
  root.add(rearCap);

  // 압축/발사되는 스프링 코일 그룹 (고정 앵커 z=+1.25에서 -Z 방향으로 신축)
  const springGroup = new THREE.Group();
  springGroup.position.set(0, 0, 1.25);
  root.add(springGroup);

  const guideRod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 12), chromeMat);
  guideRod.rotation.x = Math.PI * 0.5;
  guideRod.position.set(0, 0, -0.55);
  springGroup.add(guideRod);

  for (let i = 0; i < 6; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.13, 10, 18), yellowMat);
    coil.position.set(0, 0, -0.12 - i * 0.18);
    springGroup.add(coil);
  }

  // 글로시 핫핑크 복싱 글러브 (스프링 왜곡을 막기 위해 별도 형제 그룹으로 구성)
  const gloveGroup = new THREE.Group();
  gloveGroup.position.set(0, 0, 0.1);
  root.add(gloveGroup);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.68, 0.58, 20), whiteMat);
  cuff.rotation.x = Math.PI * 0.5;
  cuff.position.set(0, 0, 0.42);
  cuff.castShadow = true;
  gloveGroup.add(cuff);

  const cuffBand = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.18, 20), mintMat);
  cuffBand.rotation.x = Math.PI * 0.5;
  cuffBand.position.set(0, 0, 0.36);
  gloveGroup.add(cuffBand);

  const fistBody = new THREE.Mesh(new THREE.SphereGeometry(1.16, 24, 18), pinkGloveMat);
  fistBody.scale.set(1.05, 0.96, 1.24);
  fistBody.position.set(0, 0, -0.45);
  fistBody.castShadow = true;
  gloveGroup.add(fistBody);

  const knucklePad = new THREE.Mesh(new THREE.SphereGeometry(0.84, 18, 14), pinkGloveMat);
  knucklePad.scale.set(1.12, 0.78, 0.58);
  knucklePad.position.set(0, 0.08, -1.28);
  knucklePad.castShadow = true;
  gloveGroup.add(knucklePad);

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.48, 8, 14), pinkGloveMat);
  thumb.position.set(-0.96, -0.22, -0.18);
  thumb.rotation.set(Math.PI * 0.5 - 0.35, 0, -0.35);
  thumb.castShadow = true;
  gloveGroup.add(thumb);

  const starCrestTop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 5), yellowMat);
  starCrestTop.position.set(0, 0.96, -0.36);
  gloveGroup.add(starCrestTop);

  return { root, springGroup, gloveGroup };
}

/** 맵2(태권도장맵): 1등 딱밤 거대 손 트랩 */
export function createGiantFingerHand(): {
  root: THREE.Group;
  middleFingerPivot: THREE.Group;
} {
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffccb3,
    roughness: 0.42,
    metalness: 0.02,
  });
  const skinAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf4a88c,
    roughness: 0.48,
  });
  const nailMat = new THREE.MeshStandardMaterial({
    color: 0xfff5f5,
    roughness: 0.18,
    metalness: 0.05,
  });
  const cuffRedMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.4,
  });
  const cuffWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

  const root = new THREE.Group();

  // Forearm & Wristband (descending from above)
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 2.2, 16), skinMat);
  forearm.position.set(0, 2.55, 0.1);
  forearm.castShadow = true;
  root.add(forearm);

  const cuffRed = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.62, 18), cuffRedMat);
  cuffRed.position.set(0, 1.5, 0.1);
  root.add(cuffRed);

  const cuffStripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.86, 0.2, 18),
    cuffWhiteMat
  );
  cuffStripe.position.set(0, 1.5, 0.1);
  root.add(cuffStripe);

  // Chunky Cartoon Palm
  const palm = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.0, 0.82), skinMat);
  palm.position.set(0, 0.1, 0);
  palm.castShadow = true;
  root.add(palm);

  const knucklePad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 2.15, 14),
    skinMat
  );
  knucklePad.rotation.z = Math.PI * 0.5;
  knucklePad.position.set(0, -0.88, 0);
  root.add(knucklePad);

  // Thumb bracing on +Z palm side for the middle-finger cocking pose
  const thumbPivot = new THREE.Group();
  thumbPivot.position.set(-0.98, -0.05, 0.34);
  thumbPivot.rotation.set(0.35, 0.25, 0.78);
  const thumbSeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.82, 8, 12), skinMat);
  thumbSeg.position.set(0.1, -0.5, 0.22);
  thumbPivot.add(thumbSeg);
  const thumbNail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.1), nailMat);
  thumbNail.position.set(0.1, -0.86, -0.04);
  thumbPivot.add(thumbNail);
  root.add(thumbPivot);

  // Curled Index, Ring, and Pinky fingers tucked neatly into the +Z palm
  const curledConfigs = [
    { x: -0.62, scale: 0.92 }, // Index
    { x: 0.58, scale: 0.9 }, // Ring
    { x: 1.0, scale: 0.76 }, // Pinky
  ];
  for (const cfg of curledConfigs) {
    const finger = new THREE.Group();
    finger.position.set(cfg.x, -0.9, 0.08);
    finger.rotation.x = -1.35;
    const seg1 = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.24 * cfg.scale, 0.65 * cfg.scale, 6, 10),
      skinAccentMat
    );
    seg1.position.set(0, -0.45 * cfg.scale, 0);
    finger.add(seg1);
    const seg2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22 * cfg.scale, 0.55 * cfg.scale, 6, 10),
      skinMat
    );
    seg2.position.set(0, -0.78 * cfg.scale, 0.38 * cfg.scale);
    seg2.rotation.x = -1.0;
    finger.add(seg2);
    root.add(finger);
  }

  // Giant Articulated Middle Finger (딱밤 striking finger!)
  const middleFingerPivot = new THREE.Group();
  middleFingerPivot.position.set(-0.02, -0.9, 0);

  const midBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.98, 8, 14), skinMat);
  midBase.position.set(0, -0.58, 0);
  midBase.castShadow = true;
  middleFingerPivot.add(midBase);

  const midTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.85, 8, 14), skinMat);
  midTip.position.set(0, -1.42, -0.04);
  midTip.castShadow = true;
  middleFingerPivot.add(midTip);

  // Bright white cartoon fingernail on -Z face (the flicking impact surface!)
  const midNail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.14), nailMat);
  midNail.position.set(0, -1.66, -0.32);
  middleFingerPivot.add(midNail);

  root.add(middleFingerPivot);

  return { root, middleFingerPivot };
}
