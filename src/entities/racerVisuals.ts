import * as THREE from 'three';
import type { MapTheme, RacerState } from '../types';

export type FaceMode = 'NORMAL' | 'DIZZY' | 'WINNER';
export type RacerBuffState = 'NONE' | 'SLOW' | 'TURBO';

export interface RacerVisualsBundle {
  torsoMesh: THREE.Mesh;
  headMesh: THREE.Mesh;
  leftArmMesh: THREE.Mesh;
  rightArmMesh: THREE.Mesh;
  leftLegMesh: THREE.Mesh;
  rightLegMesh: THREE.Mesh;
  selectionRing: THREE.Mesh;
  kartWheels: THREE.Mesh[];
  kartFlameMesh: THREE.Mesh | null;
  faceCtx: CanvasRenderingContext2D;
  faceTexture: THREE.CanvasTexture;
  labelCtx: CanvasRenderingContext2D;
  labelTexture: THREE.CanvasTexture;
  labelSprite: THREE.Sprite;
}

export function drawRacerFaceTexture(
  ctx: CanvasRenderingContext2D,
  faceTexture: THREE.CanvasTexture,
  mode: FaceMode,
  isJellybean: boolean
): void {
  if (isJellybean) {
    // 젤리빈은 몸통 색이 얼굴 색이므로 배경 없이 눈·볼터치만 그린다
    ctx.clearRect(0, 0, 128, 128);
  } else {
    ctx.fillStyle = '#fde047';
    ctx.fillRect(0, 0, 128, 128);
  }

  ctx.strokeStyle = '#1e293b';
  ctx.fillStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  if (mode === 'NORMAL') {
    if (isJellybean) {
      // 동글동글 젤리빈 눈 + 발그레 볼 + 방긋
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(44, 56, 11.5, 14.5, 0, 0, Math.PI * 2);
      ctx.ellipse(84, 56, 11.5, 14.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22303f';
      ctx.beginPath();
      ctx.ellipse(45.5, 58, 6.6, 9.6, 0, 0, Math.PI * 2);
      ctx.ellipse(85.5, 58, 6.6, 9.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(47.5, 53, 2.6, 0, Math.PI * 2);
      ctx.arc(87.5, 53, 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(251, 113, 133, 0.55)';
      ctx.beginPath();
      ctx.ellipse(24, 80, 10, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(104, 80, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#22303f';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.arc(64, 80, 12, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
      faceTexture.needsUpdate = true;
      return;
    }

    // Cute cheerful chibi eyes + rosy cheeks
    ctx.beginPath();
    ctx.arc(42, 54, 8.5, 0, Math.PI * 2);
    ctx.arc(86, 54, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // White eye sparkles
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(44, 51, 3, 0, Math.PI * 2);
    ctx.arc(88, 51, 3, 0, Math.PI * 2);
    ctx.fill();

    // Rosy cheeks
    ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.beginPath();
    ctx.ellipse(26, 68, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.ellipse(102, 68, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Happy smile
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(64, 72, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (mode === 'DIZZY') {
    // X _ X ragdoll knockback face
    ctx.beginPath();
    ctx.moveTo(32, 42);
    ctx.lineTo(52, 62);
    ctx.moveTo(52, 42);
    ctx.lineTo(32, 62);
    ctx.moveTo(76, 42);
    ctx.lineTo(96, 62);
    ctx.moveTo(96, 42);
    ctx.lineTo(76, 62);
    ctx.stroke();

    // Open shocked mouth
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(64, 86, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    if (isJellybean) {
      // 반짝반짝 별 눈 + 함박웃음
      ctx.fillStyle = '#f59e0b';
      ctx.font = '900 34px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 44, 56);
      ctx.fillText('★', 84, 56);

      ctx.fillStyle = 'rgba(251, 113, 133, 0.55)';
      ctx.beginPath();
      ctx.ellipse(24, 80, 10, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(104, 80, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#22303f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(64, 74, 18, 0.08 * Math.PI, 0.92 * Math.PI);
      ctx.stroke();
      faceTexture.needsUpdate = true;
      return;
    }

    // Cool sunglasses / star winner face
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(24, 40, 34, 22);
    ctx.fillRect(70, 40, 34, 22);
    ctx.fillRect(58, 45, 12, 6);

    ctx.beginPath();
    ctx.arc(64, 78, 22, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  faceTexture.needsUpdate = true;
}

export function drawRacerBillboardLabel(
  ctx: CanvasRenderingContext2D,
  labelTexture: THREE.CanvasTexture,
  params: {
    name: string;
    color: string;
    rank: number;
    state: RacerState;
    isTargetRankCandidate: boolean;
    buffState: RacerBuffState;
  }
): void {
  const { name, color, rank, state, isTargetRankCandidate, buffState } = params;
  ctx.clearRect(0, 0, 440, 120);

  const isHit = state === 'RAGDOLL';
  const isSlow = buffState === 'SLOW';
  const isTurbo = buffState === 'TURBO';
  const isHighlight = isTargetRankCandidate;

  const statusIcon =
    state === 'RAGDOLL'
      ? ' 💫'
      : state === 'FINISHED'
      ? ' 👑'
      : isSlow
      ? ' 💩'
      : isTurbo
      ? ' ⚡'
      : isHighlight
      ? ' 🎯'
      : '';
  const displayText = (name.length > 8 ? name.slice(0, 8) + '…' : name) + statusIcon;

  let fontSize = 44;
  ctx.font = `900 ${fontSize}px "Plus Jakarta Sans", "Pretendard", sans-serif`;
  const maxTextWidth = 286;
  let textWidth = ctx.measureText(displayText).width;
  while (fontSize > 28 && textWidth > maxTextWidth) {
    fontSize -= 2;
    ctx.font = `900 ${fontSize}px "Plus Jakarta Sans", "Pretendard", sans-serif`;
    textWidth = ctx.measureText(displayText).width;
  }

  const badgeW = 78;
  const rw = Math.min(424, Math.max(206, 26 + badgeW + textWidth + 24));
  const rh = 94;
  const rx = (440 - rw) * 0.5;
  const ry = 13;
  const radius = 44;

  ctx.fillStyle = isHit
    ? '#fee2e2'
    : isSlow
    ? '#fef3c7'
    : isTurbo
    ? '#ffedd5'
    : isHighlight
    ? '#fef08a'
    : '#ffffff';
  ctx.strokeStyle = isHit
    ? '#dc2626'
    : isSlow
    ? '#854d0e'
    : isTurbo
    ? '#ea580c'
    : isHighlight
    ? '#d97706'
    : '#0f172a';
  ctx.lineWidth = isHighlight || isSlow || isTurbo ? 7 : 6;

  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, radius);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(rx + 10, ry + 10, badgeW, 74, 34);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 34px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`#${rank}`, rx + 10 + badgeW * 0.5, ry + 48);

  ctx.fillStyle = '#0f172a';
  ctx.font = `900 ${fontSize}px "Plus Jakarta Sans", "Pretendard", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayText, rx + 10 + badgeW + 12, ry + 48);

  labelTexture.needsUpdate = true;
}

function buildKartVehicleOnTorso(
  torsoMesh: THREE.Mesh,
  color: string,
  accentColor: string
): { kartWheels: THREE.Mesh[]; kartFlameMesh: THREE.Mesh } {
  const kartWheels: THREE.Mesh[] = [];
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.28,
    metalness: 0.18,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentColor),
    roughness: 0.35,
  });
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    roughness: 0.25,
    metalness: 0.4,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.6,
  });

  // Main racing kart chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.28, 1.72), bodyMat);
  chassis.position.set(0, -0.58, 0.08);
  chassis.castShadow = true;
  torsoMesh.add(chassis);

  // Side pods & white/gold racing stripe
  const sidePodL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 1.05), accentMat);
  sidePodL.position.set(-0.62, -0.54, 0.04);
  const sidePodR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 1.05), accentMat);
  sidePodR.position.set(0.62, -0.54, 0.04);
  const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.9), bumperMat);
  hoodStripe.position.set(0, -0.56, 0.56);
  torsoMesh.add(sidePodL, sidePodR, hoodStripe);

  // Front racing bumper
  const frontNose = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.22, 0.42), bumperMat);
  frontNose.position.set(0, -0.58, 1.02);
  frontNose.castShadow = true;
  torsoMesh.add(frontNose);

  // Seat back cushion behind torso
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.44, 0.16), seatMat);
  seatBack.position.set(0, -0.32, -0.34);
  torsoMesh.add(seatBack);

  // Rear spoiler wing on twin struts
  for (const sx of [-0.42, 0.42]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.12), seatMat);
    strut.position.set(sx, -0.34, -0.76);
    torsoMesh.add(strut);
  }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.1, 0.34), accentMat);
  wing.position.set(0, -0.15, -0.78);
  wing.castShadow = true;
  torsoMesh.add(wing);

  // Twin chrome exhaust pipes + turbo flame cone (visible during turbo!)
  for (const ex of [-0.28, 0.28]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.36, 10), metalMat);
    pipe.rotation.x = Math.PI * 0.44;
    pipe.position.set(ex, -0.45, -0.84);
    torsoMesh.add(pipe);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.9, 10),
    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.92 })
  );
  flame.rotation.x = -Math.PI * 0.5;
  flame.position.set(0, -0.46, -1.38);
  flame.visible = false;
  torsoMesh.add(flame);

  // Steering column & wheel in front of driver
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.54, 8), seatMat);
  column.rotation.x = 0.52;
  column.position.set(0, -0.24, 0.46);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 16), seatMat);
  wheel.rotation.x = 0.52;
  wheel.position.set(0, 0.0, 0.36);
  torsoMesh.add(column, wheel);

  // 4 Knobby Racing Tires with bright hubcaps
  const wheelPositions: [number, number, number][] = [
    [-0.66, -0.76, 0.62],
    [0.66, -0.76, 0.62],
    [-0.68, -0.76, -0.56],
    [0.68, -0.76, -0.56],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.24, 14), tireMat);
    tire.rotation.z = Math.PI * 0.5;
    tire.position.set(wx, wy, wz);
    tire.castShadow = true;

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 10), hubMat);
    tire.add(hub);

    torsoMesh.add(tire);
    kartWheels.push(tire);
  }

  return { kartWheels, kartFlameMesh: flame };
}

/**
 * 폴가이즈 젤리빈 스킨: 기존 R6 박스 파츠 메쉬만 통통한 캡슐·구체로 갈아끼운다.
 * Rapier 물리 바디/조인트/충돌체는 건드리지 않아 기존 주행·래그돌 안정성이 그대로 유지된다.
 */
function applyJellybeanSkin(
  meshes: {
    torsoMesh: THREE.Mesh;
    headMesh: THREE.Mesh;
    leftArmMesh: THREE.Mesh;
    rightArmMesh: THREE.Mesh;
    leftLegMesh: THREE.Mesh;
    rightLegMesh: THREE.Mesh;
  },
  color: string,
  faceTexture: THREE.CanvasTexture
): void {
  const beanMain = new THREE.Color(color);
  const beanSoft = beanMain.clone().lerp(new THREE.Color('#ffffff'), 0.16);
  const beanLimb = beanMain
    .clone()
    .lerp(new THREE.Color('#ffffff'), 0.1)
    .multiplyScalar(0.98);

  const beanBodyMat = new THREE.MeshPhysicalMaterial({
    color: beanMain,
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    sheen: 0.4,
    sheenColor: new THREE.Color('#ffffff'),
    emissive: beanMain.clone().multiplyScalar(0.16),
    emissiveIntensity: 0.55,
  });
  const beanSoftMat = new THREE.MeshPhysicalMaterial({
    color: beanSoft,
    roughness: 0.2,
    metalness: 0.0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    emissive: beanSoft.clone().multiplyScalar(0.2),
    emissiveIntensity: 0.6,
  });
  const beanLimbMat = new THREE.MeshPhysicalMaterial({
    color: beanLimb,
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.14,
    emissive: beanLimb.clone().multiplyScalar(0.14),
    emissiveIntensity: 0.5,
  });

  // 통통한 젤리 몸체
  meshes.torsoMesh.clear();
  meshes.torsoMesh.geometry.dispose();
  meshes.torsoMesh.geometry = new THREE.CapsuleGeometry(0.42, 0.22, 10, 22);
  meshes.torsoMesh.material = beanBodyMat;

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), beanSoftMat);
  belly.position.set(0, -0.08, 0.28);
  belly.scale.set(1.0, 1.15, 0.5);
  meshes.torsoMesh.add(belly);

  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 12, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      toneMapped: false,
    })
  );
  shine.position.set(-0.17, 0.2, 0.34);
  shine.scale.set(1.0, 1.3, 0.4);
  meshes.torsoMesh.add(shine);

  // 둥근 머리 + 얼굴 데칼
  meshes.headMesh.clear();
  meshes.headMesh.geometry.dispose();
  meshes.headMesh.geometry = new THREE.SphereGeometry(0.36, 24, 20);
  meshes.headMesh.material = beanBodyMat;
  meshes.headMesh.scale.set(1.0, 1.04, 0.98);

  const facePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({
      map: faceTexture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  );
  facePlane.position.set(0, 0.02, 0.378);
  facePlane.renderOrder = 2;
  meshes.headMesh.add(facePlane);

  // 짧고 통통한 팔·다리
  const armGeo = new THREE.CapsuleGeometry(0.14, 0.4, 6, 16);
  const legGeo = new THREE.CapsuleGeometry(0.16, 0.36, 6, 16);
  for (const arm of [meshes.leftArmMesh, meshes.rightArmMesh]) {
    arm.geometry.dispose();
    arm.geometry = armGeo;
    arm.material = beanLimbMat;
  }
  for (const leg of [meshes.leftLegMesh, meshes.rightLegMesh]) {
    leg.geometry.dispose();
    leg.geometry = legGeo;
    leg.material = beanLimbMat;
  }
}

export function createRacerVisuals(
  scene: THREE.Scene,
  color: string,
  accentColor: string,
  mapTheme: MapTheme
): RacerVisualsBundle {
  const isTaekwondo = mapTheme === 'TAEKWONDO';
  const isDinosaur = mapTheme === 'DINOSAUR';
  const isPool = mapTheme === 'POOL';
  const isJellybean = mapTheme === 'FALLGUYS';

  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 128;
  faceCanvas.height = 128;
  const faceCtx = faceCanvas.getContext('2d')!;
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  drawRacerFaceTexture(faceCtx, faceTexture, 'NORMAL', isJellybean);

  const skinColor = new THREE.Color('#fde047'); // Classic Roblox yellow head/hands
  const torsoMat = new THREE.MeshStandardMaterial({
    color: isTaekwondo ? new THREE.Color('#f8fafc') : new THREE.Color(color),
    roughness: 0.32,
    metalness: 0.05,
  });
  const limbMat = new THREE.MeshStandardMaterial({
    color: isTaekwondo ? new THREE.Color('#f1f5f9') : new THREE.Color(accentColor),
    roughness: 0.4,
    metalness: 0.05,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.35,
    metalness: 0.05,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.35,
    metalness: 0.05,
  });

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.84, 0.42), torsoMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;

  if (isTaekwondo) {
    const collarV = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.26, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
    );
    collarV.position.set(0, 0.24, 0);
    torsoMesh.add(collarV);

    const beltMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.3,
    });
    const waistBelt = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.46), beltMat);
    waistBelt.position.set(0, -0.22, 0);
    torsoMesh.add(waistBelt);

    const beltKnot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.5), beltMat);
    beltKnot.position.set(0, -0.28, 0.02);
    torsoMesh.add(beltKnot);
  } else {
    const chestBadge = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.26, 0.44),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    chestBadge.position.set(0, 0.12, 0);
    torsoMesh.add(chestBadge);
  }

  let kartWheels: THREE.Mesh[] = [];
  let kartFlameMesh: THREE.Mesh | null = null;
  if (isDinosaur) {
    const builtKart = buildKartVehicleOnTorso(torsoMesh, color, accentColor);
    kartWheels = builtKart.kartWheels;
    kartFlameMesh = builtKart.kartFlameMesh;
  }

  if (isPool) {
    // 수영장 맵: 허리에 두른 알록달록 물놀이 튜브
    const tubeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.32,
      metalness: 0.08,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.12,
    });
    const tube = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.17, 10, 22), tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.06, 0);
    tube.castShadow = true;
    torsoMesh.add(tube);

    const tubeStripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    for (let s = 0; s < 4; s++) {
      const a = (s * Math.PI) / 2 + Math.PI / 4;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), tubeStripeMat);
      stripe.position.set(Math.cos(a) * 0.64, 0.02, Math.sin(a) * 0.64);
      torsoMesh.add(stripe);
    }
  }

  // Head mesh (6 materials so +Z front has face)
  const headMats = [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat];
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
  headMesh.castShadow = true;

  if (isTaekwondo) {
    const headband = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.12, 0.58),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.3 })
    );
    headband.position.set(0, 0.14, 0);
    headMesh.add(headband);
  } else if (isDinosaur) {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });
    const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.07, 0.76), hatMat);
    hatBrim.position.set(0, 0.27, 0);
    const hatCrown = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.48), hatMat);
    hatCrown.position.set(0, 0.38, 0);
    const hatRibbon = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.07, 0.5),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.3 })
    );
    hatRibbon.position.set(0, 0.33, 0);
    headMesh.add(hatBrim, hatCrown, hatRibbon);
  } else if (isPool) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.28,
        metalness: 0.06,
      })
    );
    cap.position.y = 0.06;
    cap.scale.set(1.02, 0.85, 1.02);
    headMesh.add(cap);

    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.1, 0.58),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
    );
    strap.position.y = 0.02;
    headMesh.add(strap);

    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.35,
      transparent: true,
      opacity: 0.9,
    });
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.05), lensMat);
      lens.position.set(side * 0.14, 0.04, 0.28);
      headMesh.add(lens);
    }
  }

  // Arms & Legs meshes
  const armGeo = new THREE.BoxGeometry(0.3, 0.74, 0.3);
  const leftArmMesh = new THREE.Mesh(armGeo, isTaekwondo ? torsoMat : skinMat);
  const rightArmMesh = new THREE.Mesh(armGeo, isTaekwondo ? torsoMat : skinMat);
  leftArmMesh.castShadow = true;
  rightArmMesh.castShadow = true;

  const legGeo = new THREE.BoxGeometry(0.33, 0.72, 0.33);
  const leftLegMesh = new THREE.Mesh(legGeo, limbMat);
  const rightLegMesh = new THREE.Mesh(legGeo, limbMat);
  leftLegMesh.castShadow = true;
  rightLegMesh.castShadow = true;

  if (isJellybean) {
    applyJellybeanSkin(
      { torsoMesh, headMesh, leftArmMesh, rightArmMesh, leftLegMesh, rightLegMesh },
      color,
      faceTexture
    );
  }

  const ringGeo = new THREE.RingGeometry(0.55, 0.78, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const selectionRing = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    })
  );
  selectionRing.visible = false;

  scene.add(
    torsoMesh,
    headMesh,
    leftArmMesh,
    rightArmMesh,
    leftLegMesh,
    rightLegMesh,
    selectionRing
  );

  // Billboard Nickname UI Sprite
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 440;
  labelCanvas.height = 120;
  const labelCtx = labelCanvas.getContext('2d')!;
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.minFilter = THREE.LinearFilter;
  labelTexture.magFilter = THREE.LinearFilter;

  const labelSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
      depthTest: false,
      toneMapped: false,
    })
  );
  labelSprite.scale.set(2.45, 0.68, 1);
  labelSprite.renderOrder = 999;
  scene.add(labelSprite);

  return {
    torsoMesh,
    headMesh,
    leftArmMesh,
    rightArmMesh,
    leftLegMesh,
    rightLegMesh,
    selectionRing,
    kartWheels,
    kartFlameMesh,
    faceCtx,
    faceTexture,
    labelCtx,
    labelTexture,
    labelSprite,
  };
}
