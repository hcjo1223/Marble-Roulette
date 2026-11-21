import './style.css';
import * as THREE from 'three';
import type RAPIER_NS from '@dimforge/rapier3d';
let RAPIER: typeof RAPIER_NS;
import type {
  CameraMode,
  FlickMode,
  MapTheme,
  ObstacleDensity,
  WinningRule,
} from './types';
import type { CustomCourseLayout } from './editor/editorTypes';
import type { MapEditor } from './editor/MapEditor';
import { SoundManager } from './audio/SoundManager';
import { ParticleSystem } from './effects/ParticleSystem';
import { RagdollRacer } from './entities/RagdollRacer';
import { ObstacleCourse } from './world/ObstacleCourse';
import { CameraDirector } from './camera/CameraDirector';
import { HighlightPipDirector } from './camera/HighlightPipDirector';
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
import { PerfTelemetry } from './game/perfTelemetry';
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


/** 결승 직전 자동 슬로모션의 최대 누적 시간(실제 초). 보통은 당첨 대상이 통과하는 순간 끝난다. */
const AUTO_SLOWMO_MAX_SEC = 30;
/** 당첨 대상이 결승선 이 거리(m) 안에 있을 때만 실제로 슬로모션을 건다 (시작 조건 9m + 여유 1m). */
const AUTO_SLOWMO_RANGE_Z = 10;

/** 물리 시뮬레이션 고정 스텝(초). */
const PHYSICS_STEP = 1 / 60;
/** 한 렌더 프레임에서 따라잡을 수 있는 최대 물리 스텝 수(0.2초 분량 = 5fps까지 실시간 유지). */
const MAX_PHYSICS_STEPS_PER_FRAME = 12;
/** 프레임 간격 상한(초). 탭 복귀 직후 같은 큰 공백만 잘라낸다. */
const MAX_FRAME_DT = 0.25;

/**
 * vsync 지터(16.4ms/16.9ms 등)로 고정 스텝 개수가 0/2로 흔들려 끊겨 보이는 것을 막기 위해,
 * 프레임 간격이 1/60초의 정수배에 아주 가까우면 그 값으로 맞춘다.
 */
function snapFrameDt(dt: number): number {
  const ratio = dt / PHYSICS_STEP;
  const nearest = Math.round(ratio);
  if (nearest >= 1 && nearest <= 4 && Math.abs(ratio - nearest) < 0.08) {
    return nearest * PHYSICS_STEP;
  }
  return dt;
}

class RagdollDerbyGame {
  private world!: RAPIER_NS.World;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private dirLight!: THREE.DirectionalLight;
  private cameraDirector!: CameraDirector;
  private highlightPip!: HighlightPipDirector;
  private course!: ObstacleCourse;
  private particles!: ParticleSystem;
  private sound: SoundManager = new SoundManager();
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private perfTelemetry!: PerfTelemetry;
  private mapEditor: MapEditor | null = null;
  private activeCustomLayout: CustomCourseLayout | null = null;

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
  /** 결승 자동 슬로모션 남은 허용 시간(실제 초). 0보다 크면 "결승 슬로모션 모드". */
  private autoSlowMoTimer: number = 0;
  /** 지금 실제로 슬로모션이 걸려 있는지 (대상이 결승 구간 밖이면 잠시 해제). */
  private autoSlowMoActive: boolean = false;
  private hasTriggeredAutoSlowMo: boolean = false;
  private flickBannerTimer: number = 0;
  private winnerAnnounced: boolean = false;

  private lastFrameTime: number = performance.now();
  private physicsAccumulator: number = 0;
  private uiUpdateAccum: number = 0;

  private isMobileViewport(): boolean {
    return window.innerWidth <= 768;
  }

  private updateAdaptiveQuality(racerCount: number): void {
    const isMobile = this.isMobileViewport();
    const targetDpr = isMobile
      ? racerCount >= 28
        ? 1.0
        : 1.25
      : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(targetDpr);

    if (this.world) {
      this.world.integrationParameters.numSolverIterations = racerCount >= 30 ? 2 : 4;
      this.world.integrationParameters.numInternalPgsIterations = racerCount >= 30 ? 1 : 2;
    }
  }

  private syncCustomBannerUI(): void {
    const banner = document.getElementById('custom-map-banner');
    const label = document.getElementById('custom-map-label');
    if (!banner || !label) return;
    if (this.activeCustomLayout && this.activeCustomLayout.obstacles.length > 0) {
      banner.classList.remove('hidden');
      label.textContent = `🛠️ 커스텀 맵 (${this.activeCustomLayout.obstacles.length}개 배치)`;
    } else if (this.activeCustomLayout?.clearBaseObstacles) {
      banner.classList.remove('hidden');
      label.textContent = `🛠️ 빈 트랙 커스텀 모드`;
    } else {
      banner.classList.add('hidden');
    }
  }

