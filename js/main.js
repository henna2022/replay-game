// ===== 미스터리 놀이터 RE:PLAY — 메인 =====
import * as THREE from 'three';
import {
  ZONES, SPAWN, HALL_RADIUS, SEQUENCE, SAVE_KEY,
  IDLE_WARN_SEC, IDLE_RESET_SEC,
} from './config.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { initMissions, openMission, closeMission, missionData } from './missions.js';
import { playCinema, finishCinema } from './cinema.js';
import { ui } from './ui.js';
import { sfx } from './audio.js';

/* ---------- 렌더러 / 씬 ---------- */

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.classList.add('game');
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c0e14');
scene.fog = new THREE.Fog('#0c0e14', 18, 42);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- 상태 ---------- */
// state: 'splash' | 'cinema' | 'playing' | 'ending'
let state = 'splash';
let done = new Set();       // 완료한 미션 존 id (자유 순서)
let startTime = null;
let savedElapsed = 0;
let missionOpen = false;
let lastActivity = performance.now();

const zoneById = (id) => ZONES.find(z => z.id === id);

function saveGame() {
  const elapsed = savedElapsed + (startTime ? Date.now() - startTime : 0);
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    done: [...done], elapsed,
    shots: missionData.shots,
    avatar: missionData.avatar,
  }));
}
// 플레이 중이던 세션 시간을 savedElapsed로 접어 넣음 (스플래시 복귀·엔딩 시)
function foldElapsed() {
  if (startTime) {
    savedElapsed += Date.now() - startTime;
    startTime = null;
  }
}
function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (data) {
      done = new Set((Array.isArray(data.done) ? data.done : []).filter(id => SEQUENCE.includes(id)));
      savedElapsed = Math.max(0, Number(data.elapsed) || 0);
      missionData.shots = Array.isArray(data.shots) ? data.shots : null;
      missionData.avatar = data.avatar || null;
    }
  } catch {}
}
function resetGame({ toast = true } = {}) {
  localStorage.removeItem(SAVE_KEY);
  done = new Set();
  savedElapsed = 0;
  startTime = Date.now();
  missionData.shots = null;
  missionData.avatar = null;
  for (const id of SEQUENCE) world.setZoneCompleted(id, false);
  world.setKeyObtained(false);
  syncProgressUI();
  document.getElementById('stampbook-modal').classList.add('hidden');
  ui.hideEnding();
  player.setPose(SPAWN.x, SPAWN.z, SPAWN.yaw);
  if (toast) ui.toast('기록이 초기화되었습니다. 새로운 탐험을 시작하세요!');
}

/* ---------- 월드 / 플레이어 ---------- */

const world = buildWorld(scene);

const player = new Player(camera, renderer.domElement, {
  wallRadius: HALL_RADIUS - 0.5,
  colliders: world.colliders,
  walls: world.walls,
  joyBase: document.getElementById('joy-base'),
  joyStick: document.getElementById('joy-stick'),
  onTap: handleTap,
  onActivity: () => { lastActivity = performance.now(); },
});
player.setPose(SPAWN.x, SPAWN.z, SPAWN.yaw);

/* ---------- 순차 진행 ---------- */

function syncProgressUI() {
  ui.updateProgress(done);
  for (const id of SEQUENCE) world.setZoneCompleted(id, done.has(id));
  world.setKeyObtained(done.size >= SEQUENCE.length);
  world.setBeacon(null); // 자유 순서 — 우측 진척도 패널이 안내
}

/* ---------- 상호작용 ---------- */

const raycaster = new THREE.Raycaster();
const INTERACT_DIST = 7;

