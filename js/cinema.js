// ===== 통로 시네마틱 (현실 → 미스터리 놀이터) =====
// 실제 전시 통로의 오프닝 이미지 4장을 이어 붙인 연출:
// 도시의 불빛 점등 → 포털 개방 → 빨려 들어감 → 미스터리 놀이터 도착
// assets/videos/passage.mp4 가 있으면 영상을 우선 재생하고, 없으면 이미지 시네마틱 재생.
import { sfx } from './audio.js';

const STAGES = {
  passage: {
    src: 'assets/videos/passage.mp4',
    kind: 'images',
    images: [
      'assets/cinema/passage-1.jpg', // 낮 도시
      'assets/cinema/passage-2.jpg', // 불빛 켜진 밤 도시
      'assets/cinema/passage-3.jpg', // 거대한 포털(링)
      'assets/cinema/passage-4.jpg', // 별빛 터널
    ],
  },
  outro: {
    src: 'assets/videos/outro.mp4',
    kind: 'stars',
    lines: [
      '열 가지 미션을 모두 마친 당신.',
      '황금 열쇠가 빛나며, 통로가 다시 열립니다.',
      '오늘의 경험은 꿈처럼 사라지지 않고\n마음속에 남을 것입니다.',
      '“로봇과 인공지능은 앞으로\n우리의 놀이 문화를 어떻게 바꿀 것인가?”',
      '당신만의 답과 함께 — 현실로 귀환합니다.',
    ],
  },
};

const LINE_MS = 3600;

let cleanup = null;
let doneCb = null;

const $ = (id) => document.getElementById(id);

export function playCinema(stageName, onDone) {
  const stage = STAGES[stageName];
  doneCb = onDone;

  const overlay = $('video-stage');
  const videoEl = $('video-player');
  const cinemaEl = $('cinema');
  overlay.classList.remove('hidden');
  videoEl.classList.add('hidden');
  cinemaEl.classList.add('hidden');

  let settled = false;
  let probeTimer = 0;
  const onCanPlay = () => useVideo();
  const onError = () => useFallback();
  const clearProbe = () => {
    clearTimeout(probeTimer);
    videoEl.removeEventListener('canplay', onCanPlay);
    videoEl.removeEventListener('error', onError);
  };

  function useFallback() {
    if (settled) return;
    settled = true;
    clearProbe();
    if (stage.kind === 'images') runPassage(stage, cinemaEl);
    else runFallback(stage, cinemaEl);
  }
  function useVideo() {
    if (settled) return;
    settled = true;
    clearProbe();
    let active = true;
    videoEl.classList.remove('hidden');
    videoEl.muted = false;
    videoEl.play().catch(() => {
      if (!active) return;
      videoEl.muted = true;
      videoEl.play().catch(() => { if (active) finish(); });
    });
    const onEnd = () => finish();
    videoEl.addEventListener('ended', onEnd, { once: true });
    cleanup = () => {
      active = false;
      videoEl.removeEventListener('ended', onEnd);
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    };
  }

  videoEl.src = stage.src;
  videoEl.addEventListener('canplay', onCanPlay, { once: true });
  videoEl.addEventListener('error', onError, { once: true });
  probeTimer = setTimeout(useFallback, 2500);
  cleanup = () => { settled = true; clearProbe(); };
}

export function finishCinema() { finish(); }

function finish() {
  cleanup?.();
  cleanup = null;
  $('video-stage').classList.add('hidden');
  $('cinema').innerHTML = '';
  const cb = doneCb;
  doneCb = null;
  cb?.();
}

/* ---------- 이미지 통로 시네마틱 ---------- */

// 타임라인(초): 페이즈 경계
const P = { lightsOn: 0, portal: 4.6, suck: 9.0, arrive: 12.4, end: 15.6 };

const PASSAGE_CAPTIONS = [
  { t: 0.4, text: '해가 지고 — 도시의 불빛이 하나둘 켜집니다.' },
  { t: P.portal + 0.3, text: '그 순간, 하늘에 거대한 포털이 열립니다.' },
  { t: P.suck + 0.2, text: '당신은 빛 속으로 빨려 들어갑니다…!' },
  { t: P.arrive + 0.6, text: '여기는 로봇과 AI의 세계 — 미스터리 놀이터.' },
];