  public async init(): Promise<void> {
    RAPIER = await import('@dimforge/rapier3d');

    const urlParams = new URLSearchParams(window.location.search);
    this.perfTelemetry = new PerfTelemetry(
      urlParams.get('perf') === '1' || urlParams.has('bench')
    );

    const isMobile = this.isMobileViewport();
    const initial = parseInitialRaceOptions(window.location.search);
    this.mapTheme = initial.mapTheme;
    this.obstacleDensity = initial.obstacleDensity;
    this.flickMode = initial.flickMode;

    const customParam = urlParams.get('custom');
    const hasSavedCustom = Boolean(localStorage.getItem('marble_roulette_custom_layout_v1'));
    if (customParam || hasSavedCustom) {
      const { decodeCustomLayoutFromUrlParam, loadSavedCustomLayout } = await import(
        './editor/MapEditor'
      );
      const loaded = customParam
        ? decodeCustomLayoutFromUrlParam(customParam)
        : loadSavedCustomLayout();
      if (loaded && (loaded.obstacles.length > 0 || loaded.clearBaseObstacles)) {
        this.activeCustomLayout = loaded;
        this.mapTheme = loaded.baseMap;
      }
    }
    this.sound.setMapTheme(this.mapTheme);

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
      antialias: !isMobile,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(
      isMobile ? 1.25 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    // 2. Bright Sunny Daylight Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.15);
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    this.dirLight.position.set(24, 44, 16);
    this.dirLight.castShadow = true;
    const shadowRes = isMobile ? 512 : 2048;
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
    this.particles = new ParticleSystem(this.scene, isMobile);
    this.course = new ObstacleCourse(
      this.world,
      this.scene,
      this.mapTheme,
      this.obstacleDensity,
      this.flickMode,
      isMobile,
      this.activeCustomLayout
    );
    this.bindCourseCallbacks();
    this.cameraDirector = new CameraDirector(camera, this.renderer.domElement);
    this.cameraDirector.updateAspectAndFov(window.innerWidth, window.innerHeight);
    this.highlightPip = new HighlightPipDirector((racerId) => this.focusOnRacer(racerId));

    this.cameraDirector.onCanvasTap = (clientX, clientY) => {
      this.handleCanvasTapFocus(clientX, clientY);
    };

    // 4. Bind UI Events & Spawn Initial Racers
    // 폴가이즈 UI는 기본 고정값: 토글 없이 항상 적용한다
    document.body.classList.add('theme-fallguys');
    this.bindUIEvents();
    syncMapThemeUI(this.mapTheme, this.flickMode);
    syncDensityUI(this.obstacleDensity);
    this.syncCustomBannerUI();

    const benchCount = parseInt(urlParams.get('bench') || '', 10);
    if (Number.isFinite(benchCount) && benchCount >= 2) {
      const clamped = Math.min(48, benchCount);
      const textarea = document.getElementById('participants-input') as HTMLTextAreaElement;
      textarea.value = Array.from({ length: clamped }, (_, i) => `${i + 1}번`).join(', ');
    }

    this.rebuildRacersFromInput();

    if (urlParams.get('autostart') === '1') {
      document.getElementById('setup-panel')!.classList.add('collapsed');
      document.getElementById('leaderboard-panel')!.classList.add('mobile-collapsed');
      this.course.openStartGate();
      this.phase = 'RACING';
      for (const r of this.racers) {
        r.state = 'RUNNING';
      }
    }

    const handleResize = () => {
      this.cameraDirector.updateAspectAndFov(window.innerWidth, window.innerHeight);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.updateAdaptiveQuality(this.racers.length);
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

    // 수영장 HUD 원칙: 하이라이트 미니 화면은 "메인 화면에 안 보이는" 물벼락·오리 피격만 보여 준다.
    // 튜브 탑승·파도 피격은 메인 화면 연출(파티클·관중)로 충분해 배너·미니 화면을 띄우지 않는다.
    this.course.onPoolSplash = (racer, kind) => {
      const isDuck = kind === 'DUCK';
      const hiddenFromMainCam = !this.cameraDirector.isOnScreen(racer.getPosition());
      const pipShown =
        hiddenFromMainCam &&
        this.highlightPip.tryTrigger({
          racer,
          kind: isDuck ? 'DUCK' : 'SPLASH',
          subtitle: isDuck ? '거대 고무오리 직격! 데굴데굴!' : '물풍선 맞고 빙글빙글!',
          suppress: this.isHighlightSuppressed(),
        });
      // 미니 화면이 떴으면 배너는 생략 (같은 사건을 두 번 알리지 않음)
      if (!pipShown) {
        this.showBannerMessage(
          `${isDuck ? '🦆' : '💦'} 물벼락 강타! [${racer.name}] 크게 튕겨나갔다! 대역전 찬스!`,
          2.0
        );
      }
    };

    this.course.onTubeMount = undefined;
    this.course.onWaveHit = undefined;
  }

  /** 결승 직전(아직 아무도 통과 전, 미완주 선두가 결승 18m 이내)과 결승 슬로모션 중에는 미니 화면을 띄우지 않는다. */
  private isHighlightSuppressed(): boolean {
    if (this.manualSlowMo || this.autoSlowMoTimer > 0) return true;
    if (this.finishedRacers.length > 0) return false;
    const lead = this.sortedRacers.find((r) => r.state !== 'FINISHED');
    return Boolean(lead && lead.getPosition().z >= this.course.finishZ - 18);
  }

  private rebuildCourse(): void {
    this.sound.setMapTheme(this.mapTheme);
    applySkyTheme(this.scene, this.mapTheme);
    syncMapThemeUI(this.mapTheme, this.flickMode);
    syncDensityUI(this.obstacleDensity);
    this.syncCustomBannerUI();

    this.course.dispose();
    this.course = new ObstacleCourse(
      this.world,
      this.scene,
      this.mapTheme,
      this.obstacleDensity,
      this.flickMode,
      this.isMobileViewport(),
      this.activeCustomLayout
    );
    this.bindCourseCallbacks();
    this.rebuildRacersFromInput();
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
    this.activeCustomLayout = null;
    if (this.mapEditor?.getIsOpen()) {
      this.mapEditor.close();
      this.cameraDirector.editorMode = false;
      document.getElementById('btn-toggle-editor')?.classList.remove('active');
    }
    this.rebuildCourse();
  }

  private switchObstacleDensity(newDensity: ObstacleDensity): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      document.getElementById('countdown-overlay')!.classList.add('hidden');
    }

    this.obstacleDensity = newDensity;
    this.rebuildCourse();
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

    this.highlightPip?.reset();

    this.phase = 'READY';
    this.raceElapsed = 0;
    this.autoSlowMoTimer = 0;
    this.autoSlowMoActive = false;
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
    const lowCostMode = this.isMobileViewport() || entries.length >= 24;

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
        this.mapTheme,
        lowCostMode
      );
      racer.setRespawnCheckpoints(this.course.respawnCheckpoints);
      this.racers.push(racer);
    });

    this.updateAdaptiveQuality(entries.length);
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

    if (this.mapEditor?.getIsOpen()) {
      this.mapEditor.close();
      this.cameraDirector.editorMode = false;
      this.cameraDirector.setMode('LEAD', syncCameraButtons);
      document.getElementById('btn-toggle-editor')?.classList.remove('active');
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
        this.sound.startArcadeBgm(this.mapTheme);
        btnBgm.classList.remove('muted');
      }
    });

    const btnEditor = document.getElementById('btn-toggle-editor');
    btnEditor?.addEventListener('click', async () => {
      if (!this.mapEditor) {
        const { MapEditor } = await import('./editor/MapEditor');
        this.mapEditor = new MapEditor(
          {
            getScene: () => this.scene,
            getCamera: () => this.cameraDirector.camera,
            getDomElement: () => this.renderer.domElement,
            getCurrentMapTheme: () => this.mapTheme,
            onLayoutChanged: (layout, previewZ) => {
              this.activeCustomLayout =
                layout && (layout.obstacles.length > 0 || layout.clearBaseObstacles)
                  ? layout
                  : null;
              if (layout) {
                this.mapTheme = layout.baseMap;
              }
              this.rebuildCourse();
              if (typeof previewZ === 'number') {
                this.cameraDirector.setTopPanZ(previewZ);
              }
            },
            onStartRace: (layout) => {
              this.activeCustomLayout =
                layout.obstacles.length > 0 || layout.clearBaseObstacles ? layout : null;
              this.mapTheme = layout.baseMap;
              this.mapEditor?.close();
              this.cameraDirector.editorMode = false;
              this.cameraDirector.setMode('LEAD', syncCameraButtons);
              btnEditor.classList.remove('active');
              this.rebuildCourse();
              this.startRaceCountdown();
            },
            onCloseEditor: () => {
              this.cameraDirector.editorMode = false;
              this.cameraDirector.setMode('LEAD', syncCameraButtons);
              btnEditor.classList.remove('active');
            },
            onPreviewZ: (z) => {
              this.cameraDirector.setTopPanZ(z);
            },
          },
          this.activeCustomLayout
        );
      }

      if (this.mapEditor.getIsOpen()) {
        this.mapEditor.close();
        this.cameraDirector.editorMode = false;
        this.cameraDirector.setMode('LEAD', syncCameraButtons);
        btnEditor.classList.remove('active');
      } else {
        setupPanel.classList.add('collapsed');
        leaderboardPanel.classList.add('mobile-collapsed');
        this.cameraDirector.editorMode = true;
        this.cameraDirector.setMode('TOP', syncCameraButtons);
        this.mapEditor.open();
        btnEditor.classList.add('active');
      }
    });

    document.getElementById('btn-clear-custom-map')?.addEventListener('click', async () => {
      this.activeCustomLayout = null;
      const { saveCustomLayout } = await import('./editor/MapEditor');
      saveCustomLayout(null);
      this.rebuildCourse();
    });

    const btnPerf = document.getElementById('btn-toggle-perf');
    btnPerf?.addEventListener('click', () => {
      const next = !this.perfTelemetry.enabled;
      this.perfTelemetry.setEnabled(next);
      btnPerf.classList.toggle('active', next);
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
      this.setSlowMoVisuals(this.manualSlowMo || this.autoSlowMoActive);
    };

    document.getElementById('btn-slowmo-toggle')!.addEventListener('click', toggleManualSlowMo);

    window.addEventListener('keydown', (e) => {
      if (
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT'
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
    this.autoSlowMoActive = false;
    this.manualSlowMo = false;
    this.setSlowMoVisuals(false);
    this.highlightPip.hide(false);

    this.cameraDirector.focusedRacerId = winner.id;
    this.course.triggerCrowdExcitement(1.5, 3.5);
    this.sound.playFinishChime(true);

    this.renderer.render(this.scene, this.cameraDirector.camera);
    let screenshotDataUrl: string | null = null;
    try {
      screenshotDataUrl = this.renderer.domElement.toDataURL('image/png');
    } catch {
      screenshotDataUrl = null;
    }

    showWinnerModal(
      winner,
      this.sortedRacers,
      this.winningRule,
      this.targetRank,
      this.raceElapsed,
      this.mapTheme,
      screenshotDataUrl
    );
  }

  private animate(now: number): void {
    requestAnimationFrame((t) => this.animate(t));

    // 탭 전환 등으로 프레임이 크게 끊긴 경우만 상한을 둔다(물리 스텝 수 상한과 별개).
    const realDt = snapFrameDt(Math.min(MAX_FRAME_DT, Math.max(0, (now - this.lastFrameTime) / 1000)));
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
        // 당첨 대상(1등 당첨이면 1등)이 결승선을 통과해 announceWinner가 끌 때까지 유지.
        // 함정에 맞아 한참 못 들어오는 경우를 대비한 안전 상한만 둔다.
        this.autoSlowMoTimer = AUTO_SLOWMO_MAX_SEC;
        this.sound.playSlowMoTrigger();
        this.course.triggerCrowdExcitement(1.3, 2.8);
        this.autoSlowMoActive = true;
        this.setSlowMoVisuals(true);
      }
    }

    if (this.flickBannerTimer > 0) {
      this.flickBannerTimer -= realDt;
      if (this.flickBannerTimer <= 0) {
        hideHudBanner();
      }
    }

    // 결승 슬로모션: 당첨 대상이 결승선을 통과(announceWinner)할 때까지 유지한다.
    // 단, 대상이 함정 등으로 결승 구간 밖으로 밀려나 있는 동안은 정상 속도로 돌리고,
    // 다시 결승 구간에 들어오면 이어서 슬로모션을 건다. (슬로모션이 1분 넘게 늘어지는 것 방지)
    if (this.autoSlowMoTimer > 0) {
      const inFinishApproach =
        !decisiveRacer ||
        decisiveRacer.state === 'FINISHED' ||
        decisiveRacer.getPosition().z >= finishZ - AUTO_SLOWMO_RANGE_Z;
      if (inFinishApproach) this.autoSlowMoTimer = Math.max(0, this.autoSlowMoTimer - realDt);
      const active = this.autoSlowMoTimer > 0 && inFinishApproach;
      if (active !== this.autoSlowMoActive) {
        this.autoSlowMoActive = active;
        if (!this.manualSlowMo) this.setSlowMoVisuals(active);
      }
    } else if (this.autoSlowMoActive) {
      this.autoSlowMoActive = false;
      if (!this.manualSlowMo) this.setSlowMoVisuals(false);
    }

    const isSlowMo = this.manualSlowMo || this.autoSlowMoActive;
    const timeScale = isSlowMo ? 0.22 : 1.0;

    // 고정 스텝 물리: 실제 경과 시간을 누적해 PHYSICS_STEP 단위로 시뮬레이션을 돌린다.
    // 프레임레이트와 무관하게 같은 실제 시간 동안 같은 게임 시간이 흐른다.
    // 슬로모션은 스텝 횟수가 아니라 스텝당 게임 시간을 줄여 표현한다(화면은 계속 부드럽게).
    this.physicsAccumulator += realDt;
    let stepCount = 0;
    while (this.physicsAccumulator >= PHYSICS_STEP && stepCount < MAX_PHYSICS_STEPS_PER_FRAME) {
      this.physicsAccumulator -= PHYSICS_STEP;
      stepCount++;
    }
    if (stepCount === MAX_PHYSICS_STEPS_PER_FRAME && this.physicsAccumulator >= PHYSICS_STEP) {
      // 너무 느린 기기: 따라잡지 못한 시간은 버려서 지연이 계속 쌓이지 않게 한다.
      this.physicsAccumulator = 0;
    }
    const stepDt = PHYSICS_STEP * timeScale;
    const simDt = stepDt * stepCount;

    const frameStart = performance.now();
    let courseMs = 0;
    let aiMs = 0;
    let worldStepMs = 0;
    let raceTimeAdvanced = false;

    for (let step = 0; step < stepCount; step++) {
      const isRacingStep = this.phase === 'RACING';
      if (isRacingStep) {
        this.raceElapsed += stepDt;
        raceTimeAdvanced = true;
      }

      const tCourseStart = performance.now();
      this.course.update(stepDt, this.racers, this.particles, this.sound, isRacingStep);
      const tAiStart = performance.now();

      for (const r of this.racers) {
        r.updateAIAndPhysics(
          stepDt,
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

      const tWorldStart = performance.now();
      this.world.timestep = stepDt;
      this.world.step();
      for (const r of this.racers) {
        r.refreshCachedPosition();
      }
      const tWorldEnd = performance.now();

      courseMs += tAiStart - tCourseStart;
      aiMs += tWorldStart - tAiStart;
      worldStepMs += tWorldEnd - tWorldStart;
    }

    if (raceTimeAdvanced) {
      document.getElementById('hud-timer')!.textContent = `${this.raceElapsed.toFixed(1)}초`;
    }

    this.course.updateVisuals(realDt * timeScale, this.cameraDirector.camera.position);
    this.particles.update(simDt);

    this.sortedRacers.sort((a, b) => {
      if (a.finishOrder !== null && b.finishOrder !== null) {
        return a.finishOrder - b.finishOrder;
      }
      if (a.finishOrder !== null) return -1;
      if (b.finishOrder !== null) return 1;
      return b.getPosition().z - a.getPosition().z;
    });

    const tSyncStart = performance.now();
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

    this.highlightPip.update(
      realDt,
      this.racers,
      (z) => this.course.getTrackCenterX(z),
      this.isHighlightSuppressed()
    );

    const tUiStart = performance.now();
    this.uiUpdateAccum += realDt;
    if (this.uiUpdateAccum >= 0.08) {
      this.uiUpdateAccum = 0;
      this.renderLeaderboard(false);
    }

    const tRenderStart = performance.now();
    this.renderer.render(this.scene, this.cameraDirector.camera);
    this.highlightPip.render(this.renderer, this.scene);
    const tFrameEnd = performance.now();

    this.perfTelemetry.recordFrame(
      {
        frameMs: Math.max(tFrameEnd - frameStart, realDt * 1000),
        courseMs,
        aiMs,
        worldStepMs,
        syncMs: tUiStart - tSyncStart,
        uiMs: tRenderStart - tUiStart,
        renderMs: tFrameEnd - tRenderStart,
      },
      {
        phase: this.phase,
        mapTheme: this.mapTheme,
        isMobile: this.isMobileViewport(),
        pixelRatio: this.renderer.getPixelRatio(),
        racerCount: this.racers.length,
        world: this.world,
        renderer: this.renderer,
      }
    );
  }
}

const game = new RagdollDerbyGame();
game.init().catch((err) => {
  console.error('Failed to initialize Ragdoll Derby 3D:', err);
});

// 개발 서버에서만 콘솔/자동화 테스트용으로 게임 인스턴스를 노출한다.
if (import.meta.env.DEV) {
  (window as unknown as { __game?: unknown }).__game = game;
}
