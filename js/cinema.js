// ===== 인트로 / 통로 시네마틱 =====
// assets/videos/intro.mp4, passage.mp4 파일이 있으면 실제 영상 재생,
// 없으면 코드 생성 시네마틱(캔버스 + 자막)으로 대체합니다.
import { sfx } from './audio.js';

const STAGES = {
  intro: {
    src: 'assets/videos/intro.mp4',
    style: 'stars',
    lines: [
      '서울로봇인공지능과학관에 오신 것을 환영합니다.',
      '이번 기획전시의 주제는 ‘엔터테크’ —\n엔터테인먼트와 기술이 합쳐진 말입니다.',
      '춤·음악·스포츠·게임 같은 우리의 놀이에\n인공지능과 로봇 기술이 더해지고 있습니다.',
      '이 기술들은 인간의 놀이 문화를\n어떻게 바꾸게 될까요?',
      '오늘, 여러분만의 답을 찾아보세요.',
    ],
  },
  passage: {
    src: 'assets/videos/passage.mp4',
    style: 'tunnel',
    lines: [
      '지금 서 있는 이 공간은\n현실 세계와 로봇의 세계를 이어 주는 통로입니다.',
      '전시장 곳곳에 10가지 미션이 숨겨져 있습니다.',
      '미션을 완수하며 여러분만의 생각과 답을 찾아보세요.',
      '모든 기록을 마치고 ‘황금 열쇠’를 얻으면\n현실로 귀환할 수 있습니다.',
      '그럼 이제, 로봇의 세상으로 이동합니다.',
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

  // 실제 영상이 있는지 확인 후 없으면 폴백.
  // 판별(프로브) 단계에서 건너뛰기해도 타이머·리스너가 남지 않도록 즉시 cleanup 등록.
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
    runFallback(stage, cinemaEl);
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

/* ---------- 폴백 시네마틱 (캔버스 + 자막) ---------- */

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

  // 파티클 (별 / 터널 링)
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
      // 느리게 흐르는 별
      for (const s of stars) {
        const rr = s.r * Math.min(W, H) * 0.55;
        const x = cx + Math.cos(s.a + t * 0.03 / s.z) * rr;
        const y = cy + Math.sin(s.a + t * 0.03 / s.z) * rr * 0.8;
        const tw = 0.4 + Math.sin(t * 2 + s.a * 7) * 0.3;
        ctx.fillStyle = `rgba(160,190,255,${(0.25 + tw * 0.5) * s.z})`;
        ctx.beginPath(); ctx.arc(x, y, 1.1 + s.z * 1.4, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // 가속 터널
      for (let i = 0; i < 14; i++) {
        const p = ((t * 0.55 + i / 14) % 1);
        const r = p * p * Math.max(W, H) * 0.75 + 6;
        const hue = 150 + i * 8;
        ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${0.55 * (1 - p)})`;
        ctx.lineWidth = 2 + p * 5;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      // 흘러가는 별
      for (const s of stars) {
        const p = ((s.z + t * 0.35) % 1);
        const rr = p * p * Math.max(W, H) * 0.7 + 4;
        const x = cx + Math.cos(s.a) * rr;
        const y = cy + Math.sin(s.a) * rr;
        ctx.fillStyle = `rgba(200,240,220,${0.7 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(x, y, 1 + p * 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 자막 갱신
    const idx = Math.min(Math.floor(t * 1000 / LINE_MS), stage.lines.length - 1);
    if (idx !== lineIdx) {
      lineIdx = idx;
      caption.innerHTML = stage.lines[idx].replaceAll('\n', '<br>');
      caption.classList.remove('cap-in');
      void caption.offsetWidth; // 리플로우로 애니메이션 재시작
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
