import * as THREE from 'three';

export interface BossCharacterParts {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
}

let bossGlbTemplates: Map<string, THREE.Group | null> = new Map();
let bossGlbLoadPromises: Map<string, Promise<THREE.Group | null>> = new Map();

function loadGlbTemplate(glbPath: string): Promise<THREE.Group | null> {
  if (bossGlbTemplates.has(glbPath)) {
    return Promise.resolve(bossGlbTemplates.get(glbPath) ?? null);
  }
  const existingPromise = bossGlbLoadPromises.get(glbPath);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async (): Promise<THREE.Group | null> => {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      const res = await fetch(glbPath);
      if (!res.ok) {
        bossGlbTemplates.set(glbPath, null);
        return null;
      }

      const buffer = await res.arrayBuffer();
      // Guard against SPA/HTML fallback responses when a .glb file has not been added yet
      if (buffer.byteLength < 12) {
        bossGlbTemplates.set(glbPath, null);
        return null;
      }
      const header = new Uint8Array(buffer, 0, 4);
      const isGlbMagic =
        header[0] === 0x67 && // 'g'
        header[1] === 0x6c && // 'l'
        header[2] === 0x54 && // 'T'
        header[3] === 0x46; // 'F'
      if (!isGlbMagic) {
        bossGlbTemplates.set(glbPath, null);
        return null;
      }

      const gltf = await loader.parseAsync(buffer, './models/');
      const model = gltf.scene;
      model.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const srcMat = (
            Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
          ) as THREE.MeshStandardMaterial;
          if (srcMat) {
            if (srcMat.map) {
              srcMat.map.colorSpace = THREE.SRGBColorSpace;
            }
            mesh.material = new THREE.MeshStandardMaterial({
              color: srcMat.map ? new THREE.Color(0xffffff) : srcMat.color ?? 0xffffff,
              map: srcMat.map ?? null,
              normalMap: srcMat.normalMap ?? null,
              normalScale: new THREE.Vector2(0.85, 0.85),
              roughnessMap: srcMat.roughnessMap ?? null,
              roughness: 0.58,
              metalness: 0.08,
              transparent: srcMat.transparent ?? false,
              opacity: srcMat.opacity ?? 1,
            });
          }
        }
      });

      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Match procedural boss height (~2.95 units) with shoe soles resting at y = 0
      const targetHeight = 2.95;
      const scale = size.y > 0.0001 ? targetHeight / size.y : targetHeight;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

      const template = new THREE.Group();
      template.add(model);
      bossGlbTemplates.set(glbPath, template);
      return template;
    } catch (err) {
      console.warn(`Failed to load ${glbPath}, using procedural fallback:`, err);
      bossGlbTemplates.set(glbPath, null);
      return null;
    }
  })();

  bossGlbLoadPromises.set(glbPath, promise);
  return promise;
}

function attachBossGlbSwap(
  glbPath: string,
  root: THREE.Group,
  bodyPivot: THREE.Group,
  fallbackUpperGroup: THREE.Group,
  leftLegPivot: THREE.Group,
  rightLegPivot: THREE.Group
): void {
  const applyGlbTemplate = (template: THREE.Group) => {
    const cloned = template.clone(true);
    leftLegPivot.visible = false;
    rightLegPivot.visible = false;
    fallbackUpperGroup.visible = false;
    root.remove(leftLegPivot, rightLegPivot);
    bodyPivot.remove(fallbackUpperGroup);
    bodyPivot.position.set(0, 0, 0);
    bodyPivot.add(cloned);
    root.userData.hasGlbModel = true;
  };

  if (bossGlbTemplates.has(glbPath)) {
    const cached = bossGlbTemplates.get(glbPath);
    if (cached) {
      applyGlbTemplate(cached);
    }
    return;
  }

  loadGlbTemplate(glbPath).then((template) => {
    if (template) {
      applyGlbTemplate(template);
    }
  });
}

