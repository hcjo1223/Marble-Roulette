import * as THREE from 'three';
import type { RagdollRacer } from '../../entities/RagdollRacer';
import type { ParticleSystem } from '../../effects/ParticleSystem';
import type { SoundManager } from '../../audio/SoundManager';
import { getTrackCenterX, getTrackHeightAtZ } from '../courseMath';
import type {
  ConveyorData,
  MysteryDoorData,
  PendulumData,
  PinballBumperData,
  PopupBumperData,
  ShockwaveDrumData,
  SlidingShieldData,
  SpringboardData,
  SweeperData,
  WindFanData,
} from '../courseTypes';

export interface SharedObstacleLists {
  sweepers: SweeperData[];
  mysteryDoors: MysteryDoorData[];
  popupBumpers: PopupBumperData[];
  pinballBumpers: PinballBumperData[];
  windFans: WindFanData[];
  conveyors: ConveyorData[];
  pendulums: PendulumData[];
  slidingShields: SlidingShieldData[];
  springboards: SpringboardData[];
  shockwaveDrums: ShockwaveDrumData[];
}

export function resetMysteryDoors(mysteryDoors: MysteryDoorData[]): void {
  const grouped = new Map<number, MysteryDoorData[]>();
  for (const door of mysteryDoors) {
    const list = grouped.get(door.rowGroup) || [];
    list.push(door);
    grouped.set(door.rowGroup, list);
  }

  for (const doors of grouped.values()) {
    const passableTarget = Math.max(2, Math.ceil(doors.length * 0.55));
    const flags = Array.from({ length: doors.length }, (_, i) => i < passableTarget);
    for (let i = flags.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [flags[i], flags[j]] = [flags[j], flags[i]];
    }
    doors.forEach((door, idx) => {
      door.isPassable = flags[idx];
      door.isOpened = false;
      door.openAngle = 0;
      door.hitCooldowns.clear();
      door.pivotGroup.rotation.set(0, door.yaw, 0);
      door.collider.setSensor(false);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, door.yaw, 0));
      door.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    });
  }
}

/** 회전 막대 넉백의 뒤쪽(-z) 성분 하한. */
const SWEEPER_MAX_BACKWARD_Z = -10;

