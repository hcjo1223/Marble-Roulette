import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { MapTheme, ParticipantEntry, RacerState } from '../types';

export const GROUP_ENV = 0x0001;
export const GROUP_TORSO = 0x0002;
export const GROUP_LIMB = 0x0004;

export function makeCollisionGroups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

export class RagdollRacer {
  public readonly id: string;
  public readonly name: string;
  public readonly color: string;
  public readonly accentColor: string;

  public state: RacerState = 'WAITING';
  public rank: number = 1;
  public finishOrder: number | null = null;
  public finishTime: number | null = null;
  public ragdollCount: number = 0;
  public isTargetRankCandidate: boolean = false;

  // Rapier Physics Bodies (6-part R6 Ragdoll)
  private world: RAPIER.World;
  public torsoBody: RAPIER.RigidBody;
  public headBody: RAPIER.RigidBody;
  public leftArmBody: RAPIER.RigidBody;
  public rightArmBody: RAPIER.RigidBody;
  public leftLegBody: RAPIER.RigidBody;
  public rightLegBody: RAPIER.RigidBody;

  // Rapier Impulse Joints
  private neckJoint: RAPIER.SphericalImpulseJoint;
  private leftShoulderJoint: RAPIER.RevoluteImpulseJoint;
  private rightShoulderJoint: RAPIER.RevoluteImpulseJoint;
  private leftHipJoint: RAPIER.RevoluteImpulseJoint;
  private rightHipJoint: RAPIER.RevoluteImpulseJoint;

  // Three.js Meshes
  private scene: THREE.Scene;
  public torsoMesh: THREE.Mesh;
  public headMesh: THREE.Mesh;
  public leftArmMesh: THREE.Mesh;
  public rightArmMesh: THREE.Mesh;
  public leftLegMesh: THREE.Mesh;
  public rightLegMesh: THREE.Mesh;
  public selectionRing: THREE.Mesh;

  // Face Texture & Billboard Sprite
  private faceCanvas: HTMLCanvasElement;
  private faceCtx: CanvasRenderingContext2D;
  private faceTexture: THREE.CanvasTexture;
  private currentFaceMode: 'NORMAL' | 'DIZZY' | 'WINNER' | null = null;

  private labelCanvas: HTMLCanvasElement;
  private labelCtx: CanvasRenderingContext2D;
  private labelTexture: THREE.CanvasTexture;
  public labelSprite: THREE.Sprite;
  private lastRenderedRank: number = -1;
  private lastRenderedState: RacerState = 'WAITING';
  private lastRenderedHighlight: boolean = false;

  // Autonomous Steering & Randomness Parameters
  private baseSpeed: number;
  private wanderPhase1: number;
  private wanderPhase2: number;
  private wanderFreq1: number;
  private wanderFreq2: number;
  private preferredLaneOffset: number;
  private runCyclePhase: number;
  private jumpCooldown: number;
  private ragdollTimer: number = 0;
  private recoverTimer: number = 0;
  private stuckTimer: number = 0;
  private lastProgressZ: number = 0;
  private elapsedTime: number = 0;