function buildBossChibiHead(skinMat: THREE.MeshStandardMaterial): THREE.Group {
  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xfca5a5,
    roughness: 0.7,
    transparent: true,
    opacity: 0.65,
  });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.25 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x4b2e1b, roughness: 0.58 });
  const glassFrameMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.72,
    roughness: 0.12,
    metalness: 0.2,
  });
  const glassLensMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.12,
    roughness: 0.08,
    metalness: 0.1,
  });

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.54, 0.02);

  const faceMesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 20), skinMat);
  faceMesh.scale.set(1.06, 0.94, 0.98);
  faceMesh.castShadow = true;
  headGroup.add(faceMesh);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skinMat);
    ear.position.set(side * 0.63, -0.02, -0.02);
    headGroup.add(ear);

    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), blushMat);
    cheek.scale.set(1.2, 0.75, 0.4);
    cheek.position.set(side * 0.34, -0.14, 0.52);
    headGroup.add(cheek);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.074, 14, 12), eyeMat);
    eye.scale.set(0.84, 1.28, 0.6);
    eye.position.set(side * 0.2, 0.03, 0.59);
    headGroup.add(eye);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinMat);
  nose.position.set(0, -0.06, 0.62);
  headGroup.add(nose);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.04), eyeMat);
  mouth.position.set(0, -0.22, 0.575);
  headGroup.add(mouth);

  // Signature rounded dark-brown bowl-cut bangs hair (stays above eye line)
  const crownHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.66, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.45),
    hairMat
  );
  crownHair.scale.set(1.05, 0.92, 1.03);
  crownHair.position.set(0, 0.1, -0.02);
  crownHair.castShadow = true;
  headGroup.add(crownHair);

  // Back/side bowl hair strictly behind the face plane so eyes are never occluded
  const backHair = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.61, 0.4, 20, 1, false, Math.PI * 0.56, Math.PI * 0.88),
    hairMat
  );
  backHair.position.set(0, 0.04, -0.05);
  headGroup.add(backHair);

  // Sideburn strands smoothly connecting bowl crown to behind the ears
  for (const side of [-1, 1]) {
    const sideburn = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 6, 10), hairMat);
    sideburn.position.set(side * 0.56, 0.14, -0.06);
    sideburn.rotation.x = -0.08;
    headGroup.add(sideburn);
  }

  // Rounded bang strands across forehead above glasses
  for (let i = -3; i <= 3; i++) {
    const ang = i * 0.24;
    const bang = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.2, 6, 10), hairMat);
    bang.position.set(Math.sin(ang) * 0.56, 0.27 - Math.abs(i) * 0.015, Math.cos(ang) * 0.55);
    bang.rotation.x = 0.22;
    bang.rotation.y = ang;
    headGroup.add(bang);
  }

  // Clear rectangular eyeglasses
  const glassesGroup = new THREE.Group();
  glassesGroup.position.set(0, 0.03, 0.65);
  headGroup.add(glassesGroup);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.042, 0.04), glassFrameMat);
  bridge.position.set(0, 0.055, 0);
  glassesGroup.add(bridge);

  for (const side of [-1, 1]) {
    const cx = side * 0.24;
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.23, 0.015), glassLensMat);
    lens.position.set(cx, 0, 0);
    glassesGroup.add(lens);

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.042), glassFrameMat);
    topBar.position.set(cx, 0.125, 0);
    const botBar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.036, 0.042), glassFrameMat);
    botBar.position.set(cx, -0.12, 0);
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.26, 0.042), glassFrameMat);
    leftBar.position.set(cx - 0.17, 0, 0);
    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.26, 0.042), glassFrameMat);
    rightBar.position.set(cx + 0.17, 0, 0);
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.042, 0.66), glassFrameMat);
    temple.position.set(side * 0.49, 0.045, -0.32);
    temple.rotation.y = -side * 0.24;

    glassesGroup.add(topBar, botBar, leftBar, rightBar, temple);
  }

  return headGroup;
}

let taegeukgiTextureCache: THREE.CanvasTexture | null = null;

function getTaegeukgiPatchTexture(): THREE.CanvasTexture {
  if (taegeukgiTextureCache) {
    return taegeukgiTextureCache;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 112;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 160, 112);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 156, 108);

  const cx = 80;
  const cy = 56;
  const r = 24;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI * 0.18);

  // Red upper half + Blue lower half of Taegeuk
  ctx.fillStyle = '#cd2e3a';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0, false);
  ctx.fill();

  ctx.fillStyle = '#0047a0';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI, false);
  ctx.fill();

  // Swirl lobes
  ctx.fillStyle = '#cd2e3a';
  ctx.beginPath();
  ctx.arc(-r * 0.5, 0, r * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0047a0';
  ctx.beginPath();
  ctx.arc(r * 0.5, 0, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Four corner trigrams
  const drawTrigram = (
    tx: number,
    ty: number,
    angle: number,
    brokenRows: [boolean, boolean, boolean]
  ) => {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(angle);
    ctx.fillStyle = '#111827';
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * 5;
      if (!brokenRows[i]) {
        ctx.fillRect(-10, y - 1.5, 20, 3);
      } else {
        ctx.fillRect(-10, y - 1.5, 8.5, 3);
        ctx.fillRect(1.5, y - 1.5, 8.5, 3);
      }
    }
    ctx.restore();
  };

  drawTrigram(34, 24, -0.58, [false, false, false]);
  drawTrigram(126, 24, 0.58, [true, false, true]);
  drawTrigram(34, 88, 0.58, [false, true, false]);
  drawTrigram(126, 88, -0.58, [true, true, true]);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  taegeukgiTextureCache = texture;
  return texture;
}

