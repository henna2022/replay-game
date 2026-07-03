// ===== 통로 시네마틱 (현실 → 미스터리 놀이터) =====
// 전시 통로의 실제 연출(도시 불빛 점등 → 포털 → 흡입 → 도착)을 '참고'해
// 캔버스로 새로 그린 오리지널 애니메이션. 나레이션은 기획 대본 기반.
// assets/videos/passage.mp4 · outro.mp4 파일이 있으면 영상을 우선 재생.
import { sfx } from './audio.js';

// ---- 나레이션 (기획팀 통로 멘트) ----
const PASSAGE_CAPTIONS = [
  { t: 0.6, text: '미스터리 놀이터 「RE:PLAY」\n엔터테크, 인간의 놀이를 새롭게 하다' },
  { t: 5.0, text: '이곳은 인간의 세계와 로봇의 세계를\n이어주는 통로입니다.' },
  { t: 9.6, text: '여러분은 10가지 미션을 수행하면서\n황금열쇠를 찾아보세요.' },
  { t: 13.8, text: '그리고 인공지능 기술이 어떻게 우리의\n놀이문화를 바꿀지 상상해보세요.' },
  { t: 18.4, text: '그럼, 로봇의 세상으로 이동합니다!' },
];
const PASSAGE_END = 25.0;
// 페이즈 경계(초): 낮→점등 / 포털 개방 / 흡입 / 도착
const PP = { lights: 6.5, portal: 11.5, suck: 17.5, arrive: 21.2 };

const OUTRO_CAPTIONS = [
  { t: 0.5, text: '열 가지 미션을 모두 마친 당신.' },
  { t: 3.6, text: '황금 열쇠가 빛나며, 통로가 다시 열립니다.' },
  { t: 7.4, text: '오늘의 경험은 꿈처럼 사라지지 않고\n마음속에 남을 것입니다.' },
  { t: 11.6, text: '“로봇과 인공지능은 앞으로\n우리의 놀이 문화를 어떻게 바꿀 것인가?”' },
  { t: 15.6, text: '당신만의 답과 함께 — 현실로 귀환합니다.' },
];
const OUTRO_END = 19.5;
// 아웃트로 페이즈: 워프 탈출 / 포털 닫힘 / 밤 도시로 귀환
const OP = { exitWarp: 4.0, closing: 9.0, city: 14.0 };

