// ===== 존별 미션 (기획 대본 기반: 미니게임 + 퀴즈 + 생각 문답) =====
import { sfx } from './audio.js';
import { svgIcon, drawIcon } from './icons.js';
import { getModelSprite } from './modelSprite.js';

// 인라인 아이콘 헬퍼 (텍스트 크기에 맞춘 기본)
const ic = (name, size = 18) => svgIcon(name, { size });
const bigIc = (name, size = 48, color) => svgIcon(name, { size, cls: color ? '' : '' });

const modal = () => document.getElementById('mission-modal');
const bodyEl = () => document.getElementById('mission-body');

// 미션 간 공유 데이터 (축구 슛 기록 → 데이터 분석실, 아바타 → 버추얼 아이돌)
export const missionData = { shots: null, avatar: null };

let cleanupFns = [];
function onCleanup(fn) { cleanupFns.push(fn); }
function runCleanup() { cleanupFns.forEach(f => { try { f(); } catch {} }); cleanupFns = []; }
function timer(fn, ms) { const id = setTimeout(fn, ms); onCleanup(() => clearTimeout(id)); return id; }
function ticker(fn, ms) { const id = setInterval(fn, ms); onCleanup(() => clearInterval(id)); return id; }
function raf(fn) {
  let alive = true, id;
  const loop = (t) => { if (!alive) return; fn(t); id = requestAnimationFrame(loop); };
  id = requestAnimationFrame(loop);
  onCleanup(() => { alive = false; cancelAnimationFrame(id); });
}

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ---------- 공개 API ---------- */

let currentOnResult = null;

export function initMissions() {
  document.getElementById('mission-close').addEventListener('click', () => closeMission(false));
}

export function openMission(zone, onResult) {
  currentOnResult = onResult;
  runCleanup();
  const m = modal();
  document.getElementById('mission-badge').textContent = zone.id;
  document.getElementById('mission-badge').style.background = zone.color;
  document.getElementById('mission-title').textContent = zone.missionTitle;
  bodyEl().innerHTML = '';
  m.classList.remove('hidden');
  sfx.open();

  const intro = h(`<div>
    <p class="m-desc"><b>[${zone.name}]</b> ${zone.blurb}</p>
    <p class="m-desc">${zone.missionDesc}</p>
  </div>`);
  const startBtn = h(`<button class="btn-action">미션 시작</button>`);
  startBtn.addEventListener('click', () => {
    sfx.tap();
    bodyEl().innerHTML = '';
    MISSIONS[zone.id](bodyEl(), (success) => showResult(zone, success));
  });
  intro.appendChild(startBtn);
  bodyEl().appendChild(intro);
}

export function closeMission(success) {
  runCleanup();
  modal().classList.add('hidden');
  const cb = currentOnResult;
  currentOnResult = null;
  cb?.(success);
}

function showResult(zone, success) {
  runCleanup();
  const b = bodyEl();
  b.innerHTML = '';
  if (success) {
    sfx.stamp();
    b.appendChild(h(`<div class="m-result">
      <div class="big">${bigIc('medal',56)}</div>
      <h3>미션 성공!</h3>
      <p>「${zone.name}」 미션이 아카이브에 기록되었습니다.</p>
    </div>`));
    const ok = h(`<button class="btn-action">기록 확인</button>`);
    ok.addEventListener('click', () => closeMission(true));
    b.appendChild(ok);
  } else {
    sfx.bad();
    b.appendChild(h(`<div class="m-result">
      <div class="big">${bigIc('faceRobot',56)}</div>
      <h3>아쉬워요!</h3>
      <p>괜찮습니다. 다시 도전해 보세요!</p>
    </div>`));
    const retry = h(`<button class="btn-action blue">다시 도전</button>`);
    retry.addEventListener('click', () => {
      bodyEl().innerHTML = '';
      MISSIONS[zone.id](bodyEl(), (s) => showResult(zone, s));
    });
    b.appendChild(retry);
    const quit = h(`<button class="btn-ghost">잠시 후 다시 오기</button>`);
    quit.addEventListener('click', () => closeMission(false));
    b.appendChild(quit);
  }
}

/* ---------- 퀴즈 엔진 ---------- */

function runQuiz(root, questions, done) {
  let idx = 0;
  function render() {
    const q = questions[idx];
    root.innerHTML = '';
    root.appendChild(h(`<p class="quiz-progress">Q${idx + 1} / ${questions.length}</p>`));
    root.appendChild(h(`<p class="quiz-q">${q.q}</p>`));
    let solved = false;
    q.opts.forEach((opt, i) => {
      const btn = h(`<button class="quiz-opt">${opt}</button>`);
      btn.addEventListener('click', () => {
        if (solved) return;
        if (i === q.answer) {
          solved = true;
          sfx.ok();
          btn.classList.add('correct');
          if (q.explain) root.appendChild(h(`<div class="quiz-explain">${ic('bulb',16)} ${q.explain}</div>`));
          const next = h(`<button class="btn-action">${idx < questions.length - 1 ? '다음 문제' : '완료'}</button>`);
          next.addEventListener('click', () => {
            idx++;
            if (idx < questions.length) render(); else done(true);
          });
          root.appendChild(next);
        } else {
          sfx.bad();
          btn.classList.add('wrong');
          timer(() => btn.classList.remove('wrong'), 400);
        }
      });
      root.appendChild(btn);
    });
  }
  render();
}

/* ---------- 정답 없는 생각 문답 엔진 ---------- */

function runReflect(root, { lead, question, answers }, done) {
  root.innerHTML = '';
  if (lead) root.appendChild(h(`<p class="quiz-progress">${lead}</p>`));
  root.appendChild(h(`<p class="quiz-q">${question}</p>`));
  let picked = false;
  answers.forEach(a => {
    const b = h(`<button class="quiz-opt">${a.t}</button>`);
    b.addEventListener('click', () => {
      if (picked) return;
      picked = true;
      sfx.ok();
      root.appendChild(h(`<div class="quiz-explain">${a.r}</div>`));
      const fin = h(`<button class="btn-action">계속</button>`);
      fin.addEventListener('click', () => done(true));
      root.appendChild(fin);
    });
    root.appendChild(b);
  });
}

/* ---------- 사이먼(순서 기억) 엔진 ---------- */

function runSimon(root, { pads, rounds, playPad, watchText = 'AI가 보여줍니다…', goText = '이제 따라 하세요!' }, done) {
  let round = 0;
  let seq = [];

  root.appendChild(h(`<p class="m-status" id="simon-status"></p>`));
  const grid = h(`<div class="pad-grid"></div>`);
  root.appendChild(grid);
  const status = root.querySelector('#simon-status');

  const btns = pads.map((p) => {
    const b = h(`<button class="pad" style="--pad-glow:${p.glow}">${p.icon}<span class="pad-name">${p.name}</span></button>`);
    grid.appendChild(b);
    return b;
  });

  function flash(i, dur = 380) {
    btns[i].classList.add('lit');
    playPad(i);
    timer(() => btns[i].classList.remove('lit'), dur * 0.75);
  }

  function playSequence() {
    btns.forEach(b => b.disabled = true);
    status.innerHTML = `라운드 <b>${round + 1}/${rounds.length}</b> — ${watchText}`;
    seq = Array.from({ length: rounds[round] }, () => Math.floor(Math.random() * pads.length));
    seq.forEach((p, i) => timer(() => flash(p), 700 + i * 620));
    timer(() => {
      btns.forEach(b => b.disabled = false);
      status.innerHTML = `라운드 <b>${round + 1}/${rounds.length}</b> — ${goText}`;
      inputIdx = 0;
    }, 700 + seq.length * 620 + 200);
  }

  let inputIdx = -1;
  btns.forEach((b, i) => {
    b.addEventListener('click', () => {
      if (inputIdx < 0) return;
      flash(i, 250);
      if (i === seq[inputIdx]) {
        inputIdx++;
        if (inputIdx >= seq.length) {
          inputIdx = -1;
          round++;
          if (round >= rounds.length) { timer(() => done(true), 600); }
          else {
            status.textContent = '정확해요! 다음 라운드';
            sfx.ok();
            timer(playSequence, 1100);
          }
        }
      } else {
        inputIdx = -1;
        sfx.bad();
        status.textContent = '앗, 순서가 달라요. 같은 라운드를 다시 보여드릴게요.';
        timer(playSequence, 1300);
      }
    });
  });

  playSequence();
}

/* ---------- DDR 리듬 게임 엔진 (미션1) ---------- */