/**
 * Builds the 3D Mustang Boss Character using `./models/boss-character.glb`
 * (with the procedural stylized 3D boss as an instant fallback while loading).
 * Local forward is +Z; origin (0, 0, 0) sits flush at foot soles.
 */
export function createPlaygroundBossCharacter(): BossCharacterParts {
  const root = new THREE.Group();
  const fallbackUpperGroup = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd1b8, roughness: 0.52 });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.36,
    metalness: 0.14,
  });
  const furMat = new THREE.MeshStandardMaterial({
    color: 0x09090d,
    roughness: 0.96,
    metalness: 0.02,
  });
  const silverMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.85,
  });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5 });

  // Legs (hip pivots at y = 0.72 so shoe soles rest cleanly at y = 0)
  const buildLeg = (side: -1 | 1): THREE.Group => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.28, 0.72, 0);

    const pant = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.54, 14), pantsMat);
    pant.position.set(0, -0.27, 0);
    pant.castShadow = true;
    legPivot.add(pant);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.44), leatherMat);
    shoe.position.set(0, -0.59, 0.06);
    shoe.castShadow = true;
    legPivot.add(shoe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.46), soleMat);
    sole.position.set(0, -0.69, 0.06);
    legPivot.add(sole);

    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.14), silverMat);
    lace.position.set(0, -0.52, 0.14);
    legPivot.add(lace);

    return legPivot;
  };

  const leftLegPivot = buildLeg(-1);
  const rightLegPivot = buildLeg(1);
  root.add(leftLegPivot, rightLegPivot);

  // Upper body pivot at waist (y = 0.76) so shoulder-bash leans forward dynamically!
  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, 0.76, 0);
  bodyPivot.add(fallbackUpperGroup);
  root.add(bodyPivot);

  // Shearling leather aviator jacket torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.16, 1.04, 0.72), leatherMat);
  torso.position.set(0, 0.52, 0);
  torso.castShadow = true;
  fallbackUpperGroup.add(torso);

  // Fluffy shearling hem trim
  const hemFur = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.15, 0.78), furMat);
  hemFur.position.set(0, 0.06, 0);
  fallbackUpperGroup.add(hemFur);

  // Fluffy black shearling collar (left & right lapels + back roll)
  const collarBack = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.24, 0.46), furMat);
  collarBack.position.set(0, 1.04, -0.14);
  fallbackUpperGroup.add(collarBack);

  for (const side of [-1, 1]) {
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.32), furMat);
    lapel.position.set(side * 0.34, 0.96, 0.28);
    lapel.rotation.z = -side * 0.36;
    lapel.rotation.y = side * 0.15;
    lapel.castShadow = true;
    fallbackUpperGroup.add(lapel);
  }

  // Center silver zipper & pull tab (+Z chest)
  const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.88, 0.04), silverMat);
  zipper.position.set(0, 0.48, 0.365);
  fallbackUpperGroup.add(zipper);

  const zipPull = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.05), silverMat);
  zipPull.position.set(0, 0.76, 0.38);
  fallbackUpperGroup.add(zipPull);

  // Signature collar buckle strap with 3 silver eyelets
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.04), leatherMat);
  strap.position.set(-0.24, 0.72, 0.375);
  strap.rotation.z = 0.2;
  fallbackUpperGroup.add(strap);
  for (let e = 0; e < 3; e++) {
    const eyelet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), silverMat);
    eyelet.rotation.x = Math.PI * 0.5;
    eyelet.position.set(-0.26 + e * 0.02, 0.8 - e * 0.09, 0.39);
    fallbackUpperGroup.add(eyelet);
  }

  // Arms with shearling cuffs
  const buildArm = (side: -1 | 1): THREE.Group => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.73, 0.9, 0);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.58, 14), leatherMat);
    sleeve.position.set(0, -0.26, 0);
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.14, 14), furMat);
    cuff.position.set(0, -0.56, 0);
    armPivot.add(cuff);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), skinMat);
    hand.position.set(0, -0.71, 0.02);
    hand.castShadow = true;
    armPivot.add(hand);

    return armPivot;
  };

  const leftArmPivot = buildArm(-1);
  const rightArmPivot = buildArm(1);
  fallbackUpperGroup.add(leftArmPivot, rightArmPivot);

  const headGroup = buildBossChibiHead(skinMat);
  fallbackUpperGroup.add(headGroup);

  attachBossGlbSwap(
    './models/boss-character.glb',
    root,
    bodyPivot,
    fallbackUpperGroup,
    leftLegPivot,
    rightLegPivot
  );

  return {
    root,
    bodyPivot,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
  };
}

