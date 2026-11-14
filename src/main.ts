import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import confetti from 'canvas-confetti';
import type { CameraMode, MapTheme, ParticipantEntry, WinningRule } from './types';
import { SoundManager } from './audio/SoundManager';
import { ParticleSystem } from './effects/ParticleSystem';
import { RagdollRacer } from './entities/RagdollRacer';
import { FINISH_Z, ObstacleCourse } from './world/ObstacleCourse';
import { CameraDirector } from './camera/CameraDirector';

const PALETTE = [
  { main: '#ef4444', accent: '#b91c1c' },
  { main: '#3b82f6', accent: '#1d4ed8' },
  { main: '#22c55e', accent: '#15803d' },
  { main: '#f59e0b', accent: '#b45309' },
  { main: '#06b6d4', accent: '#0e7490' },
  { main: '#ec4899', accent: '#be185d' },
  { main: '#a855f7', accent: '#7e22ce' },
  { main: '#f97316', accent: '#c2410c' },
  { main: '#14b8a6', accent: '#0f766e' },
  { main: '#eab308', accent: '#a16207' },
  { main: '#6366f1', accent: '#4338ca' },
  { main: '#f43f5e', accent: '#be123c' },
];

const PRESETS: Record<string, string> = {
  class20: Array.from({ length: 20 }, (_, i) => `${i + 1}번`).join(', '),
  coffee:
    '김팀장, 이선임, 박대리, 최사원, 정과장, 강매니저, 조디자이너, 윤개발, 장기획, 한마케터',
  weighted: '김부장*4, 박차장*3, 이과장*2, 최대리*2, 정사원*1, 막내인턴*1',
  mass: Array.from({ length: 28 }, (_, i) => `${i + 1}번`).join(', '),
};

class RagdollDerbyGame {
  private world!: RAPIER.World;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private dirLight!: THREE.DirectionalLight;
  private cameraDirector!: CameraDirector;
  private course!: ObstacleCourse;
  private particles!: ParticleSystem;
  private sound: SoundManager = new SoundManager();
  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  private racers: RagdollRacer[] = [];
  private sortedRacers: RagdollRacer[] = [];
  private finishedRacers: RagdollRacer[] = [];

  private mapTheme: MapTheme = 'PLAYGROUND';
  private winningRule: WinningRule = 'FIRST';
  private targetRank: number = 1;

  private phase: 'READY' | 'COUNTDOWN' | 'RACING' | 'FINISHED' = 'READY';
  private countdownTimer: number | null = null;
  private raceElapsed: number = 0;
  private manualSlowMo: boolean = false;
  private autoSlowMoTimer: number = 0;
  private hasTriggeredAutoSlowMo: boolean = false;
  private winnerAnnounced: boolean = false;

  private lastFrameTime: number = performance.now();
  private uiUpdateAccum: number = 0;

  private isMobileViewport(): boolean {
    return window.innerWidth <= 768;
  }

  public async init(): Promise<void> {
    await RAPIER.init();

    const isMobile = this.isMobileViewport();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('map')?.toUpperCase() === 'TAEKWONDO') {
      this.mapTheme = 'TAEKWONDO';
    }

    // 1. Bright Sunny Daylight Three.js Scene
    const container = document.getElementById('canvas-container')!;
    this.scene = new THREE.Scene();
    if (this.mapTheme === 'TAEKWONDO') {
      this.scene.background = new THREE.Color('#fde68a');
      this.scene.fog = new THREE.FogExp2('#fef3c7', 0.003);
    } else {
      this.scene.background = new THREE.Color('#cce7ff');
      this.scene.fog = new THREE.FogExp2('#e0f2fe', 0.0032);
    }