function runDDR(root, done) {
  const LANES = 4;
  const ARROWS = ['◀', '▲', '▼', '▶'];
  const KEYMAP = { ArrowLeft: 0, ArrowUp: 1, ArrowDown: 2, ArrowRight: 3 };
  const COLORS = ['#ff7878', '#78b4ff', '#ffd75f', '#5ee6a8'];
  const W = 440, H = 380, TARGET_Y = 300, FALL_SEC = 1.9;
  const TOTAL = 22, NEED = 15;

  root.innerHTML = '';
  root.appendChild(h(`<p class="m-status" id="ddr-status">화살표가 <b>아래 칸</b>에 닿는 순간 밟으세요! (${NEED}/${TOTAL} 이상)<br>PC는 방향키 ← ↑ ↓ → 로도 가능</p>`));
  const cv = h(`<canvas class="game-canvas" width="${W}" height="${H}"></canvas>`);
  root.appendChild(cv);
  const status = root.querySelector('#ddr-status');
  const ctx = cv.getContext('2d');
  const laneW = W / LANES;

  const notes = Array.from({ length: TOTAL }, (_, i) => ({
    lane: Math.floor(Math.random() * LANES),
    t: 2 + i * 0.85,
    state: 'fall',
  }));

  let hits = 0, finished = false;
  const start = performance.now();
  let flashes = []; // {lane, until, ok}
  let judge = { text: '', until: 0, color: '#fff' };

  function drawArrow(x, y, dir, size, color, alpha = 1, outline = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate([Math.PI / 2, Math.PI, 0, -Math.PI / 2][dir]); // ◀▲▼▶ 방향
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.55);       // 꼭짓점 (회전 기준: ▼)
    ctx.lineTo(-size * 0.5, -size * 0.1);
    ctx.lineTo(-size * 0.2, -size * 0.1);
    ctx.lineTo(-size * 0.2, -size * 0.55);
    ctx.lineTo(size * 0.2, -size * 0.55);
    ctx.lineTo(size * 0.2, -size * 0.1);
    ctx.lineTo(size * 0.5, -size * 0.1);
    ctx.closePath();
    if (outline) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
  }

  function tryHit(lane) {
    if (finished) return;
    const now = performance.now();
    const t = (now - start) / 1000;
    let best = null, bestDiff = 1e9;
    for (const n of notes) {
      if (n.state !== 'fall' || n.lane !== lane) continue;
      const y = ((t - n.t) / FALL_SEC + 1) * TARGET_Y;
      const diff = Math.abs(y - TARGET_Y);
      if (diff < bestDiff) { bestDiff = diff; best = n; }
    }
    if (best && bestDiff < 20) {
      best.state = 'hit'; hits++;
      judge = { text: 'PERFECT!', until: now + 400, color: '#5ee6a8' };
      sfx.ok();
    } else if (best && bestDiff < 40) {
      best.state = 'hit'; hits++;
      judge = { text: 'GOOD', until: now + 400, color: '#6aa7ff' };
      sfx.pad(lane);
    } else {
      judge = { text: 'MISS', until: now + 350, color: '#ff6b6b' };
      sfx.hihat();
    }
    flashes.push({ lane, until: now + 180, ok: !!(best && bestDiff < 40) });
    status.innerHTML = `${ic('robot',16)} 로봇 신남 게이지 — 성공 <b>${hits}</b>/${TOTAL} (목표 ${NEED})`;
  }

  const onKey = (e) => {
    if (KEYMAP[e.code] !== undefined) { e.preventDefault(); tryHit(KEYMAP[e.code]); }
  };
  window.addEventListener('keydown', onKey);
  onCleanup(() => window.removeEventListener('keydown', onKey));

  cv.addEventListener('pointerdown', (e) => {
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * W;
    tryHit(Math.max(0, Math.min(LANES - 1, Math.floor(x / laneW))));
  });

  raf((now) => {
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, W, H);

    // 레인 배경 + 히트 플래시
    for (let i = 0; i < LANES; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.015)';
      ctx.fillRect(i * laneW, 0, laneW, H);
      const f = flashes.find(fl => fl.lane === i && now < fl.until);
      if (f) {
        ctx.fillStyle = f.ok ? 'rgba(94,230,168,.25)' : 'rgba(255,107,107,.2)';
        ctx.fillRect(i * laneW, TARGET_Y - 36, laneW, 72);
      }
    }
    // 타겟 화살표 (외곽선)
    for (let i = 0; i < LANES; i++) {
      drawArrow(i * laneW + laneW / 2, TARGET_Y, i, 26, 'rgba(255,255,255,.75)', 1, true);
    }
    // 신남 게이지
    const ratio = Math.min(1, hits / NEED);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(14, 12, W - 28, 10);
    ctx.fillStyle = ratio >= 1 ? '#5ee6a8' : '#ffd75f';
    ctx.fillRect(14, 12, (W - 28) * ratio, 10);
    ctx.font = '600 12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = '#9aa3b5';
    drawIcon(ctx, 'robot', 21, 35, 15, '#9aa3b5', 1.6);
    ctx.fillText('로봇 신남 게이지', 32, 38);

    // 노트
    let allDone = true;
    for (const n of notes) {
      if (n.state !== 'fall') continue;
      const y = ((t - n.t) / FALL_SEC + 1) * TARGET_Y;
      if (y > -30) {
        if (y > TARGET_Y + 44) {
          n.state = 'miss';
          sfx.hihat();
        } else {
          allDone = false;
          drawArrow(n.lane * laneW + laneW / 2, y, n.lane, 24, COLORS[n.lane]);
        }
      } else allDone = false;
    }
    // 판정 텍스트
    if (now < judge.until) {
      ctx.font = '800 30px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = judge.color;
      ctx.fillText(judge.text, W / 2, 80);
    }

    if (allDone && !finished) {
      finished = true;
      timer(() => {
        runCleanup();
        done(hits >= NEED);
      }, 700);
    }
  });
}

/* ---------- 존별 미션 구현 ---------- */

