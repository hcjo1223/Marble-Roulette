import * as THREE from 'three';
import type { MapTheme, RacerState } from '../types';

export type FaceMode = 'NORMAL' | 'DIZZY' | 'WINNER';
export type RacerBuffState = 'NONE' | 'SLOW' | 'TURBO' | 'TUBE';

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

interface SharedRacerResources {
  boxTorso: THREE.BoxGeometry;
  boxHead: THREE.BoxGeometry;
  boxArm: THREE.BoxGeometry;
  boxLeg: THREE.BoxGeometry;
  selectionRing: THREE.RingGeometry;
  beanTorsoHi: THREE.CapsuleGeometry;
  beanTorsoLo: THREE.CapsuleGeometry;
  beanHeadHi: THREE.SphereGeometry;
  beanHeadLo: THREE.SphereGeometry;
  beanBelly: THREE.SphereGeometry;
  beanShine: THREE.SphereGeometry;
  beanFacePlane: THREE.PlaneGeometry;
  beanArmHi: THREE.CapsuleGeometry;
  beanArmLo: THREE.CapsuleGeometry;
  beanLegHi: THREE.CapsuleGeometry;
  beanLegLo: THREE.CapsuleGeometry;
  poolWaistTube: THREE.TorusGeometry;
  poolWaistRing: THREE.TorusGeometry;
  poolCap: THREE.SphereGeometry;
  poolStrap: THREE.BoxGeometry;
  poolLens: THREE.BoxGeometry;
  rideTubeTorus: THREE.TorusGeometry;
  rideTubeStripe: THREE.TorusGeometry;
  rideTubeDuckHead: THREE.SphereGeometry;
  rideTubeDuckBeak: THREE.ConeGeometry;
  skinMat: THREE.MeshStandardMaterial;
  whiteMat: THREE.MeshStandardMaterial;
  darkMat: THREE.MeshStandardMaterial;
  shineMat: THREE.MeshBasicMaterial;
  lensMat: THREE.MeshStandardMaterial;
  goldMat: THREE.MeshStandardMaterial;
  tireMat: THREE.MeshStandardMaterial;
  hubMat: THREE.MeshStandardMaterial;
  metalMat: THREE.MeshStandardMaterial;
  hatMat: THREE.MeshStandardMaterial;
}

let shared: SharedRacerResources | null = null;

function getShared(): SharedRacerResources {
  if (shared) return shared;
  const selectionRing = new THREE.RingGeometry(0.55, 0.78, 18);
  selectionRing.rotateX(-Math.PI / 2);

  shared = {
    boxTorso: new THREE.BoxGeometry(0.76, 0.84, 0.42),
    boxHead: new THREE.BoxGeometry(0.54, 0.54, 0.54),
    boxArm: new THREE.BoxGeometry(0.3, 0.74, 0.3),
    boxLeg: new THREE.BoxGeometry(0.33, 0.72, 0.33),
    selectionRing,
    beanTorsoHi: new THREE.CapsuleGeometry(0.42, 0.22, 8, 18),
    beanTorsoLo: new THREE.CapsuleGeometry(0.42, 0.22, 4, 10),
    beanHeadHi: new THREE.SphereGeometry(0.36, 18, 14),
    beanHeadLo: new THREE.SphereGeometry(0.36, 12, 10),
    beanBelly: new THREE.SphereGeometry(0.26, 12, 10),
    beanShine: new THREE.SphereGeometry(0.075, 8, 6),
    beanFacePlane: new THREE.PlaneGeometry(0.42, 0.42),
    beanArmHi: new THREE.CapsuleGeometry(0.14, 0.4, 5, 12),
    beanArmLo: new THREE.CapsuleGeometry(0.14, 0.4, 4, 8),
    beanLegHi: new THREE.CapsuleGeometry(0.16, 0.36, 5, 12),
    beanLegLo: new THREE.CapsuleGeometry(0.16, 0.36, 4, 8),
    poolWaistTube: new THREE.TorusGeometry(0.64, 0.17, 8, 16),
    poolWaistRing: new THREE.TorusGeometry(0.64, 0.055, 6, 16),
    poolCap: new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    poolStrap: new THREE.BoxGeometry(0.58, 0.1, 0.58),
    poolLens: new THREE.BoxGeometry(0.19, 0.13, 0.05),
    rideTubeTorus: new THREE.TorusGeometry(0.92, 0.3, 10, 20),
    rideTubeStripe: new THREE.TorusGeometry(0.92, 0.09, 6, 20),
    rideTubeDuckHead: new THREE.SphereGeometry(0.24, 10, 8),
    rideTubeDuckBeak: new THREE.ConeGeometry(0.1, 0.22, 8),
    skinMat: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fde047'),
      roughness: 0.35,
      metalness: 0.05,
    }),
    whiteMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32 }),
    darkMat: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }),
    shineMat: new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      toneMapped: false,
    }),
    lensMat: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.35,
      transparent: true,
      opacity: 0.9,
    }),
    goldMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 }),
    tireMat: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 }),
    hubMat: new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.25,
      metalness: 0.4,
    }),
    metalMat: new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.3,
      metalness: 0.6,
    }),
    hatMat: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 }),
  };
  return shared;
}

