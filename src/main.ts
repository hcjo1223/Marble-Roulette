import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type {
  CameraMode,
  FlickMode,
  MapTheme,
  ObstacleDensity,
  WinningRule,
} from './types';
import { SoundManager } from './audio/SoundManager';
import { ParticleSystem } from './effects/ParticleSystem';
import { RagdollRacer } from './entities/RagdollRacer';
import { ObstacleCourse } from './world/ObstacleCourse';
import { CameraDirector } from './camera/CameraDirector';
import {
  PRESETS,
  applySkyTheme,
  getFinishFlickBannerMessage,
  getManualFlickBusyMessage,
  getNextFlickMode,
  getNextMapTheme,
  parseInitialRaceOptions,
  parseParticipantsText,
} from './game/mapThemeConfig';
import {
  hideHudBanner,
  renderLeaderboardUI,
  setSlowMoHud,
  showHudBanner,
  showWinnerModal,
  syncCameraButtons,
  syncDensityUI,
  syncFlickModeUI,
  syncMapThemeUI,
  updateRuleTelemetryUI,
} from './ui/raceHud';

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
  private obstacleDensity: ObstacleDensity = 'NORMAL';
  private flickMode: FlickMode = 'DOUBLE';
  private winningRule: WinningRule = 'FIRST';
  private targetRank: number = 1;

  private phase: 'READY' | 'COUNTDOWN' | 'RACING' | 'FINISHED' = 'READY';
  private countdownTimer: number | null = null;
  private raceElapsed: number = 0;
  private manualSlowMo: boolean = false;
  private autoSlowMoTimer: number = 0;
  private hasTriggeredAutoSlowMo: boolean = false;
  private flickBannerTimer: number = 0;
  private winnerAnnounced: boolean = false;

  private lastFrameTime: number = performance.now();
  private uiUpdateAccum: number = 0;

  private isMobileViewport(): boolean {
    return window.innerWidth <= 768;
  }

  public async init(): Promise<void> {
    await RAPIER.init();

    const isMobile = this.isMobileViewport();
    const initial = parseInitialRaceOptions(window.location.search);
    this.mapTheme = initial.mapTheme;
    this.obstacleDensity = initial.obstacleDensity;
    this.flickMode = initial.flickMode;

    // 1. Bright Sunny Daylight Three.js Scene
    const container = document.getElementById('canvas-container')!;
    this.scene = new THREE.Scene();
    applySkyTheme(this.scene, this.mapTheme);

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
    this.course = new ObstacleCourse(
      this.world,
      this.scene,
      this.mapTheme,
      this.obstacleDensity,
      this.flickMode
    );
    this.bindCourseCallbacks();
    this.cameraDirector = new CameraDirector(camera, this.renderer.domElement);
    this.cameraDirector.updateAspectAndFov(window.innerWidth, window.innerHeight);

    this.cameraDirector.onCanvasTap = (clientX, clientY) => {
      this.handleCanvasTapFocus(clientX, clientY);
    };

    // 4. Bind UI Events & Spawn Initial Racers
    // 폴가이즈 UI는 기본 고정값: 토글 없이 항상 적용한다
    document.body.classList.add('theme-fallguys');
    this.bindUIEvents();
    syncMapThemeUI(this.mapTheme, this.flickMode);
    syncDensityUI(this.obstacleDensity);
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

  private showBannerMessage(msg: string, duration: number = 2.2): void {
    showHudBanner(msg);
    this.flickBannerTimer = duration;
  }

  private bindCourseCallbacks(): void {
    this.course.onFinishFlick = (racer, flickNum, isManual) => {
      this.showBannerMessage(
        getFinishFlickBannerMessage(this.mapTheme, racer.name, flickNum, isManual)
      );
    };

    this.course.onPoolSplash = (racer, kind) => {
      const icon = kind === 'DUCK' ? '🦆' : '💦';
      this.showBannerMessage(
        `${icon} 물벼락 강타! [${racer.name}] 크게 튕겨나갔다! 대역전 찬스!`,
        2.0
      );
    };
  }

  private switchFlickMode(newMode: FlickMode): void {
    this.flickMode = newMode;
    syncFlickModeUI(this.mapTheme, newMode);
    this.course.setFlickMode(newMode);
  }

  private switchMapTheme(newTheme: MapTheme): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      document.getElementById('countdown-overlay')!.classList.add('hidden');
    }

    this.mapTheme = newTheme;
    applySkyTheme(this.scene, this.mapTheme);
    syncMapThemeUI(this.mapTheme, this.flickMode);

    this.course.dispose();
    this.course = new ObstacleCourse(
      this.world,
      this.scene,
      this.mapTheme,
      this.obstacleDensity,
      this.flickMode
    );
    this.bindCourseCallbacks();
    this.rebuildRacersFromInput();
  }

  private switchObstacleDensity(newDensity: ObstacleDensity): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      document.getElementById('countdown-overlay')!.classList.add('hidden');
    }

    this.obstacleDensity = newDensity;
    syncDensityUI(this.obstacleDensity);

    this.course.dispose();
    this.course = new ObstacleCourse(
      this.world,
      this.scene,
      this.mapTheme,
      this.obstacleDensity,
      this.flickMode
    );
    this.bindCourseCallbacks();
    this.rebuildRacersFromInput();
  }

  private focusOnRacer(racerId: string, collapseOnMobile: boolean = false): void {
    this.cameraDirector.focusOnRacer(racerId, syncCameraButtons);
    if (collapseOnMobile && this.isMobileViewport()) {
      document.getElementById('leaderboard-panel')!.classList.add('mobile-collapsed');
    }
    this.renderLeaderboard(false);
  }

  private handleCanvasTapFocus(clientX: number, clientY: number): void {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.cameraDirector.camera);

    let closestRacer: RagdollRacer | null = null;
    let minRayDist = 2.15;
    const focusCenter = new THREE.Vector3();

    for (const r of this.racers) {
      const pos = r.getPosition();
      focusCenter.set(pos.x, pos.y + 0.45, pos.z);
      const distToRay = this.raycaster.ray.distanceToPoint(focusCenter);
      if (distToRay < minRayDist) {
        minRayDist = distToRay;
        closestRacer = r;
      }
    }

    if (closestRacer) {
      this.focusOnRacer(closestRacer.id);
    }
  }

  private rebuildRacersFromInput(): void {
    const textarea = document.getElementById('participants-input') as HTMLTextAreaElement;
    const entries = parseParticipantsText(textarea.value);

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
    this.flickBannerTimer = 0;
    this.winnerAnnounced = false;
    this.setSlowMoVisuals(false);
    hideHudBanner();

    document.getElementById('hud-timer')!.textContent = '0.0초';
    document.getElementById('hud-zone-badge')!.textContent = this.course.getZoneLabelAtZ(0);

    const quickStartBtn = document.getElementById('btn-quick-start');
    if (quickStartBtn) quickStartBtn.textContent = '🏁 시작';

    const cols = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(entries.length * 1.5))));
    const isDinoKart = this.mapTheme === 'DINOSAUR';
    const spacingX = isDinoKart ? 1.95 : 1.85;
    const spacingZ = isDinoKart ? 2.0 : 1.55;

    entries.forEach((entry, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const itemsInRow = Math.min(cols, entries.length - row * cols);
      const z = Math.max(-3.0, (isDinoKart ? 6.6 : 6.2) - row * spacingZ);
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
    this.targetRank = updateRuleTelemetryUI(this.winningRule, this.racers.length);
    this.renderLeaderboard(true);
  }

  private renderLeaderboard(rebuildDOM: boolean = false): void {
    renderLeaderboardUI(
      this.sortedRacers,
      this.cameraDirector.focusedRacerId,
      this.targetRank,
      this.course.finishZ,
      (z) => this.course.getZoneLabelAtZ(z),
      (racerId) => this.focusOnRacer(racerId, true),
      rebuildDOM
    );
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
        if (this.mapTheme === 'DINOSAUR') {
          this.sound.playDinoRoar();
        }
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
    this.showBannerMessage('💥 사범님 장난! 전체 래그돌 충격파 발사!', 1.8);
  }

  private triggerGlobalBigJump(): void {
    this.sound.playBigJump();
    for (const r of this.racers) {
      if (r.state === 'FINISHED') continue;
      const pos = r.getPosition();
      r.setAllBodiesLinvel({
        x: (Math.random() - 0.5) * 8,
        y: 22 + Math.random() * 8,
        z: 6 + Math.random() * 6,
      });
      r.triggerRagdoll(
        {
          x: (Math.random() - 0.5) * 14,
          y: 34 + Math.random() * 12,
          z: 8 + Math.random() * 8,
        },
        {
          x: (Math.random() - 0.5) * 18,
          y: (Math.random() - 0.5) * 18,
          z: (Math.random() - 0.5) * 18,
        },
        1.1
      );
      this.particles.spawnHitBurst(pos, '#38bdf8', 7);
    }
    this.showBannerMessage('🚀 사범님 장난! 전원 하늘로 대점프!!', 1.8);
  }

  private triggerWhirlwindPrank(): void {
    this.sound.playWhirlwind();
    for (const r of this.racers) {
      if (r.state === 'FINISHED') continue;
      const pos = r.getPosition();
      const cx = this.course.getTrackCenterX(pos.z);
      const offset = pos.x - cx;
      const crossDir = offset >= 0 ? -1 : 1;
      r.triggerRagdoll(
        {
          x: crossDir * (34 + Math.random() * 14),
          y: 18 + Math.random() * 10,
          z: (Math.random() - 0.5) * 32,
        },
        {
          x: (Math.random() - 0.5) * 24,
          y: crossDir * 28,
          z: (Math.random() - 0.5) * 24,
        },
        1.3
      );
      this.particles.spawnHitBurst(pos, '#a855f7', 7);
    }
    this.showBannerMessage('🌀 사범님 장난! 회오리 바람으로 자리 대혼란!', 1.8);
  }

  private triggerManualFlickPrank(): void {
    const target = this.course.triggerManualLeaderFlick(this.racers);
    if (!target) {
      this.showBannerMessage(getManualFlickBusyMessage(this.mapTheme), 1.3);
    }
  }

  private setSlowMoVisuals(active: boolean): void {
    this.cameraDirector.isClimaxSlowMo = active;
    setSlowMoHud(active);
  }

  private bindUIEvents(): void {
    const setupPanel = document.getElementById('setup-panel')!;
    const leaderboardPanel = document.getElementById('leaderboard-panel')!;

    document.getElementById('btn-toggle-setup')!.addEventListener('click', () => {
      const willOpen = setupPanel.classList.contains('collapsed');
      setupPanel.classList.toggle('collapsed');
      if (willOpen && this.isMobileViewport()) {
        leaderboardPanel.classList.add('mobile-collapsed');
      }
    });
    document.getElementById('btn-close-setup')!.addEventListener('click', () => {
      setupPanel.classList.add('collapsed');
    });

    document.getElementById('btn-toggle-leaderboard')!.addEventListener('click', () => {
      const willOpen = leaderboardPanel.classList.contains('mobile-collapsed');
      leaderboardPanel.classList.toggle('mobile-collapsed');
      if (willOpen && this.isMobileViewport()) {
        setupPanel.classList.add('collapsed');
      }
    });
    document.getElementById('btn-close-leaderboard')!.addEventListener('click', () => {
      leaderboardPanel.classList.add('mobile-collapsed');
    });

    document.getElementById('btn-quick-start')!.addEventListener('click', () => {
      this.startRaceCountdown();
    });

    document.getElementById('btn-quick-map-toggle')!.addEventListener('click', () => {
      this.switchMapTheme(getNextMapTheme(this.mapTheme));
    });

    document.querySelectorAll<HTMLButtonElement>('.map-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.map as MapTheme;
        if (theme && theme !== this.mapTheme) {
          this.switchMapTheme(theme);
        }
      });
    });

    document.getElementById('btn-quick-density-toggle')!.addEventListener('click', () => {
      this.switchObstacleDensity(this.obstacleDensity === 'NORMAL' ? 'LIGHT' : 'NORMAL');
    });

    document.querySelectorAll<HTMLButtonElement>('.density-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const density = btn.dataset.density as ObstacleDensity;
        if (density && density !== this.obstacleDensity) {
          this.switchObstacleDensity(density);
        }
      });
    });

    document.getElementById('btn-quick-flick-toggle')!.addEventListener('click', () => {
      this.switchFlickMode(getNextFlickMode(this.flickMode));
    });

    document.querySelectorAll<HTMLButtonElement>('.flick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.flick as FlickMode;
        if (mode && mode !== this.flickMode) {
          this.switchFlickMode(mode);
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
        this.targetRank = updateRuleTelemetryUI(this.winningRule, this.racers.length);
      });
    });

    document.getElementById('nth-rank-input')!.addEventListener('input', () => {
      this.targetRank = updateRuleTelemetryUI(this.winningRule, this.racers.length);
    });

    document.getElementById('btn-start-race')!.addEventListener('click', () => {
      this.startRaceCountdown();
    });

    document.getElementById('btn-shuffle-racers')!.addEventListener('click', () => {
      this.rebuildRacersFromInput();
    });

    document.getElementById('btn-prank-blast')!.addEventListener('click', () => {
      this.triggerGlobalRagdollBlast();
    });
    document.getElementById('btn-prank-jump')!.addEventListener('click', () => {
      this.triggerGlobalBigJump();
    });
    document.getElementById('btn-prank-whirl')!.addEventListener('click', () => {
      this.triggerWhirlwindPrank();
    });
    document.getElementById('btn-prank-flick')!.addEventListener('click', () => {
      this.triggerManualFlickPrank();
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

    document.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.cam as CameraMode;
        this.cameraDirector.setMode(mode, syncCameraButtons);
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
      if (e.key === '1') this.cameraDirector.setMode('LEAD', syncCameraButtons);
      if (e.key === '2') this.cameraDirector.setMode('LAST', syncCameraButtons);
      if (e.key === '3') this.cameraDirector.setMode('TOP', syncCameraButtons);
      if (e.key === '4') this.cameraDirector.setMode('FREE', syncCameraButtons);
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

  private announceWinner(winner: RagdollRacer): void {
    this.winnerAnnounced = true;
    this.autoSlowMoTimer = 0;
    this.manualSlowMo = false;
    this.setSlowMoVisuals(false);

    this.cameraDirector.focusedRacerId = winner.id;
    this.sound.playFinishChime(true);

    showWinnerModal(
      winner,
      this.sortedRacers,
      this.winningRule,
      this.targetRank,
      this.raceElapsed
    );
  }

  private animate(now: number): void {
    requestAnimationFrame((t) => this.animate(t));

    const realDt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const decisiveRacer =
      this.sortedRacers[Math.min(this.sortedRacers.length - 1, this.targetRank - 1)] ||
      this.sortedRacers[0] ||
      null;

    const remainingFlicks = this.course.getRemainingFinishFlicks(this.racers.length);
    const finishZ = this.course.finishZ;
    if (
      this.phase === 'RACING' &&
      !this.hasTriggeredAutoSlowMo &&
      !this.winnerAnnounced &&
      decisiveRacer &&
      decisiveRacer.state !== 'FINISHED'
    ) {
      const z = decisiveRacer.getPosition().z;
      const canSlowMo =
        remainingFlicks === 0 ||
        (z >= finishZ - 3.2 && this.course.hasBeenFlicked(decisiveRacer.id));
      if (canSlowMo && z >= finishZ - 9.0 && z < finishZ) {
        this.hasTriggeredAutoSlowMo = true;
        this.autoSlowMoTimer = 2.3;
        this.sound.playSlowMoTrigger();
        this.setSlowMoVisuals(true);
      }
    }

    if (this.flickBannerTimer > 0) {
      this.flickBannerTimer -= realDt;
      if (this.flickBannerTimer <= 0) {
        hideHudBanner();
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

    this.course.update(
      simDt,
      this.racers,
      this.particles,
      this.sound,
      this.phase === 'RACING',
      this.cameraDirector.camera.position
    );

    for (const r of this.racers) {
      r.updateAIAndPhysics(
        simDt,
        this.racers.length,
        (z) => this.course.getTrackCenterX(z),
        (z) => this.course.getTrackHalfWidthAtZ(z),
        (z) => this.course.getTrackHeightAtZ(z),
        () => this.sound.playJump(),
        (respawnPos) => this.particles.spawnRespawnFlash(respawnPos),
        finishZ
      );

      if (this.phase === 'RACING' && r.state !== 'FINISHED') {
        const pos = r.getPosition();
        const withinTrackWidth =
          Math.abs(pos.x - this.course.getTrackCenterX(pos.z)) <=
          this.course.getTrackHalfWidthAtZ(pos.z) + 0.9;
        if (pos.z >= finishZ && withinTrackWidth) {
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
      r.syncVisuals(
        this.cameraDirector.focusedRacerId === r.id,
        this.cameraDirector.camera.position
      );
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
      (z) => this.course.getTrackCenterX(z),
      finishZ
    );

    this.uiUpdateAccum += realDt;
    if (this.uiUpdateAccum >= 0.08) {
      this.uiUpdateAccum = 0;
      this.renderLeaderboard(false);
    }

    this.renderer.render(this.scene, this.cameraDirector.camera);
  }
}

const game = new RagdollDerbyGame();
game.init().catch((err) => {
  console.error('Failed to initialize Ragdoll Derby 3D:', err);
});