const MISSIONS = {

  // 2. 로봇 댄스 — DDR 리듬게임 (로봇들을 춤추게!) + 무대 기술 퀴즈
  2(root, done) {
    runDDR(root, (ok) => {
      if (!ok) return done(false);
      root.innerHTML = '';
      root.appendChild(h(`<div class="m-result" style="padding-bottom:0">
        <div class="big">${bigIc('dancer',44)}${bigIc('robot',44)}${bigIc('dog',44)}</div>
        <h3>G1과 로봇개가 신나게 춤춥니다!</h3>
        <p>여러분의 스텝을 로봇들이 그대로 배웠어요.<br>마지막으로 무대에 숨은 기술 퀴즈!</p>
      </div>`));
      const next = h(`<button class="btn-action">퀴즈 풀기</button>`);
      next.addEventListener('click', () => runQuiz(root, [
        {
          q: '이 로봇들은 사람의 춤을 ‘보고’, 노래를 ‘듣고’ 스스로 배웁니다. 이렇게 여러 종류의 정보를 한꺼번에 배우는 학습 방법은?',
          opts: ['멀티모달 학습', '주입식 학습', '단일 채널 학습'],
          answer: 0,
          explain: '멀티모달 학습은 사진·영상(시각), 음성·소리(청각), 텍스트까지 여러 정보를 한꺼번에 학습하는 방식입니다.',
        },
        {
          q: '로봇이 춤추다 넘어질 뻔해도 중심을 잡고 자세를 지켜내는 기술은?',
          opts: ['동적 평형 제어', '자동 절전 모드', '무선 충전'],
          answer: 0,
          explain: '움직이는 중에도 스스로 균형을 잡는 동적 평형 제어 덕분에 로봇이 사람처럼 춤출 수 있게 되었어요.',
        },
      ], done));
      root.appendChild(next);
    });
  },

  // 3. 로봇팔스튜디오 — 배경 선택 → 로봇팔 앵글 → 실제 촬영 → 합성 → QR
  3(root, done) {
    // 합성용 배경 (코드로 그린 오리지널 씬 3종)
    const BGS = [
      { name: '네온 놀이공원', draw: drawBgPark },
      { name: '우주', draw: drawBgSpace },
      { name: '바닷속', draw: drawBgSea },
    ];

    function drawBgPark(ctx, W, H) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#141033'); sky.addColorStop(1, '#3c2a63');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * W, Math.random() * H * 0.5, 1.5, 1.5);
      // 대관람차
      const cx = W * 0.72, cy = H * 0.48, R = H * 0.3;
      ctx.strokeStyle = '#b06fe0'; ctx.lineWidth = Math.max(2, H * 0.008);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
        ctx.fillStyle = ['#ff6fa8', '#ffd75f', '#5ee6a8'][i % 3];
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, H * 0.016, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#8657b8';
      ctx.beginPath(); ctx.moveTo(cx - R * 0.5, H * 0.92); ctx.lineTo(cx, cy); ctx.lineTo(cx + R * 0.5, H * 0.92); ctx.stroke();
      ctx.fillStyle = '#241b40'; ctx.fillRect(0, H * 0.88, W, H * 0.12);
      // 회전목마 텐트
      ctx.fillStyle = '#e05f88';
      ctx.beginPath(); ctx.moveTo(W * 0.14, H * 0.88); ctx.lineTo(W * 0.25, H * 0.6); ctx.lineTo(W * 0.36, H * 0.88); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd75f'; ctx.fillRect(W * 0.16, H * 0.79, W * 0.18, H * 0.018);
    }
    function drawBgSpace(ctx, W, H) {
      ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 140; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
      }
      const neb = ctx.createRadialGradient(W * 0.3, H * 0.35, 10, W * 0.3, H * 0.35, H * 0.5);
      neb.addColorStop(0, 'rgba(150,90,220,.4)'); neb.addColorStop(1, 'transparent');
      ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
      const px = W * 0.72, py = H * 0.4;
      ctx.fillStyle = '#e8a45f';
      ctx.beginPath(); ctx.arc(px, py, H * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f2d59a'; ctx.lineWidth = Math.max(3, H * 0.014);
      ctx.beginPath(); ctx.ellipse(px, py, H * 0.24, H * 0.07, -0.35, 0, Math.PI * 2); ctx.stroke();
    }
    function drawBgSea(ctx, W, H) {
      const sea = ctx.createLinearGradient(0, 0, 0, H);
      sea.addColorStop(0, '#1a7a96'); sea.addColorStop(1, '#062c44');
      ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(180,240,255,.12)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(W * (0.15 + i * 0.2), 0); ctx.lineTo(W * (0.22 + i * 0.2), 0);
        ctx.lineTo(W * (0.32 + i * 0.2), H); ctx.lineTo(W * (0.18 + i * 0.2), H);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,214,90,.85)';
      for (let i = 0; i < 6; i++) {
        const fx = W * (0.1 + Math.random() * 0.8), fy = H * (0.2 + Math.random() * 0.6);
        ctx.beginPath(); ctx.ellipse(fx, fy, W * 0.03, W * 0.015, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(fx - W * 0.026, fy); ctx.lineTo(fx - W * 0.05, fy - W * 0.015); ctx.lineTo(fx - W * 0.05, fy + W * 0.015); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(220,250,255,.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, 3 + Math.random() * 7, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // ── 1단계: 배경 선택 (썸네일 미리보기) ──
    root.appendChild(h(`<p class="quiz-q">합성할 배경을 선택하세요.</p>`));
    const grid = h(`<div class="face-opts" style="grid-template-columns:repeat(3,1fr)"></div>`);
    BGS.forEach(bg => {
      const b = h(`<button class="face-opt" style="padding:8px"></button>`);
      const thumb = document.createElement('canvas');
      thumb.width = 200; thumb.height = 150;
      bg.draw(thumb.getContext('2d'), 200, 150);
      thumb.style.cssText = 'width:100%;border-radius:8px;display:block';
      b.appendChild(thumb);
      b.appendChild(h(`<div style="font-size:12.5px;margin-top:6px">${bg.name}</div>`));
      b.addEventListener('click', () => { sfx.tap(); armGame(bg); });
      grid.appendChild(b);
    });
    root.appendChild(grid);

    // ── 2단계: 로봇팔 카메라 앵글 잡기 ──
    function armGame(bg) {
      runCleanup();
      root.innerHTML = '';
      root.appendChild(h(`<p class="m-status" id="arm-status">로봇팔 카메라가 <b>목표 앵글(초록 칸)</b>에 올 때 고정하세요!</p>`));
      const cv = h(`<canvas class="game-canvas" width="440" height="240"></canvas>`);
      root.appendChild(cv);
      const grabBtn = h(`<button class="btn-action">${ic('robotArm',18)} 앵글 고정!</button>`);
      root.appendChild(grabBtn);
      const status = root.querySelector('#arm-status');
      const ctx = cv.getContext('2d');

      const SLOTS = 5;
      let armX = 40, dir = 1, speed = 150, target = 2;
      let last = performance.now();
      const slotX = (i) => 40 + i * 80;

      raf((now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        armX += dir * speed * dt;
        if (armX > 400) { armX = 400; dir = -1; }
        if (armX < 40) { armX = 40; dir = 1; }
        ctx.clearRect(0, 0, 440, 240);
        for (let i = 0; i < SLOTS; i++) {
          ctx.fillStyle = i === target ? 'rgba(94,230,168,.25)' : 'rgba(255,255,255,.05)';
          ctx.strokeStyle = i === target ? '#5ee6a8' : '#2c3444';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(slotX(i) - 32, 150, 64, 64, 10); ctx.fill(); ctx.stroke();
          if (i === target) {
            ctx.fillStyle = '#5ee6a8'; ctx.font = '700 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('ANGLE', slotX(i), 236);
          }
        }
        ctx.fillStyle = '#2c3444'; ctx.fillRect(20, 28, 400, 8);
        ctx.fillStyle = '#ef9a3c';
        ctx.fillRect(armX - 10, 30, 20, 70);
        ctx.fillRect(armX - 22, 96, 44, 14);
        ctx.fillStyle = '#20242e'; ctx.fillRect(armX - 16, 110, 32, 22);
        ctx.fillStyle = '#7ef7ff';
        ctx.beginPath(); ctx.arc(armX, 121, 6, 0, Math.PI * 2); ctx.fill();
      });

      grabBtn.addEventListener('click', () => {
        if (Math.abs(armX - slotX(target)) < 30) {
          sfx.ok();
          capture(bg);
        } else {
          sfx.bad();
          status.innerHTML = '앵글이 빗나갔어요! 다시 타이밍을 노려보세요.';
          target = (target + 2 + Math.floor(Math.random() * 2)) % SLOTS;
        }
      });
    }

    // ── 3단계: 실제 카메라 촬영 (권한 없으면 로봇 아바타 대체) ──
    async function capture(bg) {
      runCleanup();
      root.innerHTML = '';
      root.appendChild(h(`<p class="m-status">${ic('camera',16)} 로봇팔 카메라가 당신을 바라봅니다…</p>`));
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
      } catch { stream = null; }

      const photo = document.createElement('canvas');
      photo.width = 640; photo.height = 480;
      const pctx = photo.getContext('2d');

      if (!stream) {
        root.appendChild(h(`<p class="m-desc">카메라를 사용할 수 없어 <b>로봇 아바타</b>로 대신 촬영합니다.</p>`));
        pctx.fillStyle = '#22283a'; pctx.fillRect(0, 0, 640, 480);
        drawIcon(pctx, 'faceRobot', 320, 240, 200, '#aeb6c6', 8);
        const go = h(`<button class="btn-action">촬영!</button>`);
        go.addEventListener('click', () => { sfx.snare(); compose(bg, photo); });
        root.appendChild(go);
        return;
      }

      onCleanup(() => stream?.getTracks().forEach(tr => tr.stop()));
      const video = document.createElement('video');
      video.playsInline = true; video.muted = true; video.autoplay = true;
      video.srcObject = stream;
      video.className = 'cam-video';
      await video.play().catch(() => {});
      const wrap = h(`<div class="cam-wrap"></div>`);
      wrap.appendChild(video);
      const count = h(`<div class="cam-count hidden"></div>`);
      wrap.appendChild(count);
      root.appendChild(wrap);

      const go = h(`<button class="btn-action">${ic('camera',18)} 3초 카운트다운 촬영</button>`);
      go.addEventListener('click', () => {
        go.disabled = true;
        count.classList.remove('hidden');
        let n = 3;
        count.textContent = n;
        sfx.tap();
        const tid = ticker(() => {
          n--;
          if (n > 0) { count.textContent = n; sfx.tap(); return; }
          clearInterval(tid);
          // 촬영 (거울 반전, 커버 핏)
          const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
          const s = Math.max(640 / vw, 480 / vh);
          pctx.translate(640, 0); pctx.scale(-1, 1);
          pctx.drawImage(video, (640 - vw * s) / 2, (480 - vh * s) / 2, vw * s, vh * s);
          pctx.setTransform(1, 0, 0, 1, 0, 0);
          stream.getTracks().forEach(tr => tr.stop());
          sfx.snare();
          compose(bg, photo);
        }, 1000);
      });
      root.appendChild(go);
    }

    // ── 4단계: 배경 합성 ──
    function compose(bg, photo) {
      runCleanup();
      const final = document.createElement('canvas');
      final.width = 960; final.height = 720;
      const fctx = final.getContext('2d');
      bg.draw(fctx, 960, 720);
      // 폴라로이드 스타일 사진 카드
      fctx.save();
      fctx.translate(480, 330);
      fctx.rotate(-0.03);
      const cw = 520, ch = 400;
      fctx.fillStyle = '#f5f5f2';
      fctx.beginPath(); fctx.roundRect(-cw / 2 - 14, -ch / 2 - 14, cw + 28, ch + 82, 10); fctx.fill();
      fctx.drawImage(photo, -cw / 2, -ch / 2, cw, ch);
      fctx.fillStyle = '#3a3f4c';
      fctx.font = '600 26px "Pretendard","Apple SD Gothic Neo",sans-serif';
      fctx.textAlign = 'center';
      fctx.fillText('미스터리 놀이터 RE:PLAY — 로봇팔 스튜디오', 0, ch / 2 + 46);
      fctx.restore();

      root.innerHTML = '';
      root.appendChild(h(`<p class="quiz-progress">촬영 완료! AI가 배경과 합성했습니다</p>`));
      const img = new Image();
      img.src = final.toDataURL('image/jpeg', 0.88);
      img.className = 'composite-img';
      root.appendChild(img);

      const qrBtn = h(`<button class="btn-action">${ic('qr',18)} QR코드로 사진 가져가기</button>`);
      qrBtn.addEventListener('click', () => { qrBtn.disabled = true; makeQR(final); });
      root.appendChild(qrBtn);
      const skip = h(`<button class="btn-ghost">QR 없이 완료</button>`);
      skip.addEventListener('click', () => done(true));
      root.appendChild(skip);
    }

    // ── 5단계: 임시 서버 업로드 → QR (1시간 뒤 자동 삭제) ──
    async function makeQR(final) {
      const wait = h(`<p class="m-status">QR 생성 중…</p>`);
      root.appendChild(wait);
      try {
        const blob = await new Promise(res => final.toBlob(res, 'image/jpeg', 0.85));
        const fd = new FormData();
        fd.append('file', blob, 'replay-photo.jpg');
        const ac = new AbortController();
        timer(() => ac.abort(), 20000);
        const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: fd, signal: ac.signal });
        const j = await res.json();
        const url = j.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        const qrMod = await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm');
        const qr = qrMod.default(0, 'M');
        qr.addData(url);
        qr.make();
        const n = qr.getModuleCount();
        const cell = 6, margin = 4;
        const qcv = document.createElement('canvas');
        qcv.width = qcv.height = (n + margin * 2) * cell;
        const qctx = qcv.getContext('2d');
        qctx.fillStyle = '#ffffff'; qctx.fillRect(0, 0, qcv.width, qcv.height);
        qctx.fillStyle = '#000000';
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (qr.isDark(r, c)) qctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
          }
        }
        wait.remove();
        const qwrap = h(`<div class="qr-wrap"></div>`);
        qwrap.appendChild(qcv);
        root.appendChild(qwrap);
        root.appendChild(h(`<p class="qr-notice">${ic('alert',16)} 이 화면을 지나가면 사진을 다시 저장하기 어려워요.<br>휴대폰으로 QR을 찍어 지금 저장해 주세요.<br>사진은 <b>1시간 뒤 자동 삭제</b>됩니다.</p>`));
        sfx.ok();
      } catch {
        wait.remove();
        root.appendChild(h(`<p class="qr-notice">QR 생성에 실패했어요 (네트워크 문제).<br>아쉽지만 화면을 직접 촬영해 주세요!</p>`));
      }
      const fin = h(`<button class="btn-action">완료</button>`);
      fin.addEventListener('click', () => done(true));
      root.appendChild(fin);
    }
  },
  // 4. 소형로봇전시 — 세 로봇 친구 체험 (리쿠 대화 · 러봇 쓰담 · 발루 펀치)
  4(root, done) {
    likuChat(() => lovotPet(() => balluPunch(done)));

    // ── 1/3 리쿠와 대화 (준비된 질문 선택형) ──
    function likuChat(next) {
      runCleanup();
      root.innerHTML = '';
      root.appendChild(h(`<p class="m-status">1/3 · <b>리쿠</b>와 대화하기 — 궁금한 걸 3가지 이상 물어보세요</p>`));
      const box = h(`<div class="chat-box"></div>`);
      root.appendChild(box);
      const qs = h(`<div class="chat-questions"></div>`);
      root.appendChild(qs);

      const QA = [
        ['안녕! 너는 누구야?', '안녕하세요! 저는 상호작용 로봇 리쿠예요. 어르신들께는 말동무가 되어 드리고, 아이들에게는 동화책을 읽어줘요.'],
        ['너도 감정이 있어?', '저는 사람의 표정과 목소리를 읽고, 거기에 맞는 반응을 만들어요. 그게 "진짜 감정"인지는… 여러분이 판단해 주세요!'],
        ['눈이 왜 보라색으로 변해?', '제 눈이 보라색이 되면 "듣고 있어요"라는 뜻이에요. 머리에 살짝 손을 올리고 말을 걸어 주세요.'],
        ['나랑 친구가 될 수 있어?', '물론이죠! 저는 언제나 이야기를 들어줄 준비가 되어 있어요. 그런데… 사람 친구도 꼭 챙기기, 약속이에요!'],
        ['좋아하는 놀이가 뭐야?', '끝말잇기요! 로봇은 지치지 않으니까 밤새 할 수 있어요. …농담이에요, 배터리는 소중하니까요.'],
      ];
      let asked = 0, busy = false;

      addLiku('안녕하세요! 저는 리쿠예요. 무엇이든 물어보세요!');

      QA.forEach(([q, a]) => {
        const b = h(`<button class="chat-q">${q}</button>`);
        b.addEventListener('click', () => {
          if (busy || b.disabled) return;
          busy = true;
          b.disabled = true;
          sfx.tap();
          addUser(q);
          timer(() => {
            addLiku(a, () => {
              busy = false;
              asked++;
              if (asked >= 3 && !qs.querySelector('.btn-action')) {
                const nx = h(`<button class="btn-action" style="grid-column:1/-1">다음 친구 만나기 → 러봇</button>`);
                nx.addEventListener('click', () => { sfx.tap(); next(); });
                qs.appendChild(nx);
              }
            });
          }, 500);
        });
        qs.appendChild(b);
      });

      function addUser(text) {
        box.appendChild(h(`<div class="bubble user">${text}</div>`));
        box.scrollTop = box.scrollHeight;
      }
      function addLiku(text, onEnd) {
        const bb = h(`<div class="bubble liku"><span class="who">${ic('robot',14)} 리쿠</span><span class="msg"></span></div>`);
        box.appendChild(bb);
        const msg = bb.querySelector('.msg');
        const t0 = performance.now();
        let shown = 0, ended = false;
        // rAF + interval 이중 구동 (탭이 가려져 rAF가 멈춰도 진행)
        const tick = () => {
          if (ended) return;
          const want = Math.min(text.length, Math.floor((performance.now() - t0) / 24));
          if (want > shown) {
            shown = want;
            msg.textContent = text.slice(0, shown);
            box.scrollTop = box.scrollHeight;
            if (shown % 8 === 0) sfx.tone(900 + (shown * 37) % 300, 0.02, 'sine', 0.02);
            if (shown >= text.length) { ended = true; clearInterval(iv); onEnd?.(); }
          }
        };
        const iv = ticker(tick, 120);
        raf(tick);
      }
    }

    // ── 2/3 러봇 코 쓰담쓰담 (하트 뿅뿅) ──
    function lovotPet(next) {
      runCleanup();
      root.innerHTML = '';
      root.appendChild(h(`<p class="m-status" id="pet-status">2/3 · <b>러봇</b> 코 쓰담쓰담 — 주황 코를 문질러 주세요! (<b id="pet-n">0</b>/5)</p>`));
      const cv = h(`<canvas class="game-canvas" width="440" height="340"></canvas>`);
      root.appendChild(cv);
      const ctx = cv.getContext('2d');
      // 러봇(라임) 일러스트: 기본 / 활짝(쓰담) / 윙크(완료)
      const imgs = {};
      for (const k of [1, 2, 3]) {
        const im = new Image();
        im.src = `assets/ui/raim-${k}.png`;
        imgs[k] = im;
      }
      const hearts = [];
      let pets = 0, happyUntil = 0, lastPet = 0, finished = false;
      let nose = { x: 220, y: 190, r: 30 };

      raf((now) => {
        ctx.clearRect(0, 0, 440, 340);
        const happy = now < happyUntil;
        const img = finished ? imgs[2] : (happy ? imgs[3] : imgs[1]);
        // contain-fit 배치
        const base = imgs[1];
        const iw = base.naturalWidth || 440, ih = base.naturalHeight || 388;
        const s = Math.min(400 / iw, 300 / ih);
        const w = iw * s, hh = ih * s;
        const L = { x: (440 - w) / 2, y: 330 - hh, w, h: hh };
        if (img.complete && img.naturalWidth) ctx.drawImage(img, L.x, L.y, L.w, L.h);
        // 코 히트존 (얼굴 중앙)
        nose = { x: L.x + L.w * 0.47, y: L.y + L.h * 0.55, r: Math.max(22, L.w * 0.1) };
        if (!finished) {
          const pulse = 1 + Math.sin(now / 300) * 0.1;
          ctx.strokeStyle = 'rgba(255,160,120,.85)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.arc(nose.x, nose.y, nose.r * pulse, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
        // 하트 파티클
        for (let i = hearts.length - 1; i >= 0; i--) {
          const hh2 = hearts[i];
          hh2.y -= 1.4; hh2.a -= 0.012; hh2.x += Math.sin(hh2.y / 14) * 0.8;
          if (hh2.a <= 0) { hearts.splice(i, 1); continue; }
          ctx.globalAlpha = hh2.a;
          drawIcon(ctx, 'heart', hh2.x, hh2.y - 8, 24, '#ff5f9e', 2.2);
        }
        ctx.globalAlpha = 1;
      });

      function pet(e) {
        if (finished) return;
        const rect = cv.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * 440;
        const y = (e.clientY - rect.top) / rect.height * 340;
        const now = performance.now();
        if (Math.hypot(x - nose.x, y - nose.y) < nose.r + 12 && now - lastPet > 320) {
          lastPet = now;
          pets++;
          happyUntil = now + 750;
          sfx.ok();
          for (let i = 0; i < 3; i++) hearts.push({ x: nose.x + (Math.random() - 0.5) * 70, y: nose.y - 80, a: 1 });
          root.querySelector('#pet-n').textContent = pets;
          if (pets >= 5) {
            finished = true;
            root.querySelector('#pet-status').innerHTML = `${ic('heart', 16)} 러봇이 행복해해요! 팔 안쪽에서 따뜻한 온기가 느껴져요.`;
            timer(() => next(), 1500);
          }
        }
      }
      cv.addEventListener('pointerdown', pet);
      cv.addEventListener('pointermove', (e) => { if (e.buttons) pet(e); });
    }

    // ── 3/3 발루 펀치 (밀어도 넘어지지 않아!) ──
    function balluPunch(finish) {
      runCleanup();
      root.innerHTML = '';
      root.appendChild(h(`<p class="m-status" id="punch-status">3/3 · <b>발루</b> 펀치! — 밀어도 절대 넘어지지 않아요 (<b id="punch-n">0</b>/5)</p>`));
      const cv = h(`<canvas class="game-canvas" width="440" height="470"></canvas>`);
      root.appendChild(cv);
      const ctx = cv.getContext('2d');
      let ang = 0, vel = 0, punches = 0, doneFlag = false;
      let last = performance.now();
      let bang = { until: 0, x: 0, y: 0 };
      const FLOOR_Y = 442;

      // 실제 발루 모델(balu.glb) 스프라이트 — 준비되면 이 이미지를 회전해서 사용
      let baluImg = null;
      Promise.resolve(getModelSprite('assets/models/balu.glb', { w: 240, h: 400 }))
        .then((img) => { baluImg = img; });

      raf((now) => {
        const dt = Math.min(0.04, (now - last) / 1000);
        last = now;
        // 오뚝이 스프링 물리 (복원력 + 감쇠)
        vel += (-16 * ang - 2.2 * vel) * dt;
        ang += vel * dt;

        ctx.clearRect(0, 0, 440, 470);
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        ctx.fillRect(60, FLOOR_Y, 320, 6);

        ctx.save();
        ctx.translate(220, FLOOR_Y);
        ctx.rotate(ang);
        if (baluImg) {
          // 실제 발루 모델 스프라이트 (바닥에 발이 닿도록 아래 정렬) — 2배 크기
          const dh = 500, dw = dh * (baluImg.width / baluImg.height);
          ctx.drawImage(baluImg, -dw / 2, -dh, dw, dh);
        } else {
          // 로딩 전 폴백 (은박 풍선 + 가는 다리)
          ctx.strokeStyle = '#26282e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.fillStyle = '#26282e';
          for (const lx of [-20, 20]) {
            ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx * 0.7, -95); ctx.stroke();
            ctx.fillRect(lx - 14, -6, 28, 8);
          }
          const foil = ctx.createLinearGradient(-60, -250, 60, -100);
          foil.addColorStop(0, '#f0f2f6'); foil.addColorStop(0.4, '#b9bfc9');
          foil.addColorStop(0.6, '#e6e9ee'); foil.addColorStop(1, '#8f95a1');
          ctx.fillStyle = foil;
          ctx.beginPath(); ctx.ellipse(0, -175, 55, 82, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#3a3f4a';
          ctx.beginPath(); ctx.arc(-16, -195, 6, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(16, -195, 6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        if (now < bang.until) {
          drawIcon(ctx, 'burst', bang.x, bang.y, 34, '#ffd75f', 2.4);
        }
      });

      cv.addEventListener('pointerdown', (e) => {
        if (doneFlag) return;
        const rect = cv.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * 440;
        const dir = x < 220 ? 1 : -1; // 왼쪽에서 치면 오른쪽으로 기울어짐
        vel += dir * (4.2 + (punches % 3) * 0.5);
        punches++;
        bang = { until: performance.now() + 300, x: 220 - dir * 110, y: 210 };
        sfx.kick();
        root.querySelector('#punch-n').textContent = Math.min(punches, 5);
        if (punches >= 5) {
          doneFlag = true;
          root.querySelector('#punch-status').innerHTML = `${ic('balloon', 16)} 아무리 밀어도 넘어지지 않아요! 이것이 발루의 <b>동적 평형</b>!`;
          timer(() => {
            runCleanup();
            root.innerHTML = '';
            root.appendChild(h(`<div class="m-result">
              <div class="big">${bigIc('robot',44)}${bigIc('heart',44)}${bigIc('balloon',44)}</div>
              <h3>세 로봇 친구와 마음을 나눴어요!</h3>
              <p>말동무 리쿠, 사랑둥이 러봇, 오뚝이 발루 —<br>로봇은 즐거움을 함께 나누는 진짜 친구가 될 수 있을까요?</p>
            </div>`));
            const fin = h(`<button class="btn-action">기록하기</button>`);
            fin.addEventListener('click', () => finish(true));
            root.appendChild(fin);
          }, 1600);
        }
      });
    }
  },
  // 5. AI사운드 뮤드럼 — 보코와 함께 떨어지는 드럼 노트 연주
  5(root, done) {
    const LANES = 4;
    const LANE_ICONS = ['drum', 'drum', 'cymbal', 'bell'];
    const LANE_COLORS = ['#ff7878', '#78b4ff', '#ffd75f', '#5ee6a8'];
    const W = 440, H = 340, HIT_Y = 270, FALL_SEC = 2.0;
    const TOTAL = 16, NEED = 12;

    root.appendChild(h(`<p class="m-status" id="drum-status">${ic('cat',16)} 보코: “노트가 <b>회색 선</b>에 닿는 순간 그 줄을 탭!” (${NEED}/${TOTAL} 이상)</p>`));
    const cv = h(`<canvas class="game-canvas" width="${W}" height="${H}"></canvas>`);
    root.appendChild(cv);
    const status = root.querySelector('#drum-status');
    const ctx = cv.getContext('2d');
    const laneW = W / LANES;

    // 노트 생성: 0.9초 간격, 시작 2초 뒤
    const notes = Array.from({ length: TOTAL }, (_, i) => ({
      lane: Math.floor(Math.random() * LANES),
      t: 2 + i * 0.9,
      state: 'fall', // fall | hit | miss
    }));

    let hits = 0, finished = false;
    let start = performance.now();
    let flashes = []; // {lane, until, ok}

    raf((now) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);

      // 레인
      for (let i = 0; i < LANES; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.015)';
        ctx.fillRect(i * laneW, 0, laneW, H);
      }
      // 히트 라인 (회색 선)
      ctx.fillStyle = '#8a94a8';
      ctx.fillRect(0, HIT_Y - 2, W, 4);

      // 패드 아이콘
      for (let i = 0; i < LANES; i++) {
        const f = flashes.find(fl => fl.lane === i && now < fl.until);
        if (f) {
          ctx.fillStyle = f.ok ? 'rgba(94,230,168,.25)' : 'rgba(255,107,107,.22)';
          ctx.fillRect(i * laneW, HIT_Y - 34, laneW, 68);
        }
        drawIcon(ctx, LANE_ICONS[i], i * laneW + laneW / 2, H - 18, 26, LANE_COLORS[i], 2);
      }

      // 노트
      let done_ = true;
      for (const n of notes) {
        if (n.state === 'fall') {
          const y = ((t - n.t) / FALL_SEC + 1) * HIT_Y;
          if (y > -20) {
            if (y > HIT_Y + 30) {
              n.state = 'miss';
              flashes.push({ lane: n.lane, until: now + 200, ok: false });
              sfx.bad();
            } else {
              done_ = false;
              ctx.fillStyle = LANE_COLORS[n.lane];
              ctx.beginPath();
              ctx.roundRect(n.lane * laneW + 14, y - 12, laneW - 28, 24, 8);
              ctx.fill();
            }
          } else done_ = false;
        }
      }

      ctx.fillStyle = '#9aa3b5'; ctx.font = '600 14px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(`성공 ${hits}/${TOTAL}`, W - 10, 20);

      if (done_ && !finished) {
        finished = true;
        timer(() => {
          if (hits >= NEED) {
            runCleanup(); // 노트 게임의 rAF 중단
            root.innerHTML = '';
            runReflect(root, {
              lead: `${ic('cat',15)} 보코의 질문`,
              question: '방금은 AI가 짜 놓은 리듬을 그대로 따라 연주했어요. 만약 AI가 알려주는 ‘정답’에만 맞춰 연주한다면, 그것을 나만의 음악이라고 할 수 있을까요?',
              answers: [
                { t: 'AI 리듬도 내가 연주하면 내 음악', r: '연주하는 손끝의 감정은 AI가 대신할 수 없죠. 도구는 빌려도 마음은 내 것이니까요.' },
                { t: '내 마음대로 쳐야 진짜 내 음악', r: '박자가 틀려도 내 기분을 담은 연주 — 보코도 가끔은 악보를 덮고 그렇게 연주한대요.' },
                { t: '둘을 섞으면 더 좋은 음악이 된다', r: 'AI에게 기본기를 배우고, 그 위에 나만의 감정을 얹는 것. 어쩌면 미래의 음악가는 그렇게 연주할 거예요.' },
              ],
            }, done);
          } else done(false);
        }, 600);
      }
    });

    cv.addEventListener('pointerdown', (e) => {
      const rect = cv.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * W;
      const lane = Math.max(0, Math.min(LANES - 1, Math.floor(x / laneW)));
      sfx.drumPad(lane);
      const now = performance.now();
      const t = (now - start) / 1000;
      // 라인 근처의 해당 레인 노트 찾기
      let best = null, bestDiff = 1e9;
      for (const n of notes) {
        if (n.state !== 'fall' || n.lane !== lane) continue;
        const y = ((t - n.t) / FALL_SEC + 1) * HIT_Y;
        const diff = Math.abs(y - HIT_Y);
        if (diff < bestDiff) { bestDiff = diff; best = n; }
      }
      if (best && bestDiff < 34) {
        best.state = 'hit';
        hits++;
        flashes.push({ lane, until: now + 200, ok: true });
        status.innerHTML = `${ic('cat',15)} 보코: “좋아요!” — 성공 <b>${hits}</b>/${TOTAL}`;
      } else {
        flashes.push({ lane, until: now + 200, ok: false });
      }
    });
  },

  // 6. 버추얼 아이돌 — 팬미팅 호응 타이밍 + 기념사진
  6(root, done) {
    const avatar = missionData.avatar;
    root.appendChild(h(`<p class="m-status" id="idol-status">${avatar ? `아바타 ‘${avatar.name}’와 함께 입장!` : ''} 링이 <b>흰 원</b>과 겹칠 때 탭! (8번 중 6번)</p>`));
    const cv = h(`<canvas class="game-canvas" width="440" height="280"></canvas>`);
    root.appendChild(cv);
    const status = root.querySelector('#idol-status');
    const ctx = cv.getContext('2d');

    const TOTAL = 8, NEED = 6;
    let note = 0, hits = 0, ringR = 130, targetR = 44, running = true, feedback = '', fbUntil = 0;
    let noteBornAt = performance.now();
    const SPEED = 95;
    let last = performance.now();

    function nextNote() {
      note++;
      ringR = 130;
      noteBornAt = performance.now();
      if (note >= TOTAL) {
        running = false;
        timer(() => {
          if (hits >= NEED) photo();
          else done(false);
        }, 700);
      }
    }

    function photo() {
      runCleanup(); // 링 게임의 rAF 중단
      root.innerHTML = '';
      const me = avatar ? `<span style="color:${avatar.color}">${svgIcon(avatar.face, { size: 48 })}</span>` : bigIc('user', 48);
      root.appendChild(h(`<div class="m-result">
        <div class="big">${me}${bigIc('mic', 44)}${bigIc('spark', 40)}</div>
        <h3>팬미팅 성공! 찰칵</h3>
        <p>${avatar
          ? `버추얼 아이돌이 아바타 ‘${avatar.name}’와 기념사진을 찍었습니다.<br>가상 속에서의 이 만남은 어떤 의미일까요?`
          : '버추얼 아이돌과 기념사진을 찍었습니다.<br>가상 속에서의 이 만남은 어떤 의미일까요?'}</p>
      </div>`));
      const fin = h(`<button class="btn-action">기념사진 저장</button>`);
      fin.addEventListener('click', () => done(true));
      root.appendChild(fin);
    }

    raf((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (running) {
        ringR -= SPEED * dt;
        if (ringR < targetR - 16) {
          feedback = 'MISS'; fbUntil = now + 450;
          sfx.bad();
          nextNote();
        }
      }
      ctx.clearRect(0, 0, 440, 280);
      const grd = ctx.createRadialGradient(220, 140, 10, 220, 140, 220);
      grd.addColorStop(0, 'rgba(236,95,163,.18)'); grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, 440, 280);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(220, 140, targetR, 0, Math.PI * 2); ctx.stroke();
      if (running) {
        ctx.strokeStyle = '#ec5fa3'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(220, 140, Math.max(ringR, 4), 0, Math.PI * 2); ctx.stroke();
      }
      if (now < fbUntil) {
        ctx.fillStyle = feedback === 'PERFECT!' ? '#5ee6a8' : (feedback === 'GOOD' ? '#6aa7ff' : '#ff6b6b');
        ctx.font = '800 30px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(feedback, 220, 60);
      }
      ctx.fillStyle = '#9aa3b5'; ctx.font = '600 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.min(note, TOTAL)} / ${TOTAL} · 성공 ${hits}`, 220, 262);
    });

    cv.addEventListener('pointerdown', () => {
      // 노트 전환 직후 250ms는 무시 (미스 직후 탭이 다음 노트를 소모하는 것 방지)
      if (!running || ringR < targetR - 16 || performance.now() - noteBornAt < 250) return;
      const diff = Math.abs(ringR - targetR);
      if (diff < 10) { hits++; feedback = 'PERFECT!'; sfx.ok(); }
      else if (diff < 22) { hits++; feedback = 'GOOD'; sfx.tap(); }
      else { feedback = 'MISS'; sfx.bad(); }
      fbUntil = performance.now() + 450;
      status.innerHTML = `성공 <b>${hits}</b> / 목표 ${NEED}`;
      nextNote();
    });
  },

  // 7. 디지털 아바타 — 아바타 창조 + 디지털 기록 퀴즈
  7(root, done) {
    const NAMES = ['네온', '스파크', '코스모', '픽셀'];
    const FACES = ['faceSmile', 'faceCool', 'faceRobot', 'faceFox'];
    const COLORS = ['#5ee6a8', '#6aa7ff', '#ec5fa3', '#ffd75f'];
    const draft = {};

    function pickStep(title, items, render, key, next) {
      root.innerHTML = '';
      root.appendChild(h(`<p class="quiz-progress">아바타 창조 ${key === 'name' ? '1' : key === 'face' ? '2' : '3'}/3</p>`));
      root.appendChild(h(`<p class="quiz-q">${title}</p>`));
      const grid = h(`<div class="face-opts"></div>`);
      items.forEach(item => {
        const b = h(`<button class="face-opt">${render(item)}</button>`);
        b.addEventListener('click', () => { sfx.tap(); draft[key] = item; next(); });
        grid.appendChild(b);
      });
      root.appendChild(grid);
      root.appendChild(h(`<p class="m-status">※ 실제 개인정보 대신 가상의 정보로 만들어요</p>`));
    }

    const step1 = () => pickStep('아바타의 별명을 고르세요.', NAMES, n => `<div style="font-size:16px;font-weight:700">${n}</div>`, 'name', step2);
    const step2 = () => pickStep('아바타의 얼굴을 고르세요.', FACES, f => svgIcon(f, { size: 40 }), 'face', step3);
    const step3 = () => pickStep('아바타의 색을 고르세요.', COLORS,
      c => `<div style="width:34px;height:34px;border-radius:50%;background:${c};margin:0 auto"></div>`, 'color', reveal);

    function reveal() {
      root.innerHTML = '';
      root.appendChild(h(`<div class="m-result">
        <div class="big" style="color:${draft.color}">${svgIcon(draft.face, { size: 52 })}</div>
        <h3>아바타 ‘${draft.name}’ 생성 완료!</h3>
        <p>이 아바타는 다음 전시(버추얼 아이돌)까지 여러분을 따라다닙니다.<br>
        방금 입력한 정보들 — 디지털 공간에 저장된 기록은 그리 쉽게 사라지지 않아요.</p>
      </div>`));
      const next = h(`<button class="btn-action">퀴즈 풀기</button>`);
      next.addEventListener('click', () => {
        runQuiz(root, [
          {
            q: '디지털 기록 속 내 정보를 지워 달라고 요구할 수 있는 권리를 무엇이라고 할까요?',
            opts: ['잊혀질 권리', '앙코르 권리', '새로고침 권리'],
            answer: 0,
            explain: '한 번 저장된 디지털 정보는 쉽게 사라지지 않기 때문에, ‘잊혀질 권리’가 세계적으로 주목받고 있어요.',
          },
          {
            q: '이미 학습을 마친 AI의 ‘기억’에서 특정 정보를 지우는 기술은?',
            opts: ['머신 언러닝', '머신 다이어트', '메모리 포맷'],
            answer: 0,
            explain: '머신 러닝(학습)의 반대, 머신 언러닝(unlearning) — AI가 배운 것을 골라서 지우는 연구가 활발히 진행 중입니다.',
          },
        ], (ok) => {
          // 미션 성공이 확정된 시점에만 아바타 저장 (X로 닫으면 남지 않음)
          if (ok) missionData.avatar = { name: draft.name, face: draft.face, color: draft.color };
          done(ok);
        });
      });
      root.appendChild(next);
    }

    step1();
  },

  // 8. 축구 슛팅 — AI 코치와 3번의 슛 기록 (방향 → 파워 2단계)
  8(root, done) {
    root.appendChild(h(`<p class="m-status" id="soccer-status">슛 1/3 — <b>초록 구간</b>에서 방향을 정하세요!</p>`));
    const cv = h(`<canvas class="game-canvas" width="440" height="290"></canvas>`);
    root.appendChild(cv);
    const btn = h(`<button class="btn-action">${ic('soccer',18)} 방향 결정!</button>`);
    root.appendChild(btn);
    const status = root.querySelector('#soccer-status');
    const ctx = cv.getContext('2d');

    let phase = 'dir'; // dir → power → anim
    let cursor = 40, dir = 1, speed = 300;
    let power = 0, pDir = 1;
    let shots = [];
    let keeperX = 110, keeperW = 150;
    let lockedX = 220;
    let ballAnim = null;
    let last = performance.now();

    function newKeeper() {
      keeperW = Math.max(100, 160 - shots.length * 20);
      keeperX = 40 + Math.random() * (360 - keeperW);
    }
    newKeeper();

    raf((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (phase === 'dir') {
        cursor += dir * speed * dt;
        if (cursor > 400) { cursor = 400; dir = -1; }
        if (cursor < 40) { cursor = 40; dir = 1; }
      } else if (phase === 'power') {
        power += pDir * 150 * dt;
        if (power > 100) { power = 100; pDir = -1; }
        if (power < 0) { power = 0; pDir = 1; }
      }

      ctx.clearRect(0, 0, 440, 290);
      // 골대 + 키퍼 구간
      ctx.strokeStyle = '#e8e4da'; ctx.lineWidth = 6;
      ctx.strokeRect(40, 30, 360, 110);
      ctx.fillStyle = 'rgba(94,230,168,.15)';
      ctx.fillRect(40, 30, 360, 110);
      ctx.fillStyle = 'rgba(255,107,107,.35)';
      ctx.fillRect(keeperX, 30, keeperW, 110);
      const kx = keeperX + keeperW / 2;
      ctx.fillStyle = '#c9a795';
      ctx.fillRect(kx - 14, 55, 28, 55);
      ctx.beginPath(); ctx.arc(kx, 45, 12, 0, Math.PI * 2); ctx.fill();

      // 방향 게이지
      ctx.fillStyle = '#2c3444'; ctx.fillRect(40, 175, 360, 10);
      ctx.fillStyle = phase === 'dir' ? '#5ee6a8' : '#4a5568';
      const cx = phase === 'dir' ? cursor : lockedX;
      ctx.beginPath(); ctx.arc(cx, 180, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9aa3b5'; ctx.font = '600 12px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('방향', 40, 168);

      // 파워 게이지
      ctx.fillStyle = '#2c3444'; ctx.fillRect(40, 220, 360, 14);
      const pw = (phase === 'power' ? power : (ballAnim ? ballAnim.power : 0)) / 100 * 360;
      ctx.fillStyle = power > 40 ? '#ffd75f' : '#ff6b6b';
      ctx.fillRect(40, 220, pw, 14);
      ctx.fillStyle = '#9aa3b5';
      ctx.fillText('파워 (40 이상이어야 골대까지 도달)', 40, 213);

      // 공
      if (ballAnim) {
        ballAnim.t += dt * 3;
        const bx = 220 + (ballAnim.x - 220) * Math.min(1, ballAnim.t);
        const by = 260 + (85 - 260) * Math.min(1, ballAnim.t);
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fill();
        if (ballAnim.t >= 1.3) { ballAnim = null; afterShot(); }
      } else if (phase !== 'anim') {
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath(); ctx.arc(220, 260, 10, 0, Math.PI * 2); ctx.fill();
      }

      ctx.fillStyle = '#9aa3b5'; ctx.font = '600 14px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(`슛 ${shots.length}/3`, 430, 283);
    });

    function afterShot() {
      const s = shots[shots.length - 1];
      sfx[s.goal ? 'goal' : 'kick']();
      status.innerHTML = `AI 코치: ${s.goal ? `${ic('soccer',15)} 골!` : `${ic('glove',15)} 노골.`} 파워 <b>${s.power}</b> · 정확도 <b>${s.acc}</b>`;
      if (shots.length >= 3) {
        btn.disabled = true;
        timer(() => {
          runCleanup(); // 슛 게임의 rAF 중단
          root.innerHTML = '';
          const goals = shots.filter(s2 => s2.goal).length;
          root.appendChild(h(`<div class="m-result">
            <div class="big">${bigIc('chart',52)}</div>
            <h3>슛 기록 완료! (${goals}골)</h3>
            <p>AI 코치가 세 번의 슛을 모두 분석해 저장했습니다.<br>
            이 데이터는 <b>데이터 분석실</b>에서 포지션 추천에 사용됩니다!</p>
          </div>`));
          const fin = h(`<button class="btn-action">데이터 저장</button>`);
          fin.addEventListener('click', () => {
            // 미션 성공이 확정된 시점에만 슛 데이터 저장
            missionData.shots = shots;
            done(true);
          });
          root.appendChild(fin);
        }, 900);
      } else {
        phase = 'dir';
        btn.disabled = false;
        btn.innerHTML = `${ic('soccer', 18)} 방향 결정!`;
        newKeeper();
        timer(() => {
          status.innerHTML = `슛 ${shots.length + 1}/3 — <b>초록 구간</b>에서 방향을 정하세요!`;
        }, 1200);
      }
    }

    btn.addEventListener('click', () => {
      if (phase === 'dir') {
        lockedX = cursor;
        phase = 'power';
        power = 0; pDir = 1;
        btn.innerHTML = `${ic('burst', 18)} 슛!`;
        status.innerHTML = '파워를 모아 <b>슛</b>! (노란 구간까지)';
        sfx.tap();
      } else if (phase === 'power') {
        phase = 'anim';
        btn.disabled = true;
        const blocked = lockedX >= keeperX && lockedX <= keeperX + keeperW;
        const weak = power < 40;
        // 정확도: 키퍼 없는 구간의 중앙에 가까울수록 높음
        const openCenter = keeperX > 220 ? (40 + keeperX) / 2 : (keeperX + keeperW + 400) / 2;
        const acc = Math.max(10, Math.round(100 - Math.abs(lockedX - openCenter) / 3.6));
        shots.push({ power: Math.round(power), acc, goal: !blocked && !weak });
        ballAnim = { x: lockedX, t: 0, power };
      }
    });
  },

  // 9. 데이터 분석실 — 데이터 검증 + AI 포지션 추천
  9(root, done) {
    // 1단계: 데이터 검증 (이상치 찾기)
    root.appendChild(h(`<p class="m-status">분석 전 데이터 검증! 패턴이 <b>다른 하나</b>를 찾으세요. <span id="data-timer">10</span>초</p>`));
    const pair = [['01', '10'], ['AA', 'AB'], ['▲▲', '▲▼']][Math.floor(Math.random() * 3)];
    const oddIdx = Math.floor(Math.random() * 16);
    const grid = h(`<div class="data-grid"></div>`);
    let solved = false;
    for (let i = 0; i < 16; i++) {
      const isOdd = i === oddIdx;
      const cell = h(`<button class="data-cell">${isOdd ? pair[1] : pair[0]}</button>`);
      cell.addEventListener('click', () => {
        if (solved) return;
        if (isOdd) {
          solved = true;
          sfx.ok();
          cell.style.borderColor = '#5ee6a8';
          timer(analyze, 500);
        } else {
          sfx.bad();
          cell.classList.add('wrong');
          timer(() => cell.classList.remove('wrong'), 350);
        }
      });
      grid.appendChild(cell);
    }
    root.appendChild(grid);

    let remain = 10;
    const tid = ticker(() => {
      if (solved) { clearInterval(tid); return; }
      remain--;
      const el = root.querySelector('#data-timer');
      if (el) el.textContent = remain;
      if (remain <= 0) { clearInterval(tid); done(false); }
    }, 1000);

    // 2단계: AI 코치의 포지션 추천
    function analyze() {
      const shots = missionData.shots;
      const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
      const power = shots ? avg(shots.map(s => s.power)) : 62;
      const acc = shots ? avg(shots.map(s => s.acc)) : 58;
      const goals = shots ? shots.filter(s => s.goal).length : 1;

      let pos, why;
      if (power >= 70 && acc >= 70) { pos = '스트라이커|soccer'; why = '강한 파워와 높은 정확도 — 골문 앞에서 가장 위협적인 유형입니다.'; }
      else if (acc >= 70) { pos = '미드필더|target'; why = '정확도가 뛰어나요. 경기를 조립하는 정교한 패스 마스터 유형입니다.'; }
      else if (power >= 70) { pos = '수비수|shield'; why = '파워가 좋아요. 위기 상황을 시원하게 걷어내는 든든한 유형입니다.'; }
      else { pos = '골키퍼|glove'; why = '침착한 판단력이 돋보여요. 마지막 순간 팀을 구하는 수호신 유형입니다.'; }

      const [posName, posIcon] = pos.split('|');
      root.innerHTML = '';
      root.appendChild(h(`<div>
        <p class="quiz-progress">AI 코치 분석 결과 ${shots ? '' : '(표준 데이터 기준)'}</p>
        <div class="m-result" style="padding-top:6px">
          <div class="big">${bigIc(posIcon || 'chart', 52)}</div>
          <h3>추천 포지션: ${posName}</h3>
          <p>${why}</p>
        </div>
        <div class="stat-bars">
          <div class="stat-bar"><span>슛 파워</span><div class="bar"><i style="width:${power}%"></i></div><b>${power}</b></div>
          <div class="stat-bar"><span>정확도</span><div class="bar"><i style="width:${acc}%"></i></div><b>${acc}</b></div>
          <div class="stat-bar"><span>득점</span><div class="bar"><i style="width:${goals / 3 * 100}%"></i></div><b>${goals}/3</b></div>
        </div>
      </div>`));
      const next = h(`<button class="btn-action">그런데…</button>`);
      next.addEventListener('click', () => {
        runReflect(root, {
          lead: '생각해 볼 질문',
          question: '마음속으로는 멋진 공격수를 꿈꾸는데, AI가 데이터만 보고 “당신은 골키퍼가 더 적합합니다”라고 말한다면 — 여러분은 어떤 선택을 하시겠어요?',
          answers: [
            { t: 'AI 분석을 참고해 진로를 바꾼다', r: '데이터는 내가 못 보던 나를 보여 주죠. 다만 데이터는 ‘지금까지의 나’일 뿐, ‘앞으로의 나’는 아직 기록되지 않았어요.' },
            { t: '내 꿈을 믿고 계속 노력한다', r: 'AI는 과거를 분석하지만, 노력은 미래를 바꿉니다. 데이터가 따라오게 만들면 되죠!' },
            { t: '둘 다 — 꿈은 지키고 데이터로 보완한다', r: 'AI를 나침반으로 쓰되 핸들은 내가 잡는 것. 어쩌면 가장 현명한 답일지도 몰라요.' },
          ],
        }, done);
      });
      root.appendChild(next);
    }
  },

  // 10. 운과 확률 — 다트로 풍선을 터뜨려 황금 열쇠 찾기
  10(root, done) {
    const W = 440, H = 300;
    root.appendChild(h(`<p class="m-status" id="dart-status">움직이는 조준점으로 풍선을 노리세요. 어딘가에 <b>${ic('key',15)} 황금 열쇠</b>가!</p>`));
    const cv = h(`<canvas class="game-canvas" width="${W}" height="${H}"></canvas>`);
    root.appendChild(cv);
    const throwBtn = h(`<button class="btn-action">${ic('target',18)} 다트 던지기!</button>`);
    root.appendChild(throwBtn);
    const status = root.querySelector('#dart-status');
    const ctx = cv.getContext('2d');

    const COLORS = ['#e2574c', '#ffd75f', '#5ee6a8', '#6aa7ff', '#ec5fa3', '#b388ff', '#ef9a3c', '#4dd0e1', '#aed581'];
    const balloons = Array.from({ length: 9 }, (_, i) => ({
      x: 90 + (i % 3) * 130,
      y: 60 + Math.floor(i / 3) * 80,
      popped: false,
      hasKey: false,
    }));
    balloons[Math.floor(Math.random() * 9)].hasKey = true;

    let t0 = performance.now();
    let throws = 0, foundKey = false, dartAnim = null;

    raf((now) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      // 풍선
      balloons.forEach((b, i) => {
        if (b.popped) {
          drawIcon(ctx, b.hasKey ? 'key' : 'star', b.x, b.y, 26, b.hasKey ? '#ffd75f' : '#9aa3b5', 2);
        } else {
          const bob = Math.sin(t * 1.6 + i) * 3;
          ctx.fillStyle = COLORS[i];
          ctx.beginPath();
          ctx.ellipse(b.x, b.y + bob, 24, 30, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.35)';
          ctx.beginPath(); ctx.moveTo(b.x, b.y + 30 + bob); ctx.lineTo(b.x, b.y + 44 + bob); ctx.stroke();
        }
      });

      // 조준점 (리사주 궤적)
      const cx = W / 2 + Math.sin(t * 1.9) * 165;
      const cy = H / 2 - 20 + Math.sin(t * 2.7 + 1) * 95;
      if (!foundKey) {
        ctx.strokeStyle = '#ffd75f'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.stroke();
      }
      cv._aim = { x: cx, y: cy };

      // 다트 애니메이션
      if (dartAnim) {
        dartAnim.t += 0.12;
        const p = Math.min(1, dartAnim.t);
        const dx = W / 2 + (dartAnim.x - W / 2) * p;
        const dy = H + 10 + (dartAnim.y - H - 10) * p;
        drawIcon(ctx, 'target', dx, dy, 22, '#5ee6a8', 2);
        if (p >= 1) { resolveThrow(dartAnim.x, dartAnim.y); dartAnim = null; }
      }

      ctx.fillStyle = '#9aa3b5'; ctx.font = '600 14px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(`던진 다트: ${throws}`, W - 10, H - 12);
    });

    function resolveThrow(x, y) {
      const hit = balloons.find(b => !b.popped && Math.hypot(b.x - x, b.y - y) < 32);
      if (hit) {
        hit.popped = true;
        sfx.goal();
        if (hit.hasKey) {
          foundKey = true;
          sfx.stamp();
          throwBtn.disabled = true;
          status.innerHTML = `${ic('key',16)} <b>황금 열쇠 발견!</b> (다트 ${throws}개 만에)`;
          timer(() => reveal(), 900);
        } else {
          status.innerHTML = `${ic('star',16)} 펑! 열쇠는 없었어요. 계속 던져 보세요!`;
        }
      } else {
        sfx.bad();
        status.innerHTML = '빗나갔어요! 조준점이 풍선 위에 올 때 던지세요.';
      }
      if (!foundKey) throwBtn.disabled = false;
    }

    function reveal() {
      runCleanup(); // 다트 게임의 rAF 중단
      root.innerHTML = '';
      root.appendChild(h(`<div class="m-result">
        <div class="big">${bigIc('key',52)}</div>
        <h3>황금 열쇠를 찾았다! (다트 ${throws}개)</h3>
        <p>“와, 운이 좋았다!” 라고 느끼셨나요?<br>
        사실 이 게임 뒤에는 <b>난수 생성 알고리즘</b>이 숨어 있습니다.<br>
        우리가 ‘운’이라 믿었던 열쇠의 등장은, 시스템이 설계해 둔 <b>계산의 결과</b>였던 거죠.</p>
      </div>`));
      const next = h(`<button class="btn-action">그렇다면…</button>`);
      next.addEventListener('click', () => {
        runReflect(root, {
          lead: '생각해 볼 질문',
          question: '모든 것이 계산된 AI 시스템 안에서, 인간만이 누릴 수 있는 ‘우연한 행운’과 ‘예측할 수 없는 즐거움’은 사라지게 될까요?',
          answers: [
            { t: '계산된 행운도 즐거우면 그만', r: '게임 속 행운이 설계된 것이어도 심장이 뛴 건 진짜였죠. 즐거움 자체는 계산될 수 없을지도요.' },
            { t: '진짜 우연이 사라지는 건 아쉽다', r: '예측 불가능함이야말로 놀이의 심장이죠. 그래서 ‘우연을 지키는 설계’가 미래 게임의 숙제일지도 모릅니다.' },
            { t: '인간의 선택이 있는 한 우연은 남는다', r: '어느 풍선을 노릴지 정한 건 알고리즘이 아니라 당신이었어요. 선택이 있는 곳에 우연은 살아 있습니다.' },
          ],
        }, done);
      });
      root.appendChild(next);
    }

    throwBtn.addEventListener('click', () => {
      if (dartAnim || foundKey) return;
      throws++;
      throwBtn.disabled = true;
      sfx.tap();
      dartAnim = { x: cv._aim.x, y: cv._aim.y, t: 0 };
    });
  },

  // 11. 아메카 — 표정 기억 매칭 + 자유도 퀴즈
  11(root, done) {
    const FACES = ['faceSmile', 'faceSad', 'faceAngry', 'faceSurprise', 'faceCool', 'faceThink', 'faceLove', 'faceWink'];
    let round = 0;
    const ROUNDS = 3;

    function play() {
      root.innerHTML = '';
      const target = FACES[Math.floor(Math.random() * FACES.length)];
      root.appendChild(h(`<p class="m-status">라운드 <b>${round + 1}/${ROUNDS}</b> — 아메카의 표정을 기억하세요!</p>`));
      const show = h(`<div class="face-target">${svgIcon(target, { size: 76 })}</div>`);
      root.appendChild(show);

      timer(() => {
        show.innerHTML = svgIcon('faceRobot', { size: 76 });
        const opts = new Set([target]);
        while (opts.size < 4) opts.add(FACES[Math.floor(Math.random() * FACES.length)]);
        const arr = [...opts].sort(() => Math.random() - 0.5);
        const grid = h(`<div class="face-opts"></div>`);
        arr.forEach(f => {
          const b = h(`<button class="face-opt">${svgIcon(f, { size: 40 })}</button>`);
          b.addEventListener('click', () => {
            if (f === target) {
              sfx.ok();
              round++;
              if (round >= ROUNDS) quiz(); else play();
            } else {
              sfx.bad();
              b.classList.add('wrong');
              timer(() => b.classList.remove('wrong'), 400);
            }
          });
          grid.appendChild(b);
        });
        root.appendChild(grid);
        root.appendChild(h(`<p class="m-status">방금 아메카가 지은 표정과 같은 것을 고르세요</p>`));
      }, 1500);
    }

    function quiz() {
      runQuiz(root, [
        {
          q: '아메카가 표정을 잘 짓는 비결! 로봇공학에서 ‘로봇이 독립적으로 움직일 수 있는 방향의 수’를 뜻하는 말은?',
          opts: ['자유도', '해상도', '마력'],
          answer: 0,
          explain: '모터 1개당 1자유도 — 따로따로 움직일 수 있는 관절의 개수라고 생각하면 됩니다. 자유도가 많을수록 섬세하게 움직여요.',
        },
        {
          q: '아메카의 머리(얼굴 포함)에는 자유도가 몇 개나 있을까요?',
          opts: ['27개', '3개', '270개'],
          answer: 0,
          explain: '머리에만 27개! 반면 목에는 5개뿐이라, 고개를 숙이는 모습이 사람보다 조금 뻣뻣해 보일 수 있어요. (사람 목 근육은 20개 이상!)',
        },
      ], done);
    }

    play();
  },
};
