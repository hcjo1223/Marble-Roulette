import * as THREE from 'three';
import type { MapTheme } from '../types';
import { TRACK_SLOPE, getTrackCenterX, getTrackHeightAtZ } from './courseMath';

/**
 * Builds a curved ribbon mesh whose every vertex sits strictly at
 * y = getTrackHeightAtZ(z) + yOffset, guaranteeing zero floor sinking or z-fighting
 * even along steep S-curves!
 */
export function createCurvedFloorStripGeometry(
  zMin: number,
  zMax: number,
  sideOffsetMin: number,
  sideOffsetMax: number,
  yOffset: number = 0.08,
  slices: number = 14
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const totalLen = zMax - zMin;
  const ny = Math.cos(TRACK_SLOPE);
  const nz = Math.sin(TRACK_SLOPE);

  for (let i = 0; i <= slices; i++) {
    const t = i / slices;
    const z = zMin + totalLen * t;
    const cx = getTrackCenterX(z);
    const y = getTrackHeightAtZ(z) + yOffset;

    const xL = cx + sideOffsetMin;
    const xR = cx + sideOffsetMax;

    positions.push(xL, y, z, xR, y, z);
    normals.push(0, ny, nz, 0, ny, nz);
    uvs.push(0, t, 1, t);

    if (i < slices) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1);
      indices.push(base + 1, base + 2, base + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function createWoodFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#facc6b';
  ctx.fillRect(0, 0, 256, 256);

  const plankWidth = 32;
  for (let x = 0; x < 256; x += plankWidth) {
    ctx.fillStyle = (x / plankWidth) % 2 === 0 ? '#fcd34d' : '#f5be4f';
    ctx.fillRect(x, 0, plankWidth, 256);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(180, 83, 9, 0.35)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

export function createTaekwondoMatTexture(c1: string, c2: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = c2;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillRect(128, 128, 128, 128);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 120, 120);
  ctx.strokeRect(132, 4, 120, 120);
  ctx.strokeRect(4, 132, 120, 120);
  ctx.strokeRect(132, 132, 120, 120);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

export function createPastelTileTexture(c1: string, c2: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = c2;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillRect(128, 128, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createAthleticTrackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#fff7ed';
  for (let i = 1; i < 6; i++) {
    ctx.fillRect((256 / 6) * i - 2, 0, 4, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createCheckeredTexture(
  c1: string,
  c2: string,
  rx: number,
  ry: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = c2;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillRect(64, 64, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
}

export function createConveyorTexture(mapTheme: MapTheme, isBoost: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const isTkd = mapTheme === 'TAEKWONDO';
  const isDino = mapTheme === 'DINOSAUR';
  const isPool = mapTheme === 'POOL';
  ctx.fillStyle = isBoost
    ? isPool
      ? '#22d3ee'
      : isTkd
      ? '#2563eb'
      : isDino
      ? '#ea580c'
      : '#10b981'
    : isPool
    ? '#0369a1'
    : isTkd
    ? '#dc2626'
    : isDino
    ? '#4c1d95'
    : '#f43f5e';
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = isPool
    ? isBoost
      ? '#ecfeff'
      : '#bae6fd'
    : isTkd
    ? '#fef08a'
    : isDino
    ? isBoost
      ? '#fef08a'
      : '#fb7185'
    : '#ffffff';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  if (isBoost) {
    ctx.moveTo(24, 88);
    ctx.lineTo(64, 36);
    ctx.lineTo(104, 88);
  } else {
    ctx.moveTo(24, 36);
    ctx.lineTo(64, 88);
    ctx.lineTo(104, 36);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createSlimeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#7ff06a';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = 'rgba(214, 255, 200, 0.75)';
  for (const [bx, by, br] of [
    [24, 26, 9],
    [78, 14, 6],
    [104, 54, 11],
    [46, 74, 7],
    [86, 98, 9],
    [16, 108, 6],
  ]) {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(46, 160, 40, 0.35)';
  ctx.lineWidth = 6;
  for (let y = 18; y < 128; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(36, y - 12, 92, y + 12, 128, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createWaterWaveTexture(dirX: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, '#0284c7');
  grad.addColorStop(0.5, '#0ea5e9');
  grad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  // White water ripple chevrons pointing in dirX (+1 right / -1 left)
  ctx.strokeStyle = 'rgba(240, 253, 255, 0.88)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const cy of [34, 94]) {
    ctx.beginPath();
    if (dirX >= 0) {
      ctx.moveTo(28, cy - 20);
      ctx.lineTo(68, cy);
      ctx.lineTo(28, cy + 20);
      ctx.moveTo(68, cy - 20);
      ctx.lineTo(104, cy);
      ctx.lineTo(68, cy + 20);
    } else {
      ctx.moveTo(100, cy - 20);
      ctx.lineTo(60, cy);
      ctx.lineTo(100, cy + 20);
      ctx.moveTo(60, cy - 20);
      ctx.lineTo(24, cy);
      ctx.lineTo(60, cy + 20);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