  constructor(
    entry: ParticipantEntry,
    index: number,
    spawnPos: THREE.Vector3,
    world: RAPIER.World,
    scene: THREE.Scene,
    mapTheme: MapTheme = 'PLAYGROUND'
  ) {
    this.id = entry.id;
    this.name = entry.name;
    this.color = entry.color;
    this.accentColor = entry.accentColor;
    this.world = world;
    this.scene = scene;
    this.rank = index + 1;

    // Autonomous AI individual traits
    this.baseSpeed = 10.6 + Math.random() * 1.4;
    this.wanderPhase1 = Math.random() * Math.PI * 2;
    this.wanderPhase2 = Math.random() * Math.PI * 2;
    this.wanderFreq1 = 1.1 + Math.random() * 0.9;
    this.wanderFreq2 = 2.3 + Math.random() * 1.2;
    this.preferredLaneOffset = (Math.random() - 0.5) * 8.5;
    this.runCyclePhase = Math.random() * Math.PI * 2;
    this.jumpCooldown = 1.2 + Math.random() * 2.4;

    const torsoGroup = makeCollisionGroups(GROUP_TORSO, GROUP_ENV | GROUP_TORSO);
    const limbGroup = makeCollisionGroups(GROUP_LIMB, GROUP_ENV);

    // 1. Torso RigidBody (Core body + smooth lower foot collider)
    const torsoDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
      .setLinearDamping(0.65)
      .setAngularDamping(1.8)
      .setCcdEnabled(true);
    this.torsoBody = world.createRigidBody(torsoDesc);

    const torsoColDesc = RAPIER.ColliderDesc.cuboid(0.38, 0.42, 0.21)
      .setMass(3.2)
      .setRestitution(0.38)
      .setFriction(0.15)
      .setCollisionGroups(torsoGroup);
    world.createCollider(torsoColDesc, this.torsoBody);

    // Lower foot sphere collider attached to torso so upright running glides smoothly
    const footSphereDesc = RAPIER.ColliderDesc.ball(0.31)
      .setTranslation(0, -0.76, 0)
      .setMass(0.8)
      .setRestitution(0.2)
      .setFriction(0.04)
      .setCollisionGroups(torsoGroup);
    world.createCollider(footSphereDesc, this.torsoBody);

    // 2. Head RigidBody
    const headDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnPos.x, spawnPos.y + 0.76, spawnPos.z)
      .setLinearDamping(0.8)
      .setAngularDamping(2.0);
    this.headBody = world.createRigidBody(headDesc);
    const headCol = RAPIER.ColliderDesc.cuboid(0.26, 0.26, 0.26)
      .setMass(0.25)
      .setRestitution(0.45)
      .setFriction(0.2)
      .setCollisionGroups(limbGroup);
    world.createCollider(headCol, this.headBody);