function runPassage(stage, root) {
  root.classList.remove('hidden');
  root.innerHTML = `
    <canvas id="cinema-canvas"></canvas>
    <p id="cinema-caption"></p>`;
  const canvas = root.querySelector('#cinema-canvas');
  const caption = root.querySelector('#cinema-caption');
  const ctx = canvas.getContext('2d');

  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  let alive = true;
  let rafId = 0;
  cleanup = () => {
    alive = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
  };

  // 이미지 로드 (실패 시 별하늘 폴백)
  const imgs = stage.images.map(src => {
    const im = new Image();
    im.src = src;
    return im;
  });
  const loaded = imgs.map(im => new Promise(res => {
    if (im.complete && im.naturalWidth) return res(true);
    im.onload = () => res(true);
    im.onerror = () => res(false);
  }));
  const timeout = new Promise(res => setTimeout(() => res('timeout'), 4000));

  Promise.race([Promise.all(loaded), timeout]).then(result => {
    if (!alive) return;
    const ok = Array.isArray(result) && result.every(Boolean);
    if (!ok) {
      // 이미지가 없으면 기존 별하늘 폴백으로 대체
      cleanup?.();
      runFallback({
        style: 'tunnel',
        lines: PASSAGE_CAPTIONS.map(c => c.text),
      }, root);
      return;
    }
    start();
  });

  // 이미지 커버 드로우 (focus 지점 기준 줌)
  function drawCover(img, zoom, fx = 0.5, fy = 0.5, alpha = 1, shakeX = 0, shakeY = 0) {
    const W = canvas.width, H = canvas.height;
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const dx = W * 0.5 - fx * dw + shakeX;
    const dy = H * 0.5 - fy * dh + shakeY;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
  }

  const easeIn = (x) => x * x * x;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const RING = { fx: 0.49, fy: 0.5 }; // 포털 사진의 링 중심

  let start0 = 0;
  let capIdx = -1;

  function start() {
    start0 = performance.now();
    rafId = requestAnimationFrame(draw);
  }

  function draw(now) {
    if (!alive) return;
    rafId = requestAnimationFrame(draw);
    const t = (now - start0) / 1000;
    const W = canvas.width, H = canvas.height;

    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, W, H);

    if (t < P.portal) {
      // ── 1) 낮 → 불빛 켜진 밤 (크로스페이드)
      const zoom = 1.0 + t * 0.012;
      drawCover(imgs[0], zoom);
      const fade = clamp01((t - 1.6) / 2.2);
      if (fade > 0) drawCover(imgs[1], zoom * 1.01, 0.5, 0.5, fade);
    } else if (t < P.suck) {
      // ── 2) 포털 개방
      const pt = t - P.portal;
      const zoom = 1.05 + pt * 0.015;
      drawCover(imgs[1], zoom);
      const fade = clamp01(pt / 1.6);
      if (fade > 0) drawCover(imgs[2], 1.0 + pt * 0.02, RING.fx, RING.fy, fade);
      // 링 중심 글로우 펄스
      if (fade > 0.5) {
        const pulse = 0.12 + Math.sin(t * 4) * 0.06;
        const grd = ctx.createRadialGradient(W * 0.5, H * 0.5, 10, W * 0.5, H * 0.5, H * 0.42);
        grd.addColorStop(0, `rgba(200,225,255,${pulse})`);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
      }
    } else if (t < P.arrive) {
      // ── 3) 포털 속으로 흡입 (가속 줌 + 워프 스트릭 + 흔들림)
      const st = (t - P.suck) / (P.arrive - P.suck);
      const shake = st * 5;
      const sx = Math.sin(t * 47) * shake, sy = Math.cos(t * 39) * shake;
      const zoom3 = 1.1 + easeIn(st) * 3.4;
      drawCover(imgs[2], zoom3, RING.fx, RING.fy, 1, sx, sy);
      // 별빛 터널로 크로스페이드 (뒤에서 다가옴)
      const fade4 = clamp01((st - 0.62) / 0.38);
      if (fade4 > 0) {
        const zoom4 = 2.6 - fade4 * 0.9;
        drawCover(imgs[3], zoom4, 0.5, 0.5, fade4, sx * 0.5, sy * 0.5);
      }
      // 워프 스트릭
      const streaks = 26;
      ctx.save();
      ctx.globalAlpha = 0.28 * Math.min(1, st * 2);
      ctx.strokeStyle = '#dfe9ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < streaks; i++) {
        const a = (i / streaks) * Math.PI * 2 + (i % 3) * 0.4;
        const r1 = (60 + (i * 53) % 140) * (1 + st * 2.2);
        const r2 = r1 + 70 + st * 260;
        ctx.beginPath();
        ctx.moveTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1);
        ctx.lineTo(W / 2 + Math.cos(a) * r2, H / 2 + Math.sin(a) * r2);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // ── 4) 별빛 터널 감속 → 플래시 → 도착
      const at = t - P.arrive;
      const zoom4 = 1.7 + at * 0.08;
      drawCover(imgs[3], zoom4);
      // 초록 플래시 (미스터리 놀이터 도착)
      const flash = clamp01((t - (P.end - 1.6)) / 0.7) - clamp01((t - (P.end - 0.6)) / 0.6);
      if (flash > 0) {
        ctx.fillStyle = `rgba(180,255,215,${flash * 0.85})`;
        ctx.fillRect(0, 0, W, H);
      }
      // 마지막 페이드 아웃
      const out = clamp01((t - (P.end - 0.6)) / 0.6);
      if (out > 0) {
        ctx.fillStyle = `rgba(4,5,10,${out})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // 하단 자막
    let idx = -1;
    for (let i = 0; i < PASSAGE_CAPTIONS.length; i++) {
      if (t >= PASSAGE_CAPTIONS[i].t) idx = i;
    }
    if (idx !== capIdx && idx >= 0) {
      capIdx = idx;
      caption.textContent = PASSAGE_CAPTIONS[idx].text;
      caption.classList.remove('cap-in');
      void caption.offsetWidth;
      caption.classList.add('cap-in');
      sfx.tap();
    }

    if (t >= P.end) stop();
  }

  function stop() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    finish();
  }
}

/* ---------- 범용 폴백 시네마틱 (캔버스 + 자막) ---------- */

function runFallback(stage, root) {
  root.classList.remove('hidden');
  root.innerHTML = `
    <canvas id="cinema-canvas"></canvas>
    <p id="cinema-caption"></p>`;
  const canvas = root.querySelector('#cinema-canvas');
  const caption = root.querySelector('#cinema-caption');
  const ctx = canvas.getContext('2d');

  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const stars = Array.from({ length: 160 }, () => ({
    a: Math.random() * Math.PI * 2,
    r: Math.random(),
    z: 0.1 + Math.random() * 0.9,
  }));

  let start = performance.now();
  let lineIdx = -1;
  let alive = true;
  let rafId;

  function draw(now) {
    if (!alive) return;
    rafId = requestAnimationFrame(draw);
    const t = (now - start) / 1000;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;

    ctx.fillStyle = '#070910';
    ctx.fillRect(0, 0, W, H);

    if (stage.style === 'stars') {
      for (const s of stars) {
        const rr = s.r * Math.min(W, H) * 0.55;
        const x = cx + Math.cos(s.a + t * 0.03 / s.z) * rr;
        const y = cy + Math.sin(s.a + t * 0.03 / s.z) * rr * 0.8;
        const tw = 0.4 + Math.sin(t * 2 + s.a * 7) * 0.3;
        ctx.fillStyle = `rgba(160,190,255,${(0.25 + tw * 0.5) * s.z})`;
        ctx.beginPath(); ctx.arc(x, y, 1.1 + s.z * 1.4, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      for (let i = 0; i < 14; i++) {
        const p = ((t * 0.55 + i / 14) % 1);
        const r = p * p * Math.max(W, H) * 0.75 + 6;
        const hue = 150 + i * 8;
        ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${0.55 * (1 - p)})`;
        ctx.lineWidth = 2 + p * 5;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      for (const s of stars) {
        const p = ((s.z + t * 0.35) % 1);
        const rr = p * p * Math.max(W, H) * 0.7 + 4;
        const x = cx + Math.cos(s.a) * rr;
        const y = cy + Math.sin(s.a) * rr;
        ctx.fillStyle = `rgba(200,240,220,${0.7 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(x, y, 1 + p * 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    const idx = Math.min(Math.floor(t * 1000 / LINE_MS), stage.lines.length - 1);
    if (idx !== lineIdx) {
      lineIdx = idx;
      caption.innerHTML = stage.lines[idx].replaceAll('\n', '<br>');
      caption.classList.remove('cap-in');
      void caption.offsetWidth;
      caption.classList.add('cap-in');
      sfx.tap();
    }

    if (t * 1000 > stage.lines.length * LINE_MS + 600) stop();
  }

  function stop() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    finish();
  }

  cleanup = () => {
    alive = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
  };

  rafId = requestAnimationFrame(draw);
}