export function updateSharedObstacles(
  lists: SharedObstacleLists,
  dt: number,
  elapsedTime: number,
  racers: RagdollRacer[],
  particles: ParticleSystem,
  sound: SoundManager
): void {
  // 2. Rotating Sweepers
  for (const sw of lists.sweepers) {
    sw.angle += sw.speed * dt;
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sw.angle);
    sw.mesh.quaternion.copy(quat);
    sw.body.setNextKinematicRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });

    for (const r of racers) {
      if (r.state === 'FINISHED') continue;
      const lastHit = sw.hitCooldowns.get(r.id) || 0;
      if (elapsedTime - lastHit < 0.55) continue;

      const rPos = r.getPosition();
      const dx = rPos.x - sw.center.x;
      const dz = rPos.z - sw.center.z;
      if (Math.abs(rPos.y - sw.center.y) > 1.7) continue;

      for (let b = 0; b < sw.blades; b++) {
        const bladeAngle = sw.angle + (b * Math.PI * 2) / sw.blades;
        const bx = Math.cos(bladeAngle);
        const bz = -Math.sin(bladeAngle);
        const along = dx * bx + dz * bz;
        const perp = -dx * bz + dz * bx;

        if (along >= 0 && along <= sw.armLength + 0.5 && Math.abs(perp) <= 0.8) {
          sw.hitCooldowns.set(r.id, elapsedTime);
          const tangentX = -bz * Math.sign(sw.speed);
          const tangentZ = bx * Math.sign(sw.speed);
          r.triggerRagdoll(
            {
              x: tangentX * 34 + (Math.random() - 0.5) * 8,
              y: 24 + Math.random() * 10,
              // 뒤로 튕기는 힘은 제한: 최대 -29까지 밀려 15m 넘게 후퇴하던 것을 막는다
              z: Math.max(SWEEPER_MAX_BACKWARD_Z, tangentZ * 24 - 5),
            },
            undefined,
            1.25
          );
          particles.spawnHitBurst(rPos, '#38bdf8', 10);
          sound.playRagdollHit(1.2);
          break;
        }
      }
    }
  }

  // 3. Sliding Taekwondo Shields / Triceratops Chargers / Mustang Boss Obstacles
  for (const sh of lists.slidingShields) {
    const cx = getTrackCenterX(sh.baseZ);
    const curX = cx + Math.sin(elapsedTime * sh.freq + sh.phase) * sh.ampX;
    const vx = curX - sh.lastX;
    sh.lastX = curX;

    if (sh.mesh.userData.isMustangBoss || sh.mesh.userData.isCharacterBoss) {
      const walkCycle = elapsedTime * 7.2 + sh.phase;
      const bounceY = Math.abs(Math.sin(walkCycle)) * 0.14;
      const trackYaw = (sh.mesh.userData.trackYaw as number) || 0;
      sh.mesh.position.set(curX, sh.baseY + bounceY, sh.baseZ);
      if (Math.abs(vx) > 0.0002) {
        sh.mesh.rotation.y = Math.PI + trackYaw - Math.sign(vx) * 0.28;
      }
      const bodyPivot = sh.mesh.userData.bodyPivot as THREE.Group | undefined;
      if (bodyPivot) {
        bodyPivot.rotation.set(0.06, 0, Math.sin(walkCycle) * 0.08);
      }
      if (!sh.mesh.userData.hasGlbModel) {
        const stride = Math.sin(walkCycle) * 0.65;
        const leftLeg = sh.mesh.userData.leftLegPivot as THREE.Group | undefined;
        const rightLeg = sh.mesh.userData.rightLegPivot as THREE.Group | undefined;
        const leftArm = sh.mesh.userData.leftArmPivot as THREE.Group | undefined;
        const rightArm = sh.mesh.userData.rightArmPivot as THREE.Group | undefined;
        if (leftLeg && rightLeg) {
          leftLeg.rotation.x = stride;
          rightLeg.rotation.x = -stride;
        }
        if (leftArm && rightArm) {
          leftArm.rotation.x = -stride * 0.85;
          rightArm.rotation.x = stride * 0.85;
        }
      }
      sh.body.setNextKinematicTranslation({ x: curX, y: sh.baseY + sh.halfH, z: sh.baseZ });
    } else {
      sh.mesh.position.set(curX, sh.baseY, sh.baseZ);
      if (sh.mesh.userData.isCharger && Math.abs(vx) > 0.0004) {
        sh.mesh.rotation.y = vx >= 0 ? 0 : Math.PI;
      }
      sh.body.setNextKinematicTranslation({ x: curX, y: sh.baseY, z: sh.baseZ });
    }

    for (const r of racers) {
      if (r.state === 'FINISHED') continue;
      const lastHit = sh.hitCooldowns.get(r.id) || 0;
      if (elapsedTime - lastHit < 0.55) continue;

      const rPos = r.getPosition();
      if (
        Math.abs(rPos.x - curX) < sh.halfW + 0.55 &&
        Math.abs(rPos.z - sh.baseZ) < sh.halfD + 0.65 &&
        Math.abs(rPos.y - sh.baseY) < sh.halfH * 2 + 0.8
      ) {
        sh.hitCooldowns.set(r.id, elapsedTime);
        const pushDirX = Math.sign(vx) || (rPos.x >= curX ? 1 : -1);
        r.triggerRagdoll(
          {
            x: pushDirX * 36 + (Math.random() - 0.5) * 6,
            y: 22 + Math.random() * 8,
            z: -14,
          },
          undefined,
          1.2
        );
        particles.spawnHitBurst(rPos, '#facc15', 12);
        sound.playRagdollHit(1.25);
      }
    }
  }

  // 4. Taekwondo Vaulting Springboards
  for (const sb of lists.springboards) {
    const cx = getTrackCenterX(sb.z);
    const wx = cx + sb.offsetX;
    const wy = getTrackHeightAtZ(sb.z);

    for (const r of racers) {
      if (r.state === 'FINISHED') continue;
      const lastHit = sb.hitCooldowns.get(r.id) || 0;
      if (elapsedTime - lastHit < 0.9) continue;

      const rPos = r.getPosition();
      if (
        Math.abs(rPos.x - wx) < sb.halfW &&
        Math.abs(rPos.z - sb.z) < sb.halfL &&
        rPos.y - wy < 1.8
      ) {
        sb.hitCooldowns.set(r.id, elapsedTime);
        r.torsoBody.applyImpulse(
          { x: (Math.random() - 0.5) * 6, y: sb.boostY, z: sb.boostZ },
          true
        );
        particles.spawnHitBurst(rPos, '#facc15', 8);
        sound.playBumperBounce();
      }
    }
  }

  // 5. Mystery / Pinewood / Roof-Tile Breaking Doors
  for (const door of lists.mysteryDoors) {
    if (door.isOpened && door.openAngle < Math.PI * 0.48) {
      door.openAngle = Math.min(Math.PI * 0.48, door.openAngle + dt * 6.5);
      door.pivotGroup.rotation.y = door.yaw;
      door.pivotGroup.rotation.x = -door.openAngle;
    }
    if (door.isOpened) continue;

    for (const r of racers) {
      if (r.state === 'FINISHED') continue;
      const lastHit = door.hitCooldowns.get(r.id) || 0;
      if (elapsedTime - lastHit < 0.5) continue;

      const rPos = r.getPosition();
      const dist = Math.hypot(rPos.x - door.basePos.x, rPos.z - door.basePos.z);
      if (dist < 1.85 && Math.abs(rPos.y - door.basePos.y) < 2.2) {
        door.hitCooldowns.set(r.id, elapsedTime);
        if (door.isPassable) {
          door.isOpened = true;
          door.collider.setSensor(true);
          particles.spawnHitBurst(door.basePos, '#fbbf24', 14);
          sound.playBumperBounce();
        } else {
          r.triggerRagdoll(
            {
              x: (Math.random() - 0.5) * 14,
              y: 16,
              z: -24,
            },
            undefined,
            1.05
          );
          particles.spawnHitBurst(rPos, '#f43f5e', 10);
          sound.playRagdollHit(1.1);
        }
        break;
      }
    }
  }

  // 6. Pop-up Floor Bumpers
  for (const pb of lists.popupBumpers) {
    const wave = Math.sin(elapsedTime * pb.freq + pb.phase);
    const popRatio = wave > 0.5 ? (wave - 0.5) * 2.0 : 0;
    const curY = pb.basePos.y - 0.55 + popRatio * 1.45;
    pb.mesh.position.y = curY;
    pb.body.setNextKinematicTranslation({ x: pb.basePos.x, y: curY, z: pb.basePos.z });

    if (popRatio > 0.25) {
      for (const r of racers) {
        if (r.state === 'FINISHED') continue;
        const lastHit = pb.hitCooldowns.get(r.id) || 0;
        if (elapsedTime - lastHit < 0.65) continue;

        const rPos = r.getPosition();
        if (
          Math.hypot(rPos.x - pb.basePos.x, rPos.z - pb.basePos.z) < pb.radius + 0.55 &&
          Math.abs(rPos.y - pb.basePos.y) < 2.2
        ) {
          pb.hitCooldowns.set(r.id, elapsedTime);
          r.triggerRagdoll(
            {
              x: (rPos.x - pb.basePos.x) * 16 + (Math.random() - 0.5) * 10,
              y: 40 + Math.random() * 10,
              z: -6 + Math.random() * 14,
            },
            undefined,
            1.3
          );
          particles.spawnHitBurst(rPos, '#10b981', 12);
          sound.playBumperBounce();
        }
      }
    }
  }

  // 7. Pinball / Slalom Posts
  for (const pin of lists.pinballBumpers) {
    if (pin.pulseScale > 1.0) {
      pin.pulseScale = Math.max(1.0, pin.pulseScale - dt * 4.5);
      pin.mesh.scale.set(pin.pulseScale, 1, pin.pulseScale);
    }
    for (const r of racers) {
      if (r.state === 'FINISHED') continue;
      const lastHit = pin.hitCooldowns.get(r.id) || 0;
      if (elapsedTime - lastHit < 0.45) continue;

      const rPos = r.getPosition();
      const dx = rPos.x - pin.pos.x;
      const dz = rPos.z - pin.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < pin.radius + 0.65 && Math.abs(rPos.y - pin.pos.y) < 1.8) {
        pin.hitCooldowns.set(r.id, elapsedTime);
        pin.pulseScale = 1.38;
        r.triggerRagdoll(
          { x: (dx / (dist || 1)) * 34, y: 18, z: (dz / (dist || 1)) * 30 },
          undefined,
          1.0
        );
        particles.spawnHitBurst(rPos, '#ec4899', 8);
        sound.playBumperBounce();
      }
    }
  }

  // 8. Conveyor / Poomsae Step Belts
  for (const conv of lists.conveyors) {
    conv.texture.offset.y -= conv.speedZ * dt * 0.12;
    for (const r of racers) {
      if (r.state === 'FINISHED') continue;
      const rPos = r.getPosition();
      if (rPos.z < conv.zMin || rPos.z > conv.zMax) continue;
      const latOffset = rPos.x - getTrackCenterX(rPos.z);
      if (
        latOffset >= conv.sideOffsetMin &&
        latOffset <= conv.sideOffsetMax &&
        rPos.y - getTrackHeightAtZ(rPos.z) < 2.2
      ) {
        r.torsoBody.applyImpulse({ x: 0, y: 0, z: conv.speedZ * 3.4 * dt }, true);
      }
    }
  }

  // 9. Wind Fans (Map 1)
  for (const fan of lists.windFans) {
    fan.bladesMesh.rotation.x += dt * 16 * fan.dirX;
    const posAttr = fan.streamParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const pz = posAttr.getZ(i);
      const cx = getTrackCenterX(pz);
      let px = posAttr.getX(i) + fan.dirX * 18 * dt;
      if (fan.dirX > 0 && px > cx + 8.5) px = cx - 8.5;
      if (fan.dirX < 0 && px < cx - 8.5) px = cx + 8.5;
      posAttr.setX(i, px);
    }
    posAttr.needsUpdate = true;

    for (const r of racers) {
      if (r.state === 'FINISHED') continue;
      const rPos = r.getPosition();
      if (rPos.z >= fan.zMin && rPos.z <= fan.zMax) {
        r.torsoBody.applyImpulse(
          { x: fan.dirX * fan.force * dt, y: 1.5 * dt, z: -2.0 * dt },
          true
        );
      }
    }
  }

  // 10. Kiai Shockwave War Drums (Map 2)
  for (const sd of lists.shockwaveDrums) {
    const cycle = (((elapsedTime * sd.freq * 0.45 + sd.phase) % 1) + 1) % 1;
    const zMid = (sd.zMin + sd.zMax) * 0.5;
    const cx = getTrackCenterX(zMid);
    const yMid = getTrackHeightAtZ(zMid) + 1.8;
    const waveX = cx + sd.side * 9.0 + sd.dirX * cycle * 18.0;

    sd.waveMesh.position.set(waveX, yMid, zMid);
    const scale = 0.8 + cycle * 1.1;
    sd.waveMesh.scale.set(scale, scale, 1);
    (sd.waveMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 1.0 - cycle);

    const drumPulse = cycle < 0.15 ? 1.18 : 1.0;
    sd.drumMesh.scale.set(drumPulse, drumPulse, drumPulse);

    for (const r of racers) {
      if (r.state === 'FINISHED') continue;
      const lastHit = sd.hitCooldowns.get(r.id) || 0;
      if (elapsedTime - lastHit < 0.75) continue;

      const rPos = r.getPosition();
      if (
        rPos.z >= sd.zMin &&
        rPos.z <= sd.zMax &&
        Math.abs(rPos.x - waveX) < 1.8 &&
        rPos.y - getTrackHeightAtZ(rPos.z) < 3.6
      ) {
        sd.hitCooldowns.set(r.id, elapsedTime);
        r.triggerRagdoll({ x: sd.dirX * 32, y: 16, z: -6 }, undefined, 0.95);
        particles.spawnHitBurst(rPos, '#facc15', 8);
        sound.playRagdollHit(0.95);
      }
    }
  }

  // 11. Zone 4 Swinging Pendulums / Hanging Heavy Sandbags
  for (const pend of lists.pendulums) {
    const swingAngle = Math.sin(elapsedTime * pend.freq + pend.phase) * pend.maxAngle;
    const angularVel = Math.cos(elapsedTime * pend.freq + pend.phase) * pend.freq * pend.maxAngle;

    pend.pivotGroup.rotation.z = swingAngle;
    const localX = Math.sin(swingAngle) * pend.armLength;
    const localY = -Math.cos(swingAngle) * pend.armLength;

    const hammerX = pend.pivotPos.x + Math.cos(pend.yaw) * localX;
    const hammerY = pend.pivotPos.y + localY;
    const hammerZ = pend.pivotPos.z - Math.sin(pend.yaw) * localX;

    pend.body.setNextKinematicTranslation({ x: hammerX, y: hammerY, z: hammerZ });

    for (const r of racers) {
      if (r.state === 'FINISHED') continue;
      const lastHit = pend.hitCooldowns.get(r.id) || 0;
      if (elapsedTime - lastHit < 0.6) continue;

      const rPos = r.getPosition();
      if (Math.hypot(rPos.x - hammerX, rPos.y - hammerY, rPos.z - hammerZ) < 2.0) {
        pend.hitCooldowns.set(r.id, elapsedTime);
        const dirX = Math.sign(angularVel) || 1;
        r.triggerRagdoll(
          { x: dirX * 38, y: 26, z: -10 + Math.random() * 14 },
          undefined,
          1.4
        );
        particles.spawnHitBurst(rPos, '#ef4444', 14);
        sound.playRagdollHit(1.5);
      }
    }
  }
}