/**
 * Builds the 3D Taekwondo Boss Character using `./models/taekwondo-boss-character.glb`
 * (with a procedural stylized 3D dobok boss matching the reference image while loading or before GLB is provided).
 * Local forward is +Z; origin (0, 0, 0) sits flush at shoe soles.
 */
export function createTaekwondoBossCharacter(): BossCharacterParts {
  const root = new THREE.Group();
  const fallbackUpperGroup = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd1b8, roughness: 0.52 });
  const dobokMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.62,
    metalness: 0.02,
  });
  const dobokShadeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.68,
    metalness: 0.02,
  });
  const collarBlackMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.48,
    metalness: 0.05,
  });
  const collarRedMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.46,
    metalness: 0.05,
  });
  const beltMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.58,
    metalness: 0.04,
  });
  const shoeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.04,
  });
  const shoeSoleMat = new THREE.MeshStandardMaterial({
    color: 0xd6b89c,
    roughness: 0.68,
    metalness: 0.02,
  });

  // Legs (hip pivots at y = 0.72 so shoe soles rest cleanly at y = 0)
  const buildLeg = (side: -1 | 1): THREE.Group => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.27, 0.72, 0);

    const pant = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.54, 16), dobokMat);
    pant.position.set(0, -0.27, 0);
    pant.castShadow = true;
    legPivot.add(pant);

    const cuffTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.225, 0.225, 0.045, 16),
      dobokShadeMat
    );
    cuffTrim.position.set(0, -0.52, 0);
    legPivot.add(cuffTrim);

    // Sleek rounded white Taekwondo shoe on tan sole (resting flush at y = 0)
    const shoeUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.22, 8, 14), shoeWhiteMat);
    shoeUpper.rotation.x = Math.PI * 0.5;
    shoeUpper.scale.set(1.06, 1.0, 0.68);
    shoeUpper.position.set(0, -0.585, 0.07);
    shoeUpper.castShadow = true;
    legPivot.add(shoeUpper);

    const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.23, 6, 14), shoeSoleMat);
    sole.rotation.x = Math.PI * 0.5;
    sole.scale.set(1.08, 1.0, 0.34);
    sole.position.set(0, -0.668, 0.07);
    legPivot.add(sole);

    return legPivot;
  };

  const leftLegPivot = buildLeg(-1);
  const rightLegPivot = buildLeg(1);
  root.add(leftLegPivot, rightLegPivot);

  // Upper body pivot at waist (y = 0.76)
  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, 0.76, 0);
  bodyPivot.add(fallbackUpperGroup);
  root.add(bodyPivot);

  // White Taekwondo dobok upper jacket & flared lower skirt
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.84, 0.68), dobokMat);
  torso.position.set(0, 0.62, 0);
  torso.castShadow = true;
  fallbackUpperGroup.add(torso);

  const jacketSkirt = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.26, 0.72), dobokMat);
  jacketSkirt.position.set(0, 0.12, 0);
  jacketSkirt.castShadow = true;
  fallbackUpperGroup.add(jacketSkirt);

  const skirtShadow = new THREE.Mesh(new THREE.BoxGeometry(1.17, 0.04, 0.73), dobokShadeMat);
  skirtShadow.position.set(0, 0.0, 0);
  fallbackUpperGroup.add(skirtShadow);

  // Smooth V-shaped throat/neck skin opening inside the V-neck collar
  const neckVShape = new THREE.Shape();
  neckVShape.moveTo(-0.24, 0.24);
  neckVShape.lineTo(0.24, 0.24);
  neckVShape.lineTo(0, -0.22);
  neckVShape.closePath();
  const neckCollarSkin = new THREE.Mesh(new THREE.ShapeGeometry(neckVShape), skinMat);
  neckCollarSkin.position.set(0, 0.81, 0.343);
  fallbackUpperGroup.add(neckCollarSkin);

  // Red & Black Poom/Master V-neck collar (back roll + front V + center clasp)
  const collarBackRed = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 0.36), collarRedMat);
  collarBackRed.position.set(0, 1.04, -0.14);
  const collarBackBlack = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.15, 0.32), collarBlackMat);
  collarBackBlack.position.set(0, 1.05, -0.1);
  fallbackUpperGroup.add(collarBackRed, collarBackBlack);

  for (const side of [-1, 1]) {
    // Outer red lapel border
    const redBar = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.51, 0.042), collarRedMat);
    redBar.position.set(side * 0.17, 0.79, 0.344);
    redBar.rotation.z = -side * 0.5;
    redBar.rotation.y = side * 0.06;
    fallbackUpperGroup.add(redBar);

    // Inner black lapel border
    const blackBar = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.52, 0.048), collarBlackMat);
    blackBar.position.set(side * 0.13, 0.785, 0.352);
    blackBar.rotation.z = -side * 0.5;
    blackBar.rotation.y = side * 0.06;
    fallbackUpperGroup.add(blackBar);
  }

  // Black rectangular collar apex at chest center
  const collarApex = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.055), collarBlackMat);
  collarApex.position.set(0, 0.535, 0.358);
  fallbackUpperGroup.add(collarApex);

  // Taegeukgi patch on left chest (+X in +Z-forward local coordinates)
  const taegeukMat = new THREE.MeshStandardMaterial({
    map: getTaegeukgiPatchTexture(),
    roughness: 0.55,
  });
  const patchSideMat = dobokShadeMat;
  const chestPatch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.025), [
    patchSideMat,
    patchSideMat,
    patchSideMat,
    patchSideMat,
    taegeukMat,
    patchSideMat,
  ]);
  chestPatch.position.set(0.32, 0.72, 0.348);
  fallbackUpperGroup.add(chestPatch);

  // Black belt tied around waist with front knot & two outward-draping ends
  const beltWrap = new THREE.Mesh(new THREE.BoxGeometry(1.19, 0.14, 0.74), beltMat);
  beltWrap.position.set(0, 0.24, 0);
  beltWrap.castShadow = true;
  fallbackUpperGroup.add(beltWrap);

  const beltKnot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), beltMat);
  beltKnot.scale.set(1.15, 0.92, 0.78);
  beltKnot.position.set(0, 0.24, 0.38);
  beltKnot.castShadow = true;
  fallbackUpperGroup.add(beltKnot);

  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.045), beltMat);
    tail.position.set(side * 0.095, 0.07, 0.39);
    tail.rotation.z = side * 0.28;
    tail.rotation.x = -0.08;
    tail.castShadow = true;
    fallbackUpperGroup.add(tail);
  }

  // Arms with rounded dobok shoulders & flared sleeves
  const buildArm = (side: -1 | 1): THREE.Group => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.63, 0.89, 0);
    armPivot.rotation.z = side * 0.16;

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.195, 16, 12), dobokMat);
    shoulderCap.position.set(0, 0.01, 0);
    shoulderCap.castShadow = true;
    armPivot.add(shoulderCap);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.23, 0.54, 16), dobokMat);
    sleeve.position.set(0, -0.26, 0);
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const sleeveCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.235, 0.235, 0.045, 16),
      dobokShadeMat
    );
    sleeveCuff.position.set(0, -0.52, 0);
    armPivot.add(sleeveCuff);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.165, 14, 12), skinMat);
    hand.position.set(0, -0.66, 0.02);
    hand.castShadow = true;
    armPivot.add(hand);

    return armPivot;
  };

  const leftArmPivot = buildArm(-1);
  const rightArmPivot = buildArm(1);
  fallbackUpperGroup.add(leftArmPivot, rightArmPivot);

  const headGroup = buildBossChibiHead(skinMat);
  fallbackUpperGroup.add(headGroup);

  attachBossGlbSwap(
    './models/taekwondo-boss-character.glb',
    root,
    bodyPivot,
    fallbackUpperGroup,
    leftLegPivot,
    rightLegPivot
  );

  return {
    root,
    bodyPivot,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
  };
}