const STAGES = {
  passage: { src: 'assets/videos/opening.mp4', dir: 1, captions: PASSAGE_CAPTIONS, end: PASSAGE_END },
  outro: { src: 'assets/videos/outro.mp4', dir: -1, captions: OUTRO_CAPTIONS, end: OUTRO_END },
};

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
    runJourney(stage, cinemaEl);
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

    // 영상 위 자막 오버레이 — 영상 길이에 비례해 타이밍 자동 배분 + 타자기 효과
    // (rAF + timeupdate 이중 구동: 탭이 가려져 rAF가 멈춰도 자막은 진행)
    const caption = document.createElement('p');
    caption.className = 'video-caption';
    overlay.appendChild(caption);
    let capIdx = -1, capShown = 0, rafId = 0;
    const capTick = () => {
      if (!active) return;
      const dur = videoEl.duration;
      if (!dur || !isFinite(dur)) return;
      const t = videoEl.currentTime;
      let idx = -1;
      for (let i = 0; i < stage.captions.length; i++) {
        if (t >= (stage.captions[i].t / stage.end) * dur) idx = i;
      }
      if (idx !== capIdx && idx >= 0) {
        capIdx = idx;
        capShown = 0;
        caption.classList.remove('cap-in');
        void caption.offsetWidth;
        caption.classList.add('cap-in');
      }
      if (capIdx >= 0) {
        const cap = stage.captions[capIdx];
        const capT0 = (cap.t / stage.end) * dur;
        const want = Math.min(cap.text.length, Math.floor((t - capT0) / 0.032));
        if (want > capShown) {
          capShown = want;
          caption.innerHTML = cap.text.slice(0, capShown).replaceAll('\n', '<br>');
          if (capShown % 4 === 1) sfx.tone(1500, 0.018, 'square', 0.025); // 슉슉 틱
        }
      }
    };
    const capLoop = () => {
      if (!active) return;
      rafId = requestAnimationFrame(capLoop);
      capTick();
    };
    rafId = requestAnimationFrame(capLoop);
    videoEl.addEventListener('timeupdate', capTick);

    cleanup = () => {
      active = false;
      cancelAnimationFrame(rafId);
      videoEl.removeEventListener('timeupdate', capTick);
      caption.remove();
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

/* ================= 오리지널 통로 애니메이션 ================= */

const lerp = (a, b, x) => a + (b - a) * x;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeIn = (x) => x * x * x;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
// 색 보간 ([r,g,b] 배열)
const mix = (c1, c2, x) => c1.map((v, i) => Math.round(lerp(v, c2[i], x)));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function runJourney(stage, root) {
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

  // ---- 도시 실루엣 생성 (참고 사진의 스카이라인 느낌, 절차 생성) ----
  function genBuildings(count, hMin, hMax, wMin, wMax) {
    const list = [];
    let x = -0.05;
    while (x < 1.05 && list.length < count * 2) {
      const w = lerp(wMin, wMax, Math.random());
      const h = lerp(hMin, hMax, Math.pow(Math.random(), 1.6));
      const cols = Math.max(2, Math.floor(w * 90));
      const rows = Math.max(3, Math.floor(h * 26));
      const wins = [];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (Math.random() < 0.55) {
            wins.push({ c, r, on: Math.random(), tw: Math.random() * Math.PI * 2 });
          }
        }
      }
      list.push({
        x, w, h, cols, rows, wins,
        spire: h > hMax * 0.8 && Math.random() < 0.5,
        beacon: Math.random() < 0.35,
      });
      x += w + lerp(0.004, 0.03, Math.random());
    }
    return list;
  }
  const backCity = genBuildings(16, 0.10, 0.30, 0.035, 0.075);
  const frontCity = genBuildings(11, 0.16, 0.46, 0.05, 0.105);
  const stars = Array.from({ length: 140 }, () => ({
    x: Math.random(), y: Math.random() * 0.55, r: 0.4 + Math.random() * 1.3, tw: Math.random() * Math.PI * 2,
  }));
  const trees = Array.from({ length: 6 }, (_, i) => ({
    x: i / 6 + Math.random() * 0.1, r: 0.03 + Math.random() * 0.035,
  }));
  // 잔디밭 피크닉 (낮 장면: 돗자리 + 사람 실루엣)
  const picnics = Array.from({ length: 5 }, (_, i) => ({
    x: 0.07 + i * 0.19 + Math.random() * 0.05,
    y: 0.845 + Math.random() * 0.09,
    w: 0.055 + Math.random() * 0.03,
    col: ['#d9744f', '#5d8fc9', '#c9b04f', '#b06fb8', '#d95f74'][i],
    ppl: 2 + (i % 2),
  }));
  const warpStars = Array.from({ length: 90 }, () => ({
    a: Math.random() * Math.PI * 2, d: 0.05 + Math.random() * 0.95, tw: Math.random(),
  }));

  // ---- 팔레트 ----
  const SKY_DAY_TOP = [116, 166, 214], SKY_DAY_BOT = [196, 219, 235];
  const SKY_SET_TOP = [44, 48, 96], SKY_SET_BOT = [232, 138, 84];
  const SKY_NGT_TOP = [8, 11, 26], SKY_NGT_BOT = [30, 38, 74];
  const BLD_DAY = [92, 106, 128], BLD_NGT = [14, 17, 30];
  const BLD_DAY_F = [64, 76, 96], BLD_NGT_F = [8, 10, 20];

  let alive = true;
  let rafId = 0;
  let capIdx = -1;
  let capShown = 0;
  const start0 = performance.now();

  cleanup = () => {
    alive = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
  };

  // ---- 장면 요소 ----
  // night: 0(낮)→1(밤) / open: 포털 개방 0→1 / t: 절대 시간
  function drawCityScene(W, H, t, night, open) {
    const horizon = H * 0.78;

    // 하늘 (낮 → 노을 → 밤)
    const sunset = clamp01(night * 2);            // 전반: 낮→노을
    const dark = clamp01(night * 2 - 1);          // 후반: 노을→밤
    const top = mix(mix(SKY_DAY_TOP, SKY_SET_TOP, sunset), SKY_NGT_TOP, dark);
    const bot = mix(mix(SKY_DAY_BOT, SKY_SET_BOT, sunset), SKY_NGT_BOT, dark);
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, rgb(top));
    sky.addColorStop(1, rgb(bot));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);

    // 지는 해
    if (night < 0.55) {
      const sunY = lerp(horizon * 0.55, horizon * 1.02, clamp01(night / 0.55));
      const sunA = 1 - clamp01(night / 0.55) * 0.6;
      const g = ctx.createRadialGradient(W * 0.72, sunY, 4, W * 0.72, sunY, H * 0.16);
      g.addColorStop(0, `rgba(255,236,180,${0.9 * sunA})`);
      g.addColorStop(0.35, `rgba(255,180,110,${0.45 * sunA})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, horizon);
    }

    // 별
    if (dark > 0) {
      for (const s of stars) {
        const twk = 0.5 + Math.sin(t * 2 + s.tw) * 0.5;
        ctx.fillStyle = `rgba(225,235,255,${dark * (0.25 + twk * 0.55)})`;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 포털 (도시 위 하늘)
    if (open > 0) drawPortal(W, H, t, open);

    // 도시 두 겹
    drawSkyline(backCity, W, H, horizon, t, night, mix(BLD_DAY, BLD_NGT, night), 0.86, 0.75);
    drawSkyline(frontCity, W, H, horizon, t, night, mix(BLD_DAY_F, BLD_NGT_F, night), 1.0, 1.0);

    // 잔디밭 (지평선 아래 — 피크닉 공원)
    const lawn = ctx.createLinearGradient(0, horizon, 0, H);
    lawn.addColorStop(0, rgb(mix([98, 148, 80], [12, 20, 14], night)));
    lawn.addColorStop(1, rgb(mix([60, 104, 52], [5, 9, 6], night)));
    ctx.fillStyle = lawn;
    ctx.fillRect(0, horizon, W, H - horizon);

    // 포털 빛이 잔디에 비침
    if (open > 0.15 && night > 0.4) {
      const g2 = ctx.createLinearGradient(0, horizon, 0, H);
      g2.addColorStop(0, `rgba(150,190,255,${0.2 * open})`);
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(W * 0.28, horizon, W * 0.44, H - horizon);
    }

    // 피크닉을 즐기는 사람들 (밤이 되면 하나둘 떠남)
    const pa = 1 - clamp01(night * 1.7 - 0.25);
    if (pa > 0) {
      ctx.save();
      ctx.globalAlpha = pa;
      for (const p of picnics) {
        const px = p.x * W, py = p.y * H;
        const pw = p.w * W, ph = pw * 0.45;
        // 돗자리
        ctx.fillStyle = p.col;
        ctx.globalAlpha = pa * 0.75;
        ctx.beginPath();
        ctx.ellipse(px, py, pw * 0.62, ph * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        // 앉아있는 사람 실루엣
        ctx.globalAlpha = pa;
        ctx.fillStyle = rgb(mix([52, 58, 66], [20, 24, 30], night));
        for (let k = 0; k < p.ppl; k++) {
          const ox = px + (k - (p.ppl - 1) / 2) * pw * 0.34;
          const bodyH = ph * 0.85;
          ctx.beginPath();
          ctx.ellipse(ox, py - bodyH * 0.4, bodyH * 0.32, bodyH * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ox, py - bodyH * 0.98, bodyH * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 앞쪽 공원 나무 실루엣
    ctx.fillStyle = rgb(mix([34, 52, 40], [4, 7, 8], night));
    ctx.fillRect(0, H * 0.94, W, H * 0.06);
    for (const tr of trees) {
      ctx.beginPath();
      ctx.arc(tr.x * W, H * 0.945, tr.r * H, Math.PI, 0);
      ctx.fill();
    }
  }

  function drawSkyline(city, W, H, horizon, t, night, color, scaleH, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const b of city) {
      const bw = b.w * W;
      const bh = b.h * H * scaleH;
      const bx = b.x * W;
      const by = horizon - bh;
      ctx.fillStyle = rgb(color);
      ctx.fillRect(bx, by, bw, bh);
      if (b.spire) {
        ctx.fillRect(bx + bw * 0.44, by - H * 0.035, bw * 0.12, H * 0.035);
        if (b.beacon && night > 0.3) {
          const bl = 0.5 + Math.sin(t * 2.4 + b.x * 20) * 0.5;
          ctx.fillStyle = `rgba(255,70,70,${bl * night})`;
          ctx.beginPath();
          ctx.arc(bx + bw * 0.5, by - H * 0.038, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // 창문: night 진행에 따라 하나둘 켜짐
      const lightP = clamp01((night - 0.35) / 0.55);
      if (lightP > 0) {
        const cw = bw / b.cols, ch = bh / b.rows;
        for (const w of b.wins) {
          if (w.on > lightP) continue;
          const flick = 0.75 + Math.sin(t * 3 + w.tw) * 0.25;
          ctx.fillStyle = `rgba(255,214,140,${0.85 * flick})`;
          ctx.fillRect(bx + w.c * cw + cw * 0.22, by + w.r * ch + ch * 0.22, cw * 0.56, ch * 0.5);
        }
      }
    }
    ctx.restore();
  }

  const PORTAL = { cx: 0.5, cy: 0.4 };
  function drawPortal(W, H, t, open) {
    const cx = W * PORTAL.cx, cy = H * PORTAL.cy;
    const R = easeOut(open) * Math.min(W, H) * 0.30;
    if (R < 2) return;
    ctx.save();
    // 내부 심연 (살짝 소용돌이)
    const inner = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
    inner.addColorStop(0, `rgba(235,245,255,${0.85 * open})`);
    inner.addColorStop(0.45, `rgba(120,160,235,${0.5 * open})`);
    inner.addColorStop(1, 'rgba(10,14,34,0)');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    // 소용돌이 하이라이트
    ctx.globalAlpha = 0.5 * open;
    ctx.lineWidth = Math.max(1.5, R * 0.05);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgba(210,230,255,0.5)';
      ctx.beginPath();
      ctx.arc(cx, cy, R * (0.35 + i * 0.18), t * (0.9 + i * 0.3) + i * 2, t * (0.9 + i * 0.3) + i * 2 + 1.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 링 본체 (이중 글로우)
    const ring = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.22);
    ring.addColorStop(0, 'rgba(255,255,255,0)');
    ring.addColorStop(0.5, `rgba(240,248,255,${0.95 * open})`);
    ring.addColorStop(1, 'rgba(140,180,255,0)');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
    ctx.fill();
    // 주변 광륜
    const halo = ctx.createRadialGradient(cx, cy, R, cx, cy, R * 2.4);
    halo.addColorStop(0, `rgba(160,195,255,${0.25 * open})`);
    halo.addColorStop(1, 'transparent');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    // 반짝임 입자
    for (let i = 0; i < 10; i++) {
      const a = t * 0.7 + i * 0.63;
      const rr = R * (1.02 + Math.sin(t * 1.7 + i) * 0.06);
      ctx.fillStyle = `rgba(255,255,255,${0.5 * open * (0.5 + Math.sin(t * 3 + i * 2) * 0.5)})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 워프(흡입/탈출) 화면: p 0→1 강도
  function drawWarp(W, H, t, p) {
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    // 중심 광원
    const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, H * 0.42);
    core.addColorStop(0, `rgba(230,242,255,${0.75 * p})`);
    core.addColorStop(0.3, `rgba(140,180,245,${0.35 * p})`);
    core.addColorStop(1, 'transparent');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, W, H);
    // 별 스트릭
    ctx.save();
    ctx.strokeStyle = '#dfe9ff';
    for (const s of warpStars) {
      const prog = ((s.d + t * (0.25 + p * 0.85)) % 1);
      const r1 = prog * prog * Math.max(W, H) * 0.75 + 5;
      const len = 8 + p * 150 * prog;
      ctx.globalAlpha = (0.2 + 0.65 * prog) * Math.min(1, p * 1.6);
      ctx.lineWidth = 1 + prog * 2.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1);
      ctx.lineTo(cx + Math.cos(s.a) * (r1 + len), cy + Math.sin(s.a) * (r1 + len));
      ctx.stroke();
    }
    ctx.restore();
    // 링 잔상
    ctx.globalAlpha = 0.5 * p;
    ctx.lineWidth = 3 + p * 5;
    ctx.strokeStyle = 'rgba(190,215,255,0.8)';
    const rr = (0.2 + ((t * 0.5) % 1) * 1.1) * H;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- 프레임 루프 ----
  function draw(now) {
    if (!alive) return;
    rafId = requestAnimationFrame(draw);
    const t = (now - start0) / 1000;
    const W = canvas.width, H = canvas.height;

    if (stage.dir === 1) drawPassageFrame(W, H, t);
    else drawOutroFrame(W, H, t);

    // 자막 (영화 자막처럼 타자기 효과로 슈슈슉)
    let idx = -1;
    for (let i = 0; i < stage.captions.length; i++) {
      if (t >= stage.captions[i].t) idx = i;
    }
    if (idx !== capIdx && idx >= 0) {
      capIdx = idx;
      capShown = 0;
      caption.classList.remove('cap-in');
      void caption.offsetWidth;
      caption.classList.add('cap-in');
    }
    if (capIdx >= 0) {
      const cap = stage.captions[capIdx];
      const want = Math.min(cap.text.length, Math.floor((t - cap.t) / 0.032));
      if (want > capShown) {
        capShown = want;
        caption.innerHTML = cap.text.slice(0, capShown).replaceAll('\n', '<br>');
        if (capShown % 4 === 1) sfx.tone(1500, 0.018, 'square', 0.025); // 슉슉 틱
      }
    }

    if (t >= stage.end) stop();
  }

  // 통로: 낮 → 점등 → 포털 → 흡입 → 도착
  function drawPassageFrame(W, H, t) {
    if (t < PP.suck) {
      const night = t < PP.lights
        ? clamp01(t / PP.lights) * 0.5
        : 0.5 + clamp01((t - PP.lights) / (PP.portal - PP.lights)) * 0.5;
      const open = t < PP.portal ? 0 : easeOut(clamp01((t - PP.portal) / 2.4));
      drawCityScene(W, H, t, clamp01(night), open);
    } else if (t < PP.arrive) {
      // 포털 중심으로 줌 → 워프
      const st = clamp01((t - PP.suck) / (PP.arrive - PP.suck));
      if (st < 0.45) {
        const z = 1 + easeIn(st / 0.45) * 3.2;
        const cx = W * PORTAL.cx, cy = H * PORTAL.cy;
        const shake = st * 8;
        ctx.save();
        ctx.translate(cx + Math.sin(t * 45) * shake, cy + Math.cos(t * 38) * shake);
        ctx.scale(z, z);
        ctx.translate(-cx, -cy);
        drawCityScene(W, H, t, 1, 1);
        ctx.restore();
        // 화이트 인
        const wi = clamp01((st - 0.3) / 0.15);
        if (wi > 0) {
          ctx.fillStyle = `rgba(220,235,255,${wi * 0.9})`;
          ctx.fillRect(0, 0, W, H);
        }
      } else {
        drawWarp(W, H, t, clamp01((st - 0.35) / 0.5));
      }
    } else {
      // 도착: 워프 감속 → 초록 플래시 → 페이드
      const at = clamp01((t - PP.arrive) / (PASSAGE_END - PP.arrive));
      drawWarp(W, H, t, 1 - at * 0.8);
      const flash = clamp01((at - 0.35) / 0.2) - clamp01((at - 0.6) / 0.25);
      if (flash > 0) {
        ctx.fillStyle = `rgba(150,240,195,${flash * 0.8})`;
        ctx.fillRect(0, 0, W, H);
      }
      const out = clamp01((at - 0.75) / 0.25);
      if (out > 0) {
        ctx.fillStyle = `rgba(4,5,10,${out})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  // 아웃트로: 워프 탈출 → 포털 닫힘 → 밤 도시 → 페이드
  function drawOutroFrame(W, H, t) {
    if (t < OP.exitWarp) {
      const p = 1 - clamp01(t / OP.exitWarp) * 0.7;
      drawWarp(W, H, t, p);
      // 시작 골드 플래시 (열쇠)
      const gf = clamp01(1 - t / 0.9);
      if (gf > 0) {
        ctx.fillStyle = `rgba(255,215,120,${gf * 0.55})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else if (t < OP.closing) {
      // 포털이 열린 밤 도시로 복귀, 점점 닫힘
      const ct = clamp01((t - OP.exitWarp) / (OP.closing - OP.exitWarp));
      drawCityScene(W, H, t, 1, 1 - easeIn(ct) * 0.8);
    } else if (t < OP.city) {
      const ct = clamp01((t - OP.closing) / (OP.city - OP.closing));
      drawCityScene(W, H, t, 1, 0.2 * (1 - ct));
    } else {
      drawCityScene(W, H, t, 1, 0);
      const out = clamp01((t - (OUTRO_END - 1.2)) / 1.2);
      if (out > 0) {
        ctx.fillStyle = `rgba(4,5,10,${out})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  function stop() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    finish();
  }

  rafId = requestAnimationFrame(draw);
}