export function createRideTubeAttachment(colorHex: number = 0xff5fa2): THREE.Group {
  const s = getShared();
  const group = new THREE.Group();

  const tubeMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.25,
    metalness: 0.08,
    emissive: colorHex,
    emissiveIntensity: 0.16,
  });
  const torus = new THREE.Mesh(s.rideTubeTorus, tubeMat);
  torus.rotation.x = Math.PI / 2;
  group.add(torus);

  const stripe = new THREE.Mesh(s.rideTubeStripe, s.whiteMat);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 0.24;
  group.add(stripe);

  // Cute front float figurehead (duck/flamingo head) facing +Z
  const neckHead = new THREE.Mesh(s.rideTubeDuckHead, tubeMat);
  neckHead.position.set(0, 0.36, 0.92);
  group.add(neckHead);

  const beak = new THREE.Mesh(s.rideTubeDuckBeak, s.goldMat);
  beak.rotation.x = Math.PI * 0.5;
  beak.position.set(0, 0.34, 1.18);
  group.add(beak);

  group.position.set(0, -0.32, 0.04);
  return group;
}

export function drawRacerFaceTexture(
  ctx: CanvasRenderingContext2D,
  faceTexture: THREE.CanvasTexture,
  mode: FaceMode,
  isJellybean: boolean
): void {
  if (isJellybean) {
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

    ctx.beginPath();
    ctx.arc(42, 54, 8.5, 0, Math.PI * 2);
    ctx.arc(86, 54, 8.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(44, 51, 3, 0, Math.PI * 2);
    ctx.arc(88, 51, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.beginPath();
    ctx.ellipse(26, 68, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.ellipse(102, 68, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(64, 72, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (mode === 'DIZZY') {
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

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(64, 86, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    if (isJellybean) {
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
  const isTube = buffState === 'TUBE';
  const isHighlight = isTargetRankCandidate;

  const statusIcon =
    state === 'RAGDOLL'
      ? ' 💫'
      : state === 'FINISHED'
      ? ' 👑'
      : isTube
      ? ' 🛟'
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
    : isTube
    ? '#cffafe'
    : isSlow
    ? '#fef3c7'
    : isTurbo
    ? '#ffedd5'
    : isHighlight
    ? '#fef08a'
    : '#ffffff';
  ctx.strokeStyle = isHit
    ? '#dc2626'
    : isTube
    ? '#0891b2'
    : isSlow
    ? '#854d0e'
    : isTurbo
    ? '#ea580c'
    : isHighlight
    ? '#d97706'
    : '#0f172a';
  ctx.lineWidth = isHighlight || isSlow || isTurbo || isTube ? 7 : 6;

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
  accentColor: string,
  lowCost: boolean
): { kartWheels: THREE.Mesh[]; kartFlameMesh: THREE.Mesh } {
  const s = getShared();
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

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.28, 1.72), bodyMat);
  chassis.position.set(0, -0.58, 0.08);
  chassis.castShadow = !lowCost;
  torsoMesh.add(chassis);

  const sidePodL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 1.05), accentMat);
  sidePodL.position.set(-0.62, -0.54, 0.04);
  const sidePodR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 1.05), accentMat);
  sidePodR.position.set(0.62, -0.54, 0.04);
  const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.9), s.goldMat);
  hoodStripe.position.set(0, -0.56, 0.56);
  torsoMesh.add(sidePodL, sidePodR, hoodStripe);

  const frontNose = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.22, 0.42), s.goldMat);
  frontNose.position.set(0, -0.58, 1.02);
  torsoMesh.add(frontNose);

  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.44, 0.16), s.darkMat);
  seatBack.position.set(0, -0.32, -0.34);
  torsoMesh.add(seatBack);

  for (const sx of [-0.42, 0.42]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.12), s.darkMat);
    strut.position.set(sx, -0.34, -0.76);
    torsoMesh.add(strut);
  }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.1, 0.34), accentMat);
  wing.position.set(0, -0.15, -0.78);
  torsoMesh.add(wing);

  for (const ex of [-0.28, 0.28]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.36, 8), s.metalMat);
    pipe.rotation.x = Math.PI * 0.44;
    pipe.position.set(ex, -0.45, -0.84);
    torsoMesh.add(pipe);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.9, 8),
    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.92 })
  );
  flame.rotation.x = -Math.PI * 0.5;
  flame.position.set(0, -0.46, -1.38);
  flame.visible = false;
  torsoMesh.add(flame);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.54, 6), s.darkMat);
  column.rotation.x = 0.52;
  column.position.set(0, -0.24, 0.46);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 6, 12), s.darkMat);
  wheel.rotation.x = 0.52;
  wheel.position.set(0, 0.0, 0.36);
  torsoMesh.add(column, wheel);

  const tireGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.24, 10);
  const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.26, 8);
  const wheelPositions: [number, number, number][] = [
    [-0.66, -0.76, 0.62],
    [0.66, -0.76, 0.62],
    [-0.68, -0.76, -0.56],
    [0.68, -0.76, -0.56],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const tire = new THREE.Mesh(tireGeo, s.tireMat);
    tire.rotation.z = Math.PI * 0.5;
    tire.position.set(wx, wy, wz);
    const hub = new THREE.Mesh(hubGeo, s.hubMat);
    tire.add(hub);
    torsoMesh.add(tire);
    kartWheels.push(tire);
  }

  return { kartWheels, kartFlameMesh: flame };
}

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
  faceTexture: THREE.CanvasTexture,
  lowCost: boolean
): void {
  const s = getShared();
  const beanMain = new THREE.Color(color);
  const beanSoft = beanMain.clone().lerp(new THREE.Color('#ffffff'), 0.16);
  const beanLimb = beanMain
    .clone()
    .lerp(new THREE.Color('#ffffff'), 0.1)
    .multiplyScalar(0.98);

  const beanBodyMat: THREE.Material = lowCost
    ? new THREE.MeshStandardMaterial({
        color: beanMain,
        roughness: 0.22,
        metalness: 0.06,
        emissive: beanMain.clone().multiplyScalar(0.14),
        emissiveIntensity: 0.5,
      })
    : new THREE.MeshPhysicalMaterial({
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

  const beanSoftMat: THREE.Material = lowCost
    ? new THREE.MeshStandardMaterial({
        color: beanSoft,
        roughness: 0.25,
        emissive: beanSoft.clone().multiplyScalar(0.16),
        emissiveIntensity: 0.5,
      })
    : new THREE.MeshPhysicalMaterial({
        color: beanSoft,
        roughness: 0.2,
        metalness: 0.0,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1,
        emissive: beanSoft.clone().multiplyScalar(0.2),
        emissiveIntensity: 0.6,
      });

  const beanLimbMat: THREE.Material = lowCost
    ? new THREE.MeshStandardMaterial({
        color: beanLimb,
        roughness: 0.26,
        emissive: beanLimb.clone().multiplyScalar(0.12),
        emissiveIntensity: 0.45,
      })
    : new THREE.MeshPhysicalMaterial({
        color: beanLimb,
        roughness: 0.22,
        metalness: 0.0,
        clearcoat: 0.8,
        clearcoatRoughness: 0.14,
        emissive: beanLimb.clone().multiplyScalar(0.14),
        emissiveIntensity: 0.5,
      });

  meshes.torsoMesh.clear();
  meshes.torsoMesh.geometry = lowCost ? s.beanTorsoLo : s.beanTorsoHi;
  meshes.torsoMesh.material = beanBodyMat;

  const belly = new THREE.Mesh(s.beanBelly, beanSoftMat);
  belly.position.set(0, -0.08, 0.28);
  belly.scale.set(1.0, 1.15, 0.5);
  meshes.torsoMesh.add(belly);

  if (!lowCost) {
    const shine = new THREE.Mesh(s.beanShine, s.shineMat);
    shine.position.set(-0.17, 0.2, 0.34);
    shine.scale.set(1.0, 1.3, 0.4);
    meshes.torsoMesh.add(shine);
  }

  meshes.headMesh.clear();
  meshes.headMesh.geometry = lowCost ? s.beanHeadLo : s.beanHeadHi;
  meshes.headMesh.material = beanBodyMat;
  meshes.headMesh.scale.set(1.0, 1.04, 0.98);
  meshes.headMesh.castShadow = !lowCost;

  const facePlane = new THREE.Mesh(
    s.beanFacePlane,
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

  const armGeo = lowCost ? s.beanArmLo : s.beanArmHi;
  const legGeo = lowCost ? s.beanLegLo : s.beanLegHi;
  for (const arm of [meshes.leftArmMesh, meshes.rightArmMesh]) {
    arm.geometry = armGeo;
    arm.material = beanLimbMat;
    arm.castShadow = !lowCost;
  }
  for (const leg of [meshes.leftLegMesh, meshes.rightLegMesh]) {
    leg.geometry = legGeo;
    leg.material = beanLimbMat;
    leg.castShadow = !lowCost;
  }
}

export function createRacerVisuals(
  scene: THREE.Scene,
  color: string,
  accentColor: string,
  mapTheme: MapTheme,
  lowCost: boolean = false
): RacerVisualsBundle {
  const s = getShared();
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
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.35,
    metalness: 0.05,
  });

  const torsoMesh = new THREE.Mesh(s.boxTorso, torsoMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = !lowCost;

  if (!isJellybean) {
    if (isTaekwondo) {
      const collarV = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.44), s.darkMat);
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
      const chestBadge = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.44), s.whiteMat);
      chestBadge.position.set(0, 0.12, 0);
      torsoMesh.add(chestBadge);
    }
  }

  let kartWheels: THREE.Mesh[] = [];
  let kartFlameMesh: THREE.Mesh | null = null;
  if (isDinosaur) {
    const builtKart = buildKartVehicleOnTorso(torsoMesh, color, accentColor, lowCost);
    kartWheels = builtKart.kartWheels;
    kartFlameMesh = builtKart.kartFlameMesh;
  }

  if (isPool) {
    const tubeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.32,
      metalness: 0.08,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.12,
    });
    const tube = new THREE.Mesh(s.poolWaistTube, tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.06, 0);
    tube.castShadow = !lowCost;
    torsoMesh.add(tube);

    const ring = new THREE.Mesh(s.poolWaistRing, s.whiteMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.06, 0);
    torsoMesh.add(ring);
  }

  const headMats = [s.skinMat, s.skinMat, s.skinMat, s.skinMat, faceMat, s.skinMat];
  const headMesh = new THREE.Mesh(s.boxHead, headMats);
  headMesh.castShadow = !lowCost;

  if (!isJellybean) {
    if (isTaekwondo) {
      const headband = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.12, 0.58),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.3 })
      );
      headband.position.set(0, 0.14, 0);
      headMesh.add(headband);
    } else if (isDinosaur) {
      const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.07, 0.76), s.hatMat);
      hatBrim.position.set(0, 0.27, 0);
      const hatCrown = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.48), s.hatMat);
      hatCrown.position.set(0, 0.38, 0);
      const hatRibbon = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.07, 0.5),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.3 })
      );
      hatRibbon.position.set(0, 0.33, 0);
      headMesh.add(hatBrim, hatCrown, hatRibbon);
    } else if (isPool) {
      const cap = new THREE.Mesh(
        s.poolCap,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness: 0.28,
          metalness: 0.06,
        })
      );
      cap.position.y = 0.06;
      cap.scale.set(1.02, 0.85, 1.02);
      headMesh.add(cap);

      const strap = new THREE.Mesh(s.poolStrap, s.darkMat);
      strap.position.y = 0.02;
      headMesh.add(strap);

      for (const side of [-1, 1]) {
        const lens = new THREE.Mesh(s.poolLens, s.lensMat);
        lens.position.set(side * 0.14, 0.04, 0.28);
        headMesh.add(lens);
      }
    }
  }

  const leftArmMesh = new THREE.Mesh(s.boxArm, isTaekwondo ? torsoMat : s.skinMat);
  const rightArmMesh = new THREE.Mesh(s.boxArm, isTaekwondo ? torsoMat : s.skinMat);
  leftArmMesh.castShadow = !lowCost;
  rightArmMesh.castShadow = !lowCost;

  const leftLegMesh = new THREE.Mesh(s.boxLeg, limbMat);
  const rightLegMesh = new THREE.Mesh(s.boxLeg, limbMat);
  leftLegMesh.castShadow = !lowCost;
  rightLegMesh.castShadow = !lowCost;

  if (isJellybean) {
    applyJellybeanSkin(
      { torsoMesh, headMesh, leftArmMesh, rightArmMesh, leftLegMesh, rightLegMesh },
      color,
      faceTexture,
      lowCost
    );
  }

  const selectionRing = new THREE.Mesh(
    s.selectionRing,
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