    const camera = new THREE.PerspectiveCamera(
      isMobile ? 66 : 56,
      window.innerWidth / window.innerHeight,
      0.3,
      360
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.75 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    // 2. Bright Sunny Daylight Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.15);
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    this.dirLight.position.set(24, 44, 16);
    this.dirLight.castShadow = true;
    const shadowRes = isMobile ? 1024 : 2048;
    this.dirLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 140;
    const d = 34;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // 3. Physics World & Course
    this.world = new RAPIER.World({ x: 0, y: -26.0, z: 0 });
    this.particles = new ParticleSystem(this.scene);
    this.course = new ObstacleCourse(this.world, this.scene, this.mapTheme);
    this.cameraDirector = new CameraDirector(camera, this.renderer.domElement);
    this.cameraDirector.updateAspectAndFov(window.innerWidth, window.innerHeight);

    this.cameraDirector.onCanvasTap = (clientX, clientY) => {
      this.handleCanvasTapFocus(clientX, clientY);
    };

    // 4. Bind UI Events & Spawn Initial Racers
    this.bindUIEvents();
    this.syncMapThemeUI();
    this.rebuildRacersFromInput();

    const handleResize = () => {
      this.cameraDirector.updateAspectAndFov(window.innerWidth, window.innerHeight);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 120);
    });

    requestAnimationFrame((now) => this.animate(now));
  }

  private syncMapThemeUI(): void {
    document.querySelectorAll<HTMLButtonElement>('.map-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.map === this.mapTheme);
    });

    const quickMapBtn = document.getElementById('btn-quick-map-toggle');
    if (quickMapBtn) {
      quickMapBtn.textContent =
        this.mapTheme === 'TAEKWONDO' ? '🗺️ 맵2: 🥋 태권도' : '🗺️ 맵1: 🏫 운동장';
      quickMapBtn.classList.toggle('tkd-active', this.mapTheme === 'TAEKWONDO');
    }
  }

  private switchMapTheme(newTheme: MapTheme): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      document.getElementById('countdown-overlay')!.classList.add('hidden');
    }

    this.mapTheme = newTheme;

    if (this.mapTheme === 'TAEKWONDO') {
      this.scene.background = new THREE.Color('#fde68a');
      this.scene.fog = new THREE.FogExp2('#fef3c7', 0.003);
    } else {
      this.scene.background = new THREE.Color('#cce7ff');
      this.scene.fog = new THREE.FogExp2('#e0f2fe', 0.0032);
    }

    this.syncMapThemeUI();

    this.course.dispose();
    this.course = new ObstacleCourse(this.world, this.scene, this.mapTheme);
    this.rebuildRacersFromInput();
  }

  private handleCanvasTapFocus(clientX: number, clientY: number): void {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.cameraDirector.camera);

    let closestRacer: RagdollRacer | null = null;
    let minRayDist = 1.65;

    for (const r of this.racers) {
      const pos = r.getPosition();
      const distToRay = this.raycaster.ray.distanceToPoint(pos);
      if (distToRay < minRayDist) {
        minRayDist = distToRay;
        closestRacer = r;
      }
    }

    if (closestRacer) {
      this.cameraDirector.focusOnRacer(closestRacer.id, (mode) => {
        document.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.cam === mode);
        });
      });
      this.renderLeaderboardUI(false);
    }
  }

  private parseParticipantsText(raw: string): ParticipantEntry[] {
    const tokens = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const entries: ParticipantEntry[] = [];
    let colorIdx = 0;

    for (const token of tokens) {
      const match = token.match(/^(.+?)\*(\d+)$/);
      const baseName = match ? match[1].trim() : token;
      const count = match ? Math.min(20, Math.max(1, parseInt(match[2], 10))) : 1;
      const paletteItem = PALETTE[colorIdx % PALETTE.length];
      colorIdx++;

      for (let i = 0; i < count; i++) {
        if (entries.length >= 48) break;
        const suffix = count > 1 ? `#${i + 1}` : '';
        entries.push({
          id: `racer-${entries.length}-${Math.random().toString(36).slice(2, 6)}`,
          name: `${baseName}${suffix}`,
          color: paletteItem.main,
          accentColor: paletteItem.accent,
        });
      }
      if (entries.length >= 48) break;
    }

    if (entries.length < 2) {
      return [
        { id: 'r-1', name: '1번', color: PALETTE[0].main, accentColor: PALETTE[0].accent },
        { id: 'r-2', name: '2번', color: PALETTE[1].main, accentColor: PALETTE[1].accent },
      ];
    }

    return entries;
  }

  private rebuildRacersFromInput(): void {
    const textarea = document.getElementById('participants-input') as HTMLTextAreaElement;
    const entries = this.parseParticipantsText(textarea.value);

    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }

    for (const r of this.racers) {
      r.dispose();
    }
    this.racers = [];
    this.sortedRacers = [];
    this.finishedRacers = [];
    this.particles.clear();
    this.course.resetCourseState();

    this.phase = 'READY';
    this.raceElapsed = 0;
    this.autoSlowMoTimer = 0;
    this.hasTriggeredAutoSlowMo = false;
    this.winnerAnnounced = false;
    this.setSlowMoVisuals(false);

    document.getElementById('hud-timer')!.textContent = '0.0초';
    document.getElementById('hud-zone-badge')!.textContent = this.course.getZoneLabelAtZ(0);

    const quickStartBtn = document.getElementById('btn-quick-start');
    if (quickStartBtn) quickStartBtn.textContent = '🏁 시작';

    const cols = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(entries.length * 1.5))));
    const spacingX = 1.85;
    const spacingZ = 1.55;

    entries.forEach((entry, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const itemsInRow = Math.min(cols, entries.length - row * cols);
      const z = Math.max(-2.0, 6.2 - row * spacingZ);
      const cx = this.course.getTrackCenterX(z);
      const x = cx + (col - (itemsInRow - 1) * 0.5) * spacingX + (Math.random() - 0.5) * 0.15;
      const y = this.course.getTrackHeightAtZ(z) + 1.45;

      const racer = new RagdollRacer(
        entry,
        idx,
        new THREE.Vector3(x, y, z),
        this.world,
        this.scene,
        this.mapTheme
      );
      this.racers.push(racer);
    });

    this.sortedRacers = [...this.racers];
    this.updateRuleTelemetry();
    this.renderLeaderboardUI(true);
  }

  private updateRuleTelemetry(): void {
    const total = this.racers.length;
    const countBadge = document.getElementById('parsed-count-badge')!;
    const hudRule = document.getElementById('hud-win-rule')!;
    const nthInput = document.getElementById('nth-rank-input') as HTMLInputElement;

    countBadge.textContent = `${total}명 준비됨`;
    nthInput.max = String(total);

    if (this.winningRule === 'FIRST') {
      this.targetRank = 1;
      hudRule.textContent = '🏆 1등 당첨';
    } else if (this.winningRule === 'LAST') {
      this.targetRank = total;
      hudRule.textContent = `💀 꼴찌(${total}등)`;
    } else {
      const requested = Math.max(1, Math.min(total, parseInt(nthInput.value, 10) || 2));
      this.targetRank = requested;
      hudRule.textContent = `🎯 ${requested}등 당첨`;
    }
  }

  private startRaceCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.rebuildRacersFromInput();
    this.phase = 'COUNTDOWN';

    document.getElementById('winner-modal')!.classList.add('hidden');
    document.getElementById('setup-panel')!.classList.add('collapsed');
    document.getElementById('leaderboard-panel')!.classList.add('mobile-collapsed');

    const quickStartBtn = document.getElementById('btn-quick-start');
    if (quickStartBtn) quickStartBtn.textContent = '🔄 재시작';

    const overlay = document.getElementById('countdown-overlay')!;
    const textEl = document.getElementById('countdown-text')!;
    overlay.classList.remove('hidden');

    let step = 3;
    textEl.textContent = '3';
    this.sound.playCountdownBeep(false);

    this.countdownTimer = window.setInterval(() => {
      step--;
      if (step > 0) {
        textEl.textContent = String(step);
        this.sound.playCountdownBeep(false);
      } else if (step === 0) {
        textEl.textContent = 'GO!';
        this.sound.playCountdownBeep(true);
        this.course.openStartGate();
        this.phase = 'RACING';

        for (const r of this.racers) {
          r.state = 'RUNNING';
        }
      } else {
        if (this.countdownTimer !== null) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        overlay.classList.add('hidden');
      }
    }, 620);
  }

  private triggerGlobalRagdollBlast(): void {
    this.sound.playRagdollHit(1.5);
    for (const r of this.racers) {
      if (r.state === 'FINISHED') continue;
      const pos = r.getPosition();
      r.triggerRagdoll(
        {
          x: (Math.random() - 0.5) * 44,
          y: 28 + Math.random() * 18,
          z: (Math.random() - 0.35) * 28,
        },
        {
          x: (Math.random() - 0.5) * 26,
          y: (Math.random() - 0.5) * 26,
          z: (Math.random() - 0.5) * 26,
        },
        1.4
      );
      this.particles.spawnHitBurst(pos, r.color, 6);
    }
  }

  private setSlowMoVisuals(active: boolean): void {
    this.cameraDirector.isClimaxSlowMo = active;
    document.body.classList.toggle('slowmo-active', active);
    document.getElementById('slowmo-banner')!.classList.toggle('hidden', !active);
    document.getElementById('btn-slowmo-toggle')!.classList.toggle('active', active);
  }

  private bindUIEvents(): void {
    const setupPanel = document.getElementById('setup-panel')!;
    const leaderboardPanel = document.getElementById('leaderboard-panel')!;

    const toggleSetup = () => {
      const willOpen = setupPanel.classList.contains('collapsed');
      setupPanel.classList.toggle('collapsed');
      if (willOpen && this.isMobileViewport()) {
        leaderboardPanel.classList.add('mobile-collapsed');
      }
    };

    const toggleLeaderboard = () => {
      const willOpen = leaderboardPanel.classList.contains('mobile-collapsed');
      leaderboardPanel.classList.toggle('mobile-collapsed');
      if (willOpen && this.isMobileViewport()) {
        setupPanel.classList.add('collapsed');
      }
    };

    document.getElementById('btn-toggle-setup')!.addEventListener('click', toggleSetup);
    document.getElementById('btn-close-setup')!.addEventListener('click', () => {
      setupPanel.classList.add('collapsed');
    });

    document.getElementById('btn-toggle-leaderboard')!.addEventListener('click', toggleLeaderboard);
    document.getElementById('btn-close-leaderboard')!.addEventListener('click', () => {
      leaderboardPanel.classList.add('mobile-collapsed');
    });

    document.getElementById('btn-quick-start')!.addEventListener('click', () => {
      this.startRaceCountdown();
    });

    document.getElementById('btn-quick-map-toggle')!.addEventListener('click', () => {
      const nextTheme: MapTheme = this.mapTheme === 'PLAYGROUND' ? 'TAEKWONDO' : 'PLAYGROUND';
      this.switchMapTheme(nextTheme);
    });

    document.querySelectorAll<HTMLButtonElement>('.map-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.map as MapTheme;
        if (theme && theme !== this.mapTheme) {
          this.switchMapTheme(theme);
        }
      });
    });

    const textarea = document.getElementById('participants-input') as HTMLTextAreaElement;
    textarea.addEventListener('input', () => {
      if (this.phase === 'READY') {
        this.rebuildRacersFromInput();
      }
    });

    document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.preset!;
        if (PRESETS[key]) {
          textarea.value = PRESETS[key];
          this.rebuildRacersFromInput();
        }
      });
    });

    const nthRow = document.getElementById('nth-rank-row')!;
    document.querySelectorAll<HTMLButtonElement>('.rule-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rule-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.winningRule = btn.dataset.rule as WinningRule;
        nthRow.classList.toggle('hidden', this.winningRule !== 'NTH');
        this.updateRuleTelemetry();
      });
    });

    document.getElementById('nth-rank-input')!.addEventListener('input', () => {
      this.updateRuleTelemetry();
    });

    document.getElementById('btn-start-race')!.addEventListener('click', () => {
      this.startRaceCountdown();
    });

    document.getElementById('btn-shuffle-racers')!.addEventListener('click', () => {
      this.rebuildRacersFromInput();
    });

    document.getElementById('btn-blast-test')!.addEventListener('click', () => {
      this.triggerGlobalRagdollBlast();
    });

    const btnSound = document.getElementById('btn-sound-toggle')!;
    btnSound.addEventListener('click', () => {
      const muted = this.sound.toggleMute();
      btnSound.textContent = muted ? '🔇' : '🔊';
      btnSound.classList.toggle('muted', muted);
    });

    const btnBgm = document.getElementById('btn-bgm-toggle')!;
    btnBgm.addEventListener('click', () => {
      if (this.sound.bgmPlaying) {
        this.sound.stopArcadeBgm();
        btnBgm.classList.add('muted');
      } else {
        this.sound.startArcadeBgm();
        btnBgm.classList.remove('muted');
      }
    });

    const updateCameraButtons = (activeMode: CameraMode) => {
      document.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.cam === activeMode);
      });
    };

    document.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.cam as CameraMode;
        this.cameraDirector.setMode(mode, updateCameraButtons);
      });
    });

    const toggleManualSlowMo = () => {
      this.manualSlowMo = !this.manualSlowMo;
      if (this.manualSlowMo) {
        this.sound.playSlowMoTrigger();
      }
      this.setSlowMoVisuals(this.manualSlowMo || this.autoSlowMoTimer > 0);
    };

    document.getElementById('btn-slowmo-toggle')!.addEventListener('click', toggleManualSlowMo);

    window.addEventListener('keydown', (e) => {
      if (
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'INPUT'
      ) {
        return;
      }
      if (e.key === '1') this.cameraDirector.setMode('LEAD', updateCameraButtons);
      if (e.key === '2') this.cameraDirector.setMode('LAST', updateCameraButtons);
      if (e.key === '3') this.cameraDirector.setMode('TOP', updateCameraButtons);
      if (e.key === '4') this.cameraDirector.setMode('FREE', updateCameraButtons);
      if (e.code === 'Space') {
        e.preventDefault();
        toggleManualSlowMo();
      }
    });

    document.getElementById('btn-modal-rematch')!.addEventListener('click', () => {
      this.startRaceCountdown();
    });
    document.getElementById('btn-modal-close')!.addEventListener('click', () => {
      document.getElementById('winner-modal')!.classList.add('hidden');
      if (!this.isMobileViewport()) {
        setupPanel.classList.remove('collapsed');
      }
    });
  }

  private renderLeaderboardUI(rebuildDOM: boolean = false): void {
    const listEl = document.getElementById('leaderboard-list')!;
    const dotsEl = document.getElementById('minimap-dots')!;
    const leaderboardPanel = document.getElementById('leaderboard-panel')!;

    if (rebuildDOM) {
      listEl.innerHTML = '';
      dotsEl.innerHTML = '';

      for (const r of this.sortedRacers) {
        const item = document.createElement('div');
        item.className = 'leader-item';
        item.id = `leader-row-${r.id}`;
        item.addEventListener('click', () => {
          this.cameraDirector.focusOnRacer(r.id, (mode) => {
            document.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach((btn) => {
              btn.classList.toggle('active', btn.dataset.cam === mode);
            });
          });
          if (this.isMobileViewport()) {
            leaderboardPanel.classList.add('mobile-collapsed');
          }
          this.renderLeaderboardUI(false);
        });
        listEl.appendChild(item);

        const dot = document.createElement('div');
        dot.className = 'minimap-dot';
        dot.id = `minimap-dot-${r.id}`;
        dot.style.backgroundColor = r.color;
        dotsEl.appendChild(dot);
      }
    }

    this.sortedRacers.forEach((r, idx) => {
      const rank = idx + 1;
      r.rank = rank;
      r.isTargetRankCandidate = rank === this.targetRank;

      const rowEl = document.getElementById(`leader-row-${r.id}`);
      if (rowEl) {
        rowEl.style.order = String(rank);
        rowEl.className = 'leader-item';
        if (rank === 1) rowEl.classList.add('rank-1');
        else if (rank === 2) rowEl.classList.add('rank-2');
        else if (rank === 3) rowEl.classList.add('rank-3');
        if (this.cameraDirector.focusedRacerId === r.id) rowEl.classList.add('focused');
        if (rank === this.targetRank) rowEl.classList.add('target-winner');

        let badgeHtml = '';
        if (r.state === 'FINISHED') {
          badgeHtml = `<span class="state-pill goal">🏁</span>`;
        } else if (r.state === 'RAGDOLL') {
          badgeHtml = `<span class="state-pill ragdoll">💫</span>`;
        }

        rowEl.innerHTML = `
          <span class="leader-rank">${rank}</span>
          <span class="leader-swatch" style="background:${r.color}"></span>
          <span class="leader-name">${r.name}</span>
          <span class="leader-meta">${badgeHtml}</span>
        `;
      }

      const dotEl = document.getElementById(`minimap-dot-${r.id}`);
      if (dotEl) {
        const pct = Math.min(97, Math.max(2, (r.getPosition().z / FINISH_Z) * 93));
        dotEl.style.left = `${pct}%`;
        dotEl.style.zIndex = rank === this.targetRank ? '10' : '2';
      }
    });

    // Update Zone Badge based on leader's current track position
    if (this.sortedRacers.length > 0) {
      const leadZ = this.sortedRacers[0].getPosition().z;
      const zoneEl = document.getElementById('hud-zone-badge');
      if (zoneEl) {
        zoneEl.textContent = this.course.getZoneLabelAtZ(leadZ);
      }
    }
  }

  private announceWinner(winner: RagdollRacer): void {
    this.winnerAnnounced = true;
    this.autoSlowMoTimer = 0;
    this.manualSlowMo = false;
    this.setSlowMoVisuals(false);

    this.cameraDirector.focusedRacerId = winner.id;
    this.sound.playFinishChime(true);

    confetti({
      particleCount: 110,
      spread: 80,
      origin: { y: 0.55 },
    });

    const modal = document.getElementById('winner-modal')!;
    const badge = document.getElementById('modal-rule-badge')!;
    const title = document.getElementById('modal-winner-name')!;
    const desc = document.getElementById('modal-winner-desc')!;
    const statRank = document.getElementById('modal-winner-rank')!;
    const statTime = document.getElementById('modal-winner-time')!;
    const statRagdolls = document.getElementById('modal-winner-ragdolls')!;
    const rankList = document.getElementById('modal-rankings-list')!;

    badge.textContent =
      this.winningRule === 'FIRST'
        ? '🏆 1등 우승 당첨자 발표'
        : this.winningRule === 'LAST'
        ? '💀 최후의 꼴찌 당첨자 발표'
        : `🎯 목표 순위 (${this.targetRank}등) 당첨자 발표`;

    title.textContent = winner.name;
    title.style.color = winner.color;
    desc.textContent = `총 ${winner.ragdollCount}번의 장애물 충돌과 래그돌 몸싸움을 뚫고 #${winner.finishOrder}위로 결승선을 통과했습니다!`;

    statRank.textContent = `#${winner.finishOrder}위`;
    statTime.textContent = `${(winner.finishTime || this.raceElapsed).toFixed(2)}초`;
    statRagdolls.textContent = `💥 ${winner.ragdollCount}회`;

    rankList.innerHTML = '';
    this.sortedRacers.forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = `modal-rank-row ${r.id === winner.id ? 'is-winner' : ''}`;
      const statusStr =
        r.finishOrder !== null
          ? `${r.finishTime?.toFixed(2)}s (💥${r.ragdollCount})`
          : `주행 중 (💥${r.ragdollCount})`;
      row.innerHTML = `
        <span>#${idx + 1} · ${r.name}</span>
        <span>${statusStr}</span>
      `;
      rankList.appendChild(row);
    });

    modal.classList.remove('hidden');
  }

  private animate(now: number): void {
    requestAnimationFrame((t) => this.animate(t));

    const realDt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const decisiveRacer =
      this.sortedRacers[Math.min(this.sortedRacers.length - 1, this.targetRank - 1)] ||
      this.sortedRacers[0] ||
      null;

    if (
      this.phase === 'RACING' &&
      !this.hasTriggeredAutoSlowMo &&
      !this.winnerAnnounced &&
      decisiveRacer &&
      decisiveRacer.state !== 'FINISHED'
    ) {
      const z = decisiveRacer.getPosition().z;
      if (z >= FINISH_Z - 11.5 && z < FINISH_Z) {
        this.hasTriggeredAutoSlowMo = true;
        this.autoSlowMoTimer = 2.3;
        this.sound.playSlowMoTrigger();
        this.setSlowMoVisuals(true);
      }
    }

    if (this.autoSlowMoTimer > 0) {
      this.autoSlowMoTimer -= realDt;
      if (this.autoSlowMoTimer <= 0 && !this.manualSlowMo) {
        this.setSlowMoVisuals(false);
      }
    }

    const isSlowMo = this.manualSlowMo || this.autoSlowMoTimer > 0;
    const timeScale = isSlowMo ? 0.22 : 1.0;
    const simDt = realDt * timeScale;

    if (this.phase === 'RACING') {
      this.raceElapsed += simDt;
      document.getElementById('hud-timer')!.textContent = `${this.raceElapsed.toFixed(1)}초`;
    }

    this.course.update(simDt, this.racers, this.particles, this.sound);

    for (const r of this.racers) {
      r.updateAIAndPhysics(
        simDt,
        this.racers.length,
        (z) => this.course.getTrackCenterX(z),
        (z) => this.course.getTrackHalfWidthAtZ(z),
        (z) => this.course.getTrackHeightAtZ(z),
        () => this.sound.playJump(),
        (respawnPos) => this.particles.spawnRespawnFlash(respawnPos)
      );

      if (this.phase === 'RACING' && r.state !== 'FINISHED') {
        const pos = r.getPosition();
        const withinTrackWidth =
          Math.abs(pos.x - this.course.getTrackCenterX(pos.z)) <=
          this.course.getTrackHalfWidthAtZ(pos.z) + 0.9;
        if (pos.z >= FINISH_Z && withinTrackWidth) {
          this.finishedRacers.push(r);
          const order = this.finishedRacers.length;
          r.markFinished(order, this.raceElapsed);
          this.sound.playFinishChime(order === this.targetRank);

          if (order === this.targetRank && !this.winnerAnnounced) {
            this.announceWinner(r);
          }

          if (this.finishedRacers.length === this.racers.length) {
            this.phase = 'FINISHED';
          }
        }
      }
    }

    this.world.timestep = Math.max(0.002, simDt);
    this.world.step();

    this.particles.update(simDt);

    this.sortedRacers.sort((a, b) => {
      if (a.finishOrder !== null && b.finishOrder !== null) {
        return a.finishOrder - b.finishOrder;
      }
      if (a.finishOrder !== null) return -1;
      if (b.finishOrder !== null) return 1;
      return b.getPosition().z - a.getPosition().z;
    });

    for (const r of this.racers) {
      r.syncVisuals(this.cameraDirector.focusedRacerId === r.id);
    }

    if (this.sortedRacers.length > 0) {
      const leadPos = (decisiveRacer || this.sortedRacers[0]).getPosition();
      this.dirLight.position.set(leadPos.x + 22, leadPos.y + 40, leadPos.z - 12);
      this.dirLight.target.position.copy(leadPos);
    }

    this.cameraDirector.update(
      realDt,
      this.sortedRacers,
      decisiveRacer,
      (z) => this.course.getTrackCenterX(z)
    );

    this.uiUpdateAccum += realDt;
    if (this.uiUpdateAccum >= 0.08) {
      this.uiUpdateAccum = 0;
      this.renderLeaderboardUI(false);
    }

    this.renderer.render(this.scene, this.cameraDirector.camera);
  }
}

const game = new RagdollDerbyGame();
game.init().catch((err) => {
  console.error('Failed to initialize Ragdoll Derby 3D:', err);
});