    // 3. Left & Right Arm RigidBodies
    const createLimbBody = (offsetX: number, offsetY: number, hx: number, hy: number, hz: number) => {
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnPos.x + offsetX, spawnPos.y + offsetY, spawnPos.z)
        .setLinearDamping(0.7)
        .setAngularDamping(1.8);
      const body = world.createRigidBody(desc);
      const col = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setMass(0.2)
        .setRestitution(0.35)
        .setFriction(0.2)
        .setCollisionGroups(limbGroup);
      world.createCollider(col, body);
      return body;
    };

    this.leftArmBody = createLimbBody(-0.56, 0.02, 0.15, 0.36, 0.15);
    this.rightArmBody = createLimbBody(0.56, 0.02, 0.15, 0.36, 0.15);
    this.leftLegBody = createLimbBody(-0.2, -0.72, 0.16, 0.34, 0.16);
    this.rightLegBody = createLimbBody(0.2, -0.72, 0.16, 0.34, 0.16);

    // 4. Create Rapier ImpulseJoints connecting R6 parts
    const neckData = RAPIER.JointData.spherical(
      { x: 0, y: 0.46, z: 0 },
      { x: 0, y: -0.28, z: 0 }
    );
    this.neckJoint = world.createImpulseJoint(
      neckData,
      this.torsoBody,
      this.headBody,
      true
    ) as RAPIER.SphericalImpulseJoint;
    this.neckJoint.setContactsEnabled(false);

    const createRevoluteLimbJoint = (
      body2: RAPIER.RigidBody,
      anchor1: { x: number; y: number; z: number },
      anchor2: { x: number; y: number; z: number },
      minAngle: number,
      maxAngle: number
    ) => {
      const data = RAPIER.JointData.revolute(anchor1, anchor2, { x: 1, y: 0, z: 0 });
      const joint = world.createImpulseJoint(
        data,
        this.torsoBody,
        body2,
        true
      ) as RAPIER.RevoluteImpulseJoint;
      joint.setContactsEnabled(false);
      joint.setLimits(minAngle, maxAngle);
      return joint;
    };

    this.leftShoulderJoint = createRevoluteLimbJoint(
      this.leftArmBody,
      { x: -0.55, y: 0.3, z: 0 },
      { x: 0, y: 0.28, z: 0 },
      -2.5,
      2.5
    );
    this.rightShoulderJoint = createRevoluteLimbJoint(
      this.rightArmBody,
      { x: 0.55, y: 0.3, z: 0 },
      { x: 0, y: 0.28, z: 0 },
      -2.5,
      2.5
    );
    this.leftHipJoint = createRevoluteLimbJoint(
      this.leftLegBody,
      { x: -0.2, y: -0.43, z: 0 },
      { x: 0, y: 0.28, z: 0 },
      -1.7,
      1.7
    );
    this.rightHipJoint = createRevoluteLimbJoint(
      this.rightLegBody,
      { x: 0.2, y: -0.43, z: 0 },
      { x: 0, y: 0.28, z: 0 },
      -1.7,
      1.7
    );

    // 5. Build Three.js R6 Blocky Meshes
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 128;
    this.faceCanvas.height = 128;
    this.faceCtx = this.faceCanvas.getContext('2d')!;
    this.faceTexture = new THREE.CanvasTexture(this.faceCanvas);
    this.drawFaceTexture('NORMAL');

    const isTaekwondo = mapTheme === 'TAEKWONDO';
    const skinColor = new THREE.Color('#fde047'); // Classic Roblox yellow head/hands
    const torsoMat = new THREE.MeshStandardMaterial({
      color: isTaekwondo ? new THREE.Color('#f8fafc') : new THREE.Color(this.color),
      roughness: 0.32,
      metalness: 0.05,
    });
    const limbMat = new THREE.MeshStandardMaterial({
      color: isTaekwondo ? new THREE.Color('#f1f5f9') : new THREE.Color(this.accentColor),
      roughness: 0.4,
      metalness: 0.05,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.35,
      metalness: 0.05,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      map: this.faceTexture,
      roughness: 0.35,
      metalness: 0.05,
    });

    this.torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.84, 0.42), torsoMat);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;

    if (isTaekwondo) {
      // Taekwondo Dobok black/red V-neck collar + colored rank belt + hogu chest protector accent
      const collarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
      const collarV = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.44), collarMat);
      collarV.position.set(0, 0.24, 0);
      this.torsoMesh.add(collarV);

      const beltMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.color),
        roughness: 0.3,
      });
      const waistBelt = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.46), beltMat);
      waistBelt.position.set(0, -0.22, 0);
      this.torsoMesh.add(waistBelt);

      const beltKnot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.5), beltMat);
      beltKnot.position.set(0, -0.28, 0.02);
      this.torsoMesh.add(beltKnot);
    } else {
      const chestBadge = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.26, 0.44),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      chestBadge.position.set(0, 0.12, 0);
      this.torsoMesh.add(chestBadge);
    }

    // Head mesh (6 materials so +Z front has face)
    const headMats = [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat];
    this.headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
    this.headMesh.castShadow = true;

    if (isTaekwondo) {
      // Cute Martial Arts Headband in racer's color!
      const bandMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.color),
        roughness: 0.3,
      });
      const headband = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.58), bandMat);
      headband.position.set(0, 0.14, 0);
      this.headMesh.add(headband);
    }

    // Arms & Legs meshes
    const armGeo = new THREE.BoxGeometry(0.3, 0.74, 0.3);
    this.leftArmMesh = new THREE.Mesh(armGeo, isTaekwondo ? torsoMat : skinMat);
    this.rightArmMesh = new THREE.Mesh(armGeo, isTaekwondo ? torsoMat : skinMat);
    this.leftArmMesh.castShadow = true;
    this.rightArmMesh.castShadow = true;

    const legGeo = new THREE.BoxGeometry(0.33, 0.72, 0.33);
    this.leftLegMesh = new THREE.Mesh(legGeo, limbMat);
    this.rightLegMesh = new THREE.Mesh(legGeo, limbMat);
    this.leftLegMesh.castShadow = true;
    this.rightLegMesh.castShadow = true;

    // Selection ring under racer
    const ringGeo = new THREE.RingGeometry(0.55, 0.78, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.selectionRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    this.selectionRing.visible = false;

    scene.add(
      this.torsoMesh,
      this.headMesh,
      this.leftArmMesh,
      this.rightArmMesh,
      this.leftLegMesh,
      this.rightLegMesh,
      this.selectionRing
    );

    // 6. Billboard Nickname UI Sprite (High-contrast & crisp on PC/Mobile)
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = 440;
    this.labelCanvas.height = 120;
    this.labelCtx = this.labelCanvas.getContext('2d')!;
    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);
    this.labelTexture.minFilter = THREE.LinearFilter;
    this.labelTexture.magFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: this.labelTexture,
      transparent: true,
      depthTest: false,
      toneMapped: false,
    });
    this.labelSprite = new THREE.Sprite(spriteMat);
    this.labelSprite.scale.set(2.45, 0.68, 1);
    this.labelSprite.renderOrder = 999;
    scene.add(this.labelSprite);

    this.updateBillboardLabel(true);
    this.syncVisuals(false);
  }

  private drawFaceTexture(mode: 'NORMAL' | 'DIZZY' | 'WINNER'): void {
    if (this.currentFaceMode === mode) return;
    this.currentFaceMode = mode;
    const ctx = this.faceCtx;
    ctx.fillStyle = '#fde047';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#1e293b';
    ctx.fillStyle = '#1e293b';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    if (mode === 'NORMAL') {
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
      // Cool sunglasses / star winner face
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(24, 40, 34, 22);
      ctx.fillRect(70, 40, 34, 22);
      ctx.fillRect(58, 45, 12, 6);

      ctx.beginPath();
      ctx.arc(64, 78, 22, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }

    this.faceTexture.needsUpdate = true;
  }

  public updateBillboardLabel(force: boolean = false): void {
    if (
      !force &&
      this.lastRenderedRank === this.rank &&
      this.lastRenderedState === this.state &&
      this.lastRenderedHighlight === this.isTargetRankCandidate
    ) {
      return;
    }
    this.lastRenderedRank = this.rank;
    this.lastRenderedState = this.state;
    this.lastRenderedHighlight = this.isTargetRankCandidate;

    const ctx = this.labelCtx;
    ctx.clearRect(0, 0, 440, 120);

    // High-contrast crisp pill tag for clear PC & mobile readability
    const isHit = this.state === 'RAGDOLL';
    const isHighlight = this.isTargetRankCandidate;

    // Bold name text auto-fitted inside compact centered pill
    const statusIcon =
      this.state === 'RAGDOLL'
        ? ' 💫'
        : this.state === 'FINISHED'
        ? ' 👑'
        : isHighlight
        ? ' 🎯'
        : '';
    const displayText =
      (this.name.length > 8 ? this.name.slice(0, 8) + '…' : this.name) + statusIcon;

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
      : isHighlight
      ? '#fef08a'
      : '#ffffff';
    ctx.strokeStyle = isHit ? '#dc2626' : isHighlight ? '#d97706' : '#0f172a';
    ctx.lineWidth = isHighlight ? 7 : 6;

    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, radius);
    ctx.fill();
    ctx.stroke();

    // Colored rank badge
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(rx + 10, ry + 10, badgeW, 74, 34);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${this.rank}`, rx + 10 + badgeW * 0.5, ry + 48);

    ctx.fillStyle = '#0f172a';
    ctx.font = `900 ${fontSize}px "Plus Jakarta Sans", "Pretendard", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, rx + 10 + badgeW + 12, ry + 48);

    this.labelTexture.needsUpdate = true;
  }

  public getPosition(): THREE.Vector3 {
    const t = this.torsoBody.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  public triggerRagdoll(
    impulse: { x: number; y: number; z: number },
    torqueImpulse?: { x: number; y: number; z: number },
    duration: number = 1.25
  ): void {
    if (this.state === 'FINISHED') return;

    if (this.state !== 'RAGDOLL') {
      this.ragdollCount++;
      this.drawFaceTexture('DIZZY');
    }

    this.state = 'RAGDOLL';
    this.ragdollTimer = Math.max(this.ragdollTimer, duration);

    // Apply linear knockback impulse to torso
    this.torsoBody.applyImpulse(impulse, true);

    // Apply dramatic angular spin so the character tumbles head-over-heels
    const tx = torqueImpulse ? torqueImpulse.x : (Math.random() - 0.5) * 14;
    const ty = torqueImpulse ? torqueImpulse.y : (Math.random() - 0.5) * 10;
    const tz = torqueImpulse ? torqueImpulse.z : (Math.random() - 0.5) * 14;
    this.torsoBody.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true);

    // Release joint motor stiffness so all limbs flop and swing wildly on their joints!
    this.configureNeckMotor(RAPIER.JointAxis.AngX, 0, 3, 0.8);
    this.configureNeckMotor(RAPIER.JointAxis.AngY, 0, 3, 0.8);
    this.configureNeckMotor(RAPIER.JointAxis.AngZ, 0, 3, 0.8);

    this.leftShoulderJoint.configureMotorPosition(0, 2, 0.4);
    this.rightShoulderJoint.configureMotorPosition(0, 2, 0.4);
    this.leftHipJoint.configureMotorPosition(0, 2, 0.4);
    this.rightHipJoint.configureMotorPosition(0, 2, 0.4);

    // Give individual limbs extra flail impulse
    const flail = () => ({
      x: (Math.random() - 0.5) * 1.4,
      y: 0.4 + Math.random() * 1.2,
      z: (Math.random() - 0.5) * 1.4,
    });
    this.leftArmBody.applyImpulse(flail(), true);
    this.rightArmBody.applyImpulse(flail(), true);
    this.leftLegBody.applyImpulse(flail(), true);
    this.rightLegBody.applyImpulse(flail(), true);

    this.updateBillboardLabel();
  }

  public teleportTo(pos: THREE.Vector3): void {
    const resetBody = (
      body: RAPIER.RigidBody,
      ox: number,
      oy: number,
      oz: number
    ) => {
      body.setTranslation({ x: pos.x + ox, y: pos.y + oy, z: pos.z + oz }, true);
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setLinvel({ x: 0, y: 0, z: 4 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };

    resetBody(this.torsoBody, 0, 0, 0);
    resetBody(this.headBody, 0, 0.76, 0);
    resetBody(this.leftArmBody, -0.56, 0.02, 0);
    resetBody(this.rightArmBody, 0.56, 0.02, 0);
    resetBody(this.leftLegBody, -0.2, -0.72, 0);
    resetBody(this.rightLegBody, 0.2, -0.72, 0);

    this.state = 'RUNNING';
    this.ragdollTimer = 0;
    this.drawFaceTexture('NORMAL');
    this.updateBillboardLabel();
  }

  public updateAIAndPhysics(
    dt: number,
    totalRacers: number,
    trackCenterXAtZ: (z: number) => number,
    trackHalfWidthAtZ: (z: number) => number,
    trackHeightAtZ: (z: number) => number,
    onJumpCallback?: () => void,
    onRespawnCallback?: (pos: THREE.Vector3) => void
  ): void {
    this.elapsedTime += dt;
    const pos = this.torsoBody.translation();
    const vel = this.torsoBody.linvel();

    if (this.state === 'WAITING') {
      this.maintainUprightPose(0, dt, 0.4);
      return;
    }

    if (this.state === 'FINISHED') {
      // Celebratory hops & gentle slowdown inside the walled finish zone
      const expectedFinishY = trackHeightAtZ(pos.z);
      if (pos.y < expectedFinishY - 2.0 || pos.z > 147.0) {
        const safeFinishZ = 138.0;
        const safeFinishCX = trackCenterXAtZ(safeFinishZ);
        this.teleportTo(
          new THREE.Vector3(
            safeFinishCX + (Math.random() - 0.5) * 8.0,
            trackHeightAtZ(safeFinishZ) + 1.8,
            safeFinishZ
          )
        );
        this.state = 'FINISHED';
        this.drawFaceTexture('WINNER');
        this.updateBillboardLabel(true);
        return;
      }

      this.maintainUprightPose(0, dt, 0.6);
      this.torsoBody.applyImpulse(
        {
          x: -vel.x * 2.5 * dt,
          y: 0,
          z: (pos.z > 144.5 ? -vel.z * 5.0 - 8.0 : -vel.z * 2.8) * dt,
        },
        true
      );
      if (Math.random() < dt * 1.8 && Math.abs(vel.y) < 1.2) {
        this.torsoBody.applyImpulse({ x: 0, y: 18, z: 0 }, true);
      }
      return;
    }

    // Check out-of-bounds (sideways escape or fall) & respawn
    const centerX = trackCenterXAtZ(pos.z);
    const halfWidth = trackHalfWidthAtZ(pos.z);
    const lateralDist = Math.abs(pos.x - centerX);
    const expectedFloorY = trackHeightAtZ(pos.z);

    const inLastSection = pos.z >= 98;
    const isOffSide = lateralDist > halfWidth + 0.95;
    const isFallen = inLastSection
      ? pos.y < expectedFloorY - 2.2
      : pos.y < expectedFloorY - 8.5;

    if (isFallen || isOffSide) {
      // If knocked off in the last section (Zone 4-5), move racer back to start of last section (Z = 100.0)
      const safeZ = inLastSection ? 100.0 : Math.max(4, pos.z - 4);
      const safeCX = trackCenterXAtZ(safeZ);
      const safeSpan = Math.max(2.0, trackHalfWidthAtZ(safeZ) - 2.5);
      const respawnPos = new THREE.Vector3(
        safeCX + (Math.random() - 0.5) * safeSpan,
        trackHeightAtZ(safeZ) + 2.8,
        safeZ
      );
      this.teleportTo(respawnPos);
      if (onRespawnCallback) onRespawnCallback(respawnPos);
      return;
    }

    // Handle RAGDOLL state timer
    if (this.state === 'RAGDOLL') {
      this.ragdollTimer -= dt;
      if (this.ragdollTimer <= 0) {
        this.state = 'RECOVERING';
        this.recoverTimer = 0.42;
        this.drawFaceTexture('NORMAL');
        this.updateBillboardLabel();
      }
      return;
    }

    // Handle RECOVERING state
    if (this.state === 'RECOVERING') {
      this.recoverTimer -= dt;
      this.maintainUprightPose(0, dt, 0.5);
      if (this.recoverTimer <= 0) {
        this.state = 'RUNNING';
        this.updateBillboardLabel();
      }
    }

    // Autonomous RUNNING Steering + Randomness along curved track!
    const lookAheadCenterX = trackCenterXAtZ(pos.z + 5.0);
    const safeHalfWidth = Math.max(2.2, halfWidth - 1.3);

    // Sinusoidal wander + lane preference relative to curved track center
    const wanderOffset =
      Math.sin(this.elapsedTime * this.wanderFreq1 + this.wanderPhase1) * 3.4 +
      Math.cos(this.elapsedTime * this.wanderFreq2 + this.wanderPhase2) * 1.9 +
      this.preferredLaneOffset * (safeHalfWidth / 8.0);

    const clampedOffset = Math.max(-safeHalfWidth, Math.min(safeHalfWidth, wanderOffset));
    const targetWorldX = lookAheadCenterX + clampedOffset;
    const lateralError = targetWorldX - pos.x;

    // Rubber-banding comeback factor (trailing racers get a subtle adrenaline boost)
    const rankRatio = totalRacers > 1 ? (this.rank - 1) / (totalRacers - 1) : 0;
    const comebackMultiplier = 1.0 + rankRatio * 0.19;
    const desiredForwardSpeed = this.baseSpeed * comebackMultiplier;
    const desiredLateralSpeed = Math.max(-8.0, Math.min(8.0, lateralError * 2.2));

    // Apply steering force to reach desired velocity
    const forceZ = (desiredForwardSpeed - vel.z) * 16.5;
    const forceX = (desiredLateralSpeed - vel.x) * 14.5;

    this.torsoBody.applyImpulse(
      {
        x: forceX * dt,
        y: 0,
        z: Math.max(-10, Math.min(28, forceZ)) * dt,
      },
      true
    );

    // Upright orientation + active joint limb stride
    const yawAngle = Math.atan2(vel.x * 0.6, Math.max(2.0, vel.z));
    const currentSpeed = Math.hypot(vel.x, vel.z);
    this.maintainUprightPose(yawAngle, dt, currentSpeed);

    // Cute bouncy "총총" running hop + random obstacle jump
    this.jumpCooldown -= dt;
    const nearGround = pos.y - expectedFloorY < 2.15 && Math.abs(vel.y) < 2.2;
    if (this.jumpCooldown <= 0 && nearGround) {
      this.jumpCooldown = 1.4 + Math.random() * 2.4;
      const jumpImpulseY = 18 + Math.random() * 8;
      this.torsoBody.applyImpulse(
        {
          x: (Math.random() - 0.5) * 4,
          y: jumpImpulseY,
          z: 5,
        },
        true
      );
      if (onJumpCallback && Math.random() < 0.3) {
        onJumpCallback();
      }
    }

    // Prevent any floor seam or collider penetration from trapping a character inside track bounds
    if (lateralDist <= halfWidth + 0.15 && pos.y < expectedFloorY + 0.55) {
      this.torsoBody.setTranslation(
        { x: pos.x, y: expectedFloorY + 1.15, z: pos.z },
        true
      );
      if (vel.y < 0) {
        this.torsoBody.setLinvel({ x: vel.x, y: 2.5, z: vel.z }, true);
      }
    }

    // Anti-stuck emergency hop if blocked by a wall or mystery door
    if (Math.abs(pos.z - this.lastProgressZ) < 0.35) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.2) {
        this.stuckTimer = 0;
        const centerPull = (centerX - pos.x) * 3.2;
        this.torsoBody.applyImpulse(
          {
            x: Math.max(-18, Math.min(18, centerPull)),
            y: 25,
            z: 14,
          },
          true
        );
      }
    } else {
      this.lastProgressZ = pos.z;
      this.stuckTimer = 0;
    }
  }

  private maintainUprightPose(targetYaw: number, dt: number, speed: number): void {
    // Smoothly align torso rotation upright facing targetYaw
    const currentRot = this.torsoBody.rotation();
    const currentQuat = new THREE.Quaternion(
      currentRot.x,
      currentRot.y,
      currentRot.z,
      currentRot.w
    );
    const forwardTilt = Math.min(0.18, speed * 0.014);
    const targetQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(forwardTilt, targetYaw, 0, 'YXZ')
    );
    currentQuat.slerp(targetQuat, Math.min(1, dt * 12));

    this.torsoBody.setRotation(
      {
        x: currentQuat.x,
        y: currentQuat.y,
        z: currentQuat.z,
        w: currentQuat.w,
      },
      true
    );

    // Damp excessive angular velocity while running upright
    const angVel = this.torsoBody.angvel();
    this.torsoBody.setAngvel(
      {
        x: angVel.x * 0.65,
        y: angVel.y * 0.65,
        z: angVel.z * 0.65,
      },
      true
    );

    // Drive Rapier3D joint motors for active R6 arm & leg running cycle
    this.runCyclePhase += dt * (8.5 + speed * 0.65);
    const swing = Math.sin(this.runCyclePhase) * Math.min(1.15, 0.35 + speed * 0.075);

    this.configureNeckMotor(RAPIER.JointAxis.AngX, -forwardTilt * 0.5, 140, 14);
    this.configureNeckMotor(RAPIER.JointAxis.AngY, 0, 140, 14);
    this.configureNeckMotor(RAPIER.JointAxis.AngZ, 0, 140, 14);

    this.leftShoulderJoint.configureMotorPosition(swing, 160, 16);
    this.rightShoulderJoint.configureMotorPosition(-swing, 160, 16);
    this.leftHipJoint.configureMotorPosition(-swing, 185, 18);
    this.rightHipJoint.configureMotorPosition(swing, 185, 18);
  }

  private configureNeckMotor(
    axis: RAPIER.JointAxis,
    targetPos: number,
    stiffness: number,
    damping: number
  ): void {
    const joint = this.neckJoint as unknown as {
      configureMotorPosition?: (
        axis: RAPIER.JointAxis,
        targetPos: number,
        stiffness: number,
        damping: number
      ) => void;
      rawSet?: {
        jointConfigureMotorPosition: (
          handle: number,
          axis: RAPIER.JointAxis,
          targetPos: number,
          stiffness: number,
          damping: number
        ) => void;
      };
      handle?: number;
    };

    if (typeof joint.configureMotorPosition === 'function') {
      joint.configureMotorPosition(axis, targetPos, stiffness, damping);
    } else if (joint.rawSet && typeof joint.handle === 'number') {
      joint.rawSet.jointConfigureMotorPosition(
        joint.handle,
        axis,
        targetPos,
        stiffness,
        damping
      );
    }
  }

  public markFinished(order: number, timeSec: number): void {
    if (this.state === 'FINISHED') return;
    this.state = 'FINISHED';
    this.finishOrder = order;
    this.finishTime = timeSec;
    this.drawFaceTexture('WINNER');
    this.updateBillboardLabel(true);
  }

  public syncVisuals(isFocused: boolean, cameraPos?: THREE.Vector3): void {
    const syncMeshToBody = (mesh: THREE.Mesh, body: RAPIER.RigidBody) => {
      const p = body.translation();
      const r = body.rotation();
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    };

    const torsoPos = this.torsoBody.translation();

    // Safety leash: if an extreme solver spike separates a limb > 2.2m, snap it back
    const guardLimb = (body: RAPIER.RigidBody, ox: number, oy: number, oz: number) => {
      const lp = body.translation();
      const distSq =
        (lp.x - torsoPos.x) ** 2 + (lp.y - torsoPos.y) ** 2 + (lp.z - torsoPos.z) ** 2;
      if (distSq > 4.8 || Number.isNaN(lp.x)) {
        body.setTranslation(
          { x: torsoPos.x + ox, y: torsoPos.y + oy, z: torsoPos.z + oz },
          true
        );
        body.setLinvel(this.torsoBody.linvel(), true);
      }
    };

    guardLimb(this.headBody, 0, 0.76, 0);
    guardLimb(this.leftArmBody, -0.56, 0.02, 0);
    guardLimb(this.rightArmBody, 0.56, 0.02, 0);
    guardLimb(this.leftLegBody, -0.2, -0.72, 0);
    guardLimb(this.rightLegBody, 0.2, -0.72, 0);

    syncMeshToBody(this.torsoMesh, this.torsoBody);
    syncMeshToBody(this.headMesh, this.headBody);
    syncMeshToBody(this.leftArmMesh, this.leftArmBody);
    syncMeshToBody(this.rightArmMesh, this.rightArmBody);
    syncMeshToBody(this.leftLegMesh, this.leftLegBody);
    syncMeshToBody(this.rightLegMesh, this.rightLegBody);

    // Distance-compensated billboard sprite scale so names are clearly readable on PC & mobile
    const camDist = cameraPos
      ? Math.hypot(
          cameraPos.x - torsoPos.x,
          cameraPos.y - torsoPos.y,
          cameraPos.z - torsoPos.z
        )
      : 14;
    const distScale = Math.max(0.95, Math.min(2.15, camDist / 13.2));
    this.labelSprite.scale.set(2.3 * distScale, 0.65 * distScale, 1);
    this.labelSprite.position.set(
      torsoPos.x,
      torsoPos.y + 1.78 + distScale * 0.22,
      torsoPos.z
    );
    this.labelSprite.renderOrder =
      isFocused || this.isTargetRankCandidate
        ? 1500
        : Math.max(100, 1200 - Math.round(camDist * 8));

    // Selection ring for focused racer or target rank candidate
    this.selectionRing.visible = isFocused || this.isTargetRankCandidate;
    if (this.selectionRing.visible) {
      this.selectionRing.position.set(torsoPos.x, torsoPos.y - 0.98, torsoPos.z);
      const ringMat = this.selectionRing.material as THREE.MeshBasicMaterial;
      ringMat.color.setHex(isFocused ? 0x38bdf8 : 0xfacc15);
    }

    this.updateBillboardLabel();
  }

  public dispose(): void {
    this.scene.remove(
      this.torsoMesh,
      this.headMesh,
      this.leftArmMesh,
      this.rightArmMesh,
      this.leftLegMesh,
      this.rightLegMesh,
      this.selectionRing,
      this.labelSprite
    );
    this.faceTexture.dispose();
    this.labelTexture.dispose();

    // Remove joints before bodies
    this.world.removeImpulseJoint(this.neckJoint, true);
    this.world.removeImpulseJoint(this.leftShoulderJoint, true);
    this.world.removeImpulseJoint(this.rightShoulderJoint, true);
    this.world.removeImpulseJoint(this.leftHipJoint, true);
    this.world.removeImpulseJoint(this.rightHipJoint, true);

    this.world.removeRigidBody(this.headBody);
    this.world.removeRigidBody(this.leftArmBody);
    this.world.removeRigidBody(this.rightArmBody);
    this.world.removeRigidBody(this.leftLegBody);
    this.world.removeRigidBody(this.rightLegBody);
    this.world.removeRigidBody(this.torsoBody);
  }
}