// 두 2D 선분이 교차하는지 (벽 관통 상호작용 방지)
function segsIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const o = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const o1 = o(ax, az, bx, bz, cx, cz), o2 = o(ax, az, bx, bz, dx, dz);
  const o3 = o(cx, cz, dx, dz, ax, az), o4 = o(cx, cz, dx, dz, bx, bz);
  return o1 * o2 < 0 && o3 * o4 < 0;
}
function wallBetween(x1, z1, x2, z2) {
  for (const w of world.walls) {
    if (segsIntersect(x1, z1, x2, z2, w.ax, w.az, w.bx, w.bz)) return true;
  }
  return false;
}

function handleTap(ndcX, ndcY) {
  if (state !== 'playing') return;
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
  const hits = raycaster.intersectObjects(world.hitboxes, false);
  if (hits.length && hits[0].distance < INTERACT_DIST) {
    interact(hits[0].object.userData.zoneId);
  }
}

function interact(zoneId) {
  if (state !== 'playing' || missionOpen) return;
  const zone = zoneById(zoneId);
  if (!zone) return;

  // 벽 너머 상호작용 방지
  if (wallBetween(player.pos.x, player.pos.z, zone.pos[0], zone.pos[1])) return;

  if (!SEQUENCE.includes(zone.id)) return;
  const isReplay = done.has(zone.id);
  missionOpen = true;
  player.enabled = false;
  if (isReplay) ui.toast('이미 기록한 미션이에요. 자유롭게 다시 체험해 보세요!');
  openMission(zone, (success) => {
    missionOpen = false;
    player.enabled = (state === 'playing');
    lastActivity = performance.now();
    if (success && !isReplay) {
      done.add(zone.id);
      saveGame();
      syncProgressUI();
      if (done.size >= SEQUENCE.length) {
        // 10개 미션 완료 → 아웃트로 영상 → 엔딩
        sfx.portal();
        ui.toast('🔑 황금 열쇠가 빛납니다 — 현실로 귀환합니다!', 2400);
        setTimeout(() => { if (state === 'playing') startEnding(); }, 2600);
      } else {
        ui.toast(`📓 미션 기록 ${done.size}/10! 남은 전시를 자유롭게 체험하세요.`, 3000);
      }
    }
  });
}

/* ---------- 근접 프롬프트 ---------- */

function updatePrompt() {
  if (state !== 'playing' || missionOpen || !player.enabled) { ui.showPrompt(null); return; }
  let nearest = null, nd = Infinity;
  for (const z of ZONES) {
    const d = Math.hypot(player.pos.x - z.pos[0], player.pos.z - z.pos[1]);
    if (d < 5 && d < nd && !wallBetween(player.pos.x, player.pos.z, z.pos[0], z.pos[1])) {
      nd = d; nearest = z;
    }
  }
  if (!nearest) { ui.showPrompt(null); return; }

  const label = done.has(nearest.id)
    ? `✓ 「${nearest.name}」 다시 체험하기`
    : `미션 ${nearest.id - 1} — 「${nearest.name}」 시작하기`;
  ui.showPrompt(nearest.id, label);
}

/* ---------- 타임아웃 (90초 무입력 → 인트로) ---------- */

let idleWarnShown = false;

function checkIdle() {
  if (state !== 'playing') { ui.hideIdleWarning(); idleWarnShown = false; return; }
  const idleSec = (performance.now() - lastActivity) / 1000;
  if (idleSec >= IDLE_RESET_SEC) {
    idleWarnShown = false;
    ui.hideIdleWarning();
    returnToSplash();
  } else if (idleSec >= IDLE_WARN_SEC) {
    idleWarnShown = true;
    ui.showIdleWarning(Math.max(1, Math.ceil(IDLE_RESET_SEC - idleSec)));
  } else if (idleWarnShown) {
    idleWarnShown = false;
    ui.hideIdleWarning();
  }
}

function returnToSplash() {
  // 진행 중 미션/모달 정리
  if (missionOpen) { missionOpen = false; closeMission(false); }
  document.getElementById('stampbook-modal').classList.add('hidden');
  foldElapsed();
  saveGame();
  state = 'splash';
  player.enabled = false;
  ui.showHUD(false);
  ui.showPrompt(null);
  ui.hideEnding();
  updateSplashContinue();
  ui.showSplash(true);
}

