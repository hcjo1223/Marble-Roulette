import * as THREE from 'three';

interface BurstParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
  initialScale: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: BurstParticle[] = [];
  private pool: THREE.Mesh[] = [];
  private matCache: Map<string, THREE.MeshBasicMaterial> = new Map();
  private boxGeo: THREE.BoxGeometry;
  private starGeo: THREE.OctahedronGeometry;
  private maxParticles: number;

  constructor(scene: THREE.Scene, isMobile: boolean = false) {
    this.scene = scene;
    this.boxGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    this.starGeo = new THREE.OctahedronGeometry(0.22, 0);
    this.maxParticles = isMobile ? 90 : 200;
  }

  private getMaterial(colorHex: string): THREE.MeshBasicMaterial {
    let mat = this.matCache.get(colorHex);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
      });
      this.matCache.set(colorHex, mat);
    }
    return mat;
  }

  private acquireMesh(useStar: boolean, mat: THREE.MeshBasicMaterial): THREE.Mesh {
    const recycled = this.pool.pop();
    if (recycled) {
      recycled.geometry = useStar ? this.starGeo : this.boxGeo;
      recycled.material = mat;
      recycled.visible = true;
      return recycled;
    }
    const mesh = new THREE.Mesh(useStar ? this.starGeo : this.boxGeo, mat);
    mesh.frustumCulled = true;
    return mesh;
  }

  private releaseMesh(mesh: THREE.Mesh): void {
    this.scene.remove(mesh);
    if (this.pool.length < this.maxParticles) {
      this.pool.push(mesh);
    }
  }

  public spawnHitBurst(position: THREE.Vector3, colorHex: string = '#f59e0b', count: number = 10): void {
    const mat = this.getMaterial(colorHex);
    const available = Math.max(2, Math.min(count, this.maxParticles - this.particles.length));

    for (let i = 0; i < available; i++) {
      const mesh = this.acquireMesh(i % 2 === 0, mat);
      mesh.position.copy(position);
      const scale = 0.65 + Math.random() * 0.75;
      mesh.scale.setScalar(scale);

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 6.5;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.5 + Math.random() * 5.5,
        Math.sin(angle) * speed
      );

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        rotSpeed,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.3,
        initialScale: scale,
      });
    }
  }

  public spawnRespawnFlash(position: THREE.Vector3): void {
    this.spawnHitBurst(position, '#38bdf8', 10);
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.releaseMesh(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      p.velocity.y -= 18 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.rotation.x += p.rotSpeed.x * dt;
      p.mesh.rotation.y += p.rotSpeed.y * dt;
      p.mesh.rotation.z += p.rotSpeed.z * dt;

      const t = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(p.initialScale * t);
    }
  }

  public clear(): void {
    for (const p of this.particles) {
      this.releaseMesh(p.mesh);
    }
    this.particles = [];
  }
}
