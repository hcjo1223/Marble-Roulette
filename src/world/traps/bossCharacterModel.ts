import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface BossCharacterParts {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
}

let bossGlbTemplate: THREE.Group | null = null;
let bossGlbLoadPromise: Promise<THREE.Group | null> | null = null;

function loadBossGlbTemplate(): Promise<THREE.Group | null> {
  if (bossGlbTemplate) {
    return Promise.resolve(bossGlbTemplate);
  }
  if (bossGlbLoadPromise) {
    return bossGlbLoadPromise;
  }

  const loader = new GLTFLoader();
  bossGlbLoadPromise = new Promise((resolve) => {
    loader.load(
      './models/boss-character.glb',
      (gltf) => {
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
                map: srcMat.map ?? null,
                normalMap: srcMat.normalMap ?? null,
                normalScale: new THREE.Vector2(0.85, 0.85),
                roughnessMap: srcMat.roughnessMap ?? null,
                roughness: 0.58,
                metalness: 0.08,
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
        bossGlbTemplate = template;
        resolve(template);
      },
      undefined,
      (err) => {
        console.warn('Failed to load boss-character.glb, using procedural fallback:', err);
        resolve(null);
      }
    );
  });

  return bossGlbLoadPromise;
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
  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xfca5a5,
    roughness: 0.7,
    transparent: true,
    opacity: 0.65,
  });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.25 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x4b2e1b, roughness: 0.58 });
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
  const glassFrameMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.65,
    roughness: 0.12,
    metalness: 0.2,
  });
  const glassLensMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.24,
    roughness: 0.08,
    metalness: 0.1,
  });

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

  // Chibi-proportioned head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.54, 0.02);
  fallbackUpperGroup.add(headGroup);

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

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), eyeMat);
    eye.scale.set(0.85, 1.25, 0.6);
    eye.position.set(side * 0.2, 0.04, 0.58);
    headGroup.add(eye);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinMat);
  nose.position.set(0, -0.06, 0.62);
  headGroup.add(nose);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.04), eyeMat);
  mouth.position.set(0, -0.22, 0.57);
  headGroup.add(mouth);

  // Signature rounded dark-brown bowl-cut bangs hair
  const crownHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.66, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  crownHair.scale.set(1.05, 0.92, 1.03);
  crownHair.position.set(0, 0.07, -0.02);
  crownHair.castShadow = true;
  headGroup.add(crownHair);

  const backHair = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.63, 0.42, 20), hairMat);
  backHair.position.set(0, 0.04, -0.08);
  headGroup.add(backHair);

  // Rounded bang strands across forehead above glasses
  for (let i = -3; i <= 3; i++) {
    const ang = i * 0.24;
    const bang = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 6, 10), hairMat);
    bang.position.set(Math.sin(ang) * 0.56, 0.25 - Math.abs(i) * 0.015, Math.cos(ang) * 0.55);
    bang.rotation.x = 0.22;
    bang.rotation.y = ang;
    headGroup.add(bang);
  }

  // Clear rectangular eyeglasses
  const glassesGroup = new THREE.Group();
  glassesGroup.position.set(0, 0.03, 0.64);
  headGroup.add(glassesGroup);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.04), glassFrameMat);
  bridge.position.set(0, 0.06, 0);
  glassesGroup.add(bridge);

  for (const side of [-1, 1]) {
    const cx = side * 0.24;
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.23, 0.02), glassLensMat);
    lens.position.set(cx, 0, 0);
    glassesGroup.add(lens);

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.042, 0.045), glassFrameMat);
    topBar.position.set(cx, 0.125, 0);
    const botBar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.038, 0.045), glassFrameMat);
    botBar.position.set(cx, -0.12, 0);
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.045), glassFrameMat);
    leftBar.position.set(cx - 0.17, 0, 0);
    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.045), glassFrameMat);
    rightBar.position.set(cx + 0.17, 0, 0);
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.58), glassFrameMat);
    temple.position.set(side * 0.54, 0.06, -0.29);
    temple.rotation.y = side * 0.16;

    glassesGroup.add(topBar, botBar, leftBar, rightBar, temple);
  }

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

  if (bossGlbTemplate) {
    applyGlbTemplate(bossGlbTemplate);
  } else {
    loadBossGlbTemplate().then((template) => {
      if (template) {
        applyGlbTemplate(template);
      }
    });
  }

  return {
    root,
    bodyPivot,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
  };
}