/* ---------- 시작 / 엔딩 흐름 ---------- */

initMissions();
ui.init({
  onInteract: interact,
  onReset: () => resetGame(),
  onIdleContinue: () => { lastActivity = performance.now(); ui.hideIdleWarning(); idleWarnShown = false; },
});

loadGame();
syncProgressUI();

function updateSplashContinue() {
  const cont = document.getElementById('splash-continue');
  if (done.size >= SEQUENCE.length) {
    cont.textContent = '이어하기 — 모든 미션 완료! 시작하면 바로 귀환 엔딩이 재생됩니다.';
    cont.classList.remove('hidden');
  } else if (done.size > 0) {
    cont.textContent = `이어하기 — 지금까지 ${done.size}/10개 미션을 기록했습니다.`;
    cont.classList.remove('hidden');
  } else {
    cont.classList.add('hidden');
  }
}
updateSplashContinue();

function startGameplay() {
  state = 'playing';
  ui.showHUD(true);
  startTime = Date.now();
  lastActivity = performance.now();
  player.setPose(SPAWN.x, SPAWN.z, SPAWN.yaw);
  player.enabled = true;
  syncProgressUI();
  setTimeout(() => {
    if (state !== 'playing' || done.size >= SEQUENCE.length) return;
    ui.toast('👣 원하는 전시부터 자유롭게 체험하세요 — 우측 목록에서 진행 상황을 확인!', 3600);
  }, 600);
}

document.getElementById('btn-start').addEventListener('click', () => {
  sfx.init();
  sfx.open();
  ui.showSplash(false);
  state = 'cinema';
  // 통로 시네마틱(도시 불빛 → 포털 → 흡입 → 미스터리 놀이터) → 맵 진입
  playCinema('passage', () => {
    if (done.size >= SEQUENCE.length) { state = 'playing'; startEnding(); }
    else startGameplay();
  });
});

document.getElementById('btn-skip').addEventListener('click', () => {
  sfx.tap();
  finishCinema();
});

function startEnding() {
  if (state === 'ending') return;
  state = 'ending';
  player.enabled = false;
  ui.showHUD(false);
  ui.showPrompt(null);
  ui.hideIdleWarning();
  sfx.portal();
  foldElapsed();
  saveGame();
  const minutes = Math.max(1, Math.round(savedElapsed / 60000));
  // 아웃트로 영상(오프닝 역재생) → 엔딩 화면
  playCinema('outro', () => {
    if (state === 'ending') ui.showEnding({ minutes });
  });
}

document.getElementById('btn-restart').addEventListener('click', () => {
  sfx.tap();
  ui.hideEnding();
  resetGame({ toast: false });
  returnToSplash();
});

window.addEventListener('visibilitychange', () => {
  if (document.hidden) saveGame();
});

// 개발용 콘솔 핸들 (배포에 영향 없음)
window.__replay = {
  player, interact, camera, scene,
  get progress() { return done.size; },
  set progress(v) { done = new Set(SEQUENCE.slice(0, v)); syncProgressUI(); saveGame(); },
  skipToEnd() { done = new Set(SEQUENCE); syncProgressUI(); saveGame(); },
  startGameplay,
};

/* ---------- 메인 루프 ---------- */

const clock = new THREE.Clock();
let promptAcc = 0;
const stampbookEl = document.getElementById('stampbook-modal');

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  // 기록장 모달이 열려 있는 동안에는 이동 입력 무시
  if (state === 'playing' && stampbookEl.classList.contains('hidden')) player.update(dt);
  world.update(dt, camera);
  promptAcc += dt;
  if (promptAcc > 0.2) {
    promptAcc = 0;
    updatePrompt();
    checkIdle();
  }
  renderer.render(scene, camera);
});
