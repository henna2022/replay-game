// ===== 존별 미션 (기획 대본 기반: 미니게임 + 퀴즈 + 생각 문답) =====
import { sfx } from './audio.js';

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
      <div class="big">🏅</div>
      <h3>미션 성공!</h3>
      <p>「${zone.name}」 미션이 아카이브에 기록되었습니다.</p>
    </div>`));
    const ok = h(`<button class="btn-action">기록 확인</button>`);
    ok.addEventListener('click', () => closeMission(true));
    b.appendChild(ok);
  } else {
    sfx.bad();
    b.appendChild(h(`<div class="m-result">
      <div class="big">🤖</div>
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
          if (q.explain) root.appendChild(h(`<div class="quiz-explain">💡 ${q.explain}</div>`));
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
            status.textContent = '정확해요! 다음 라운드 🎉';
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

/* ---------- 존별 미션 구현 ---------- */

const MISSIONS = {

  // 2. 로봇 댄스 — 안무 따라 추기 + 무대 기술 퀴즈
  2(root, done) {
    runSimon(root, {
      pads: [
        { icon: '🙌', name: '만세', glow: 'rgba(255,120,120,.6)' },
        { icon: '👏', name: '박수', glow: 'rgba(120,180,255,.6)' },
        { icon: '🕺', name: '웨이브', glow: 'rgba(255,215,95,.6)' },
        { icon: '🤖', name: '로봇춤', glow: 'rgba(94,230,168,.6)' },
      ],
      rounds: [3, 4, 5],
      playPad: (i) => sfx.pad(i),
      watchText: '로봇 댄서의 안무를 잘 보세요…',
      goText: '이제 그대로 따라 추세요!',
    }, (ok) => {
      if (!ok) return done(false);
      runQuiz(root, [
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
      ], done);
    });
  },

  // 3. 로봇팔스튜디오 — 배경 선택 → 앵글 촬영 → AI 합성
  3(root, done) {
    const BGS = [
      { icon: '🌌', name: '우주' },
      { icon: '🌊', name: '바닷속' },
      { icon: '🏔️', name: '설산' },
    ];
    // 1단계: 배경 선택
    root.appendChild(h(`<p class="quiz-q">원하는 배경을 하나 선택하세요.</p>`));
    const grid = h(`<div class="face-opts" style="grid-template-columns:repeat(3,1fr)"></div>`);
    BGS.forEach(bg => {
      const b = h(`<button class="face-opt">${bg.icon}<div style="font-size:13px;margin-top:6px">${bg.name}</div></button>`);
      b.addEventListener('click', () => { sfx.tap(); shoot(bg); });
      grid.appendChild(b);
    });
    root.appendChild(grid);

    // 2단계: 로봇팔 카메라 앵글 촬영 (타이밍)
    function shoot(bg) {
      root.innerHTML = '';
      root.appendChild(h(`<p class="m-status" id="arm-status">로봇팔 카메라가 <b>목표 앵글(초록 칸)</b>에 올 때 촬영! (3장)</p>`));
      const cv = h(`<canvas class="game-canvas" width="440" height="240"></canvas>`);
      root.appendChild(cv);
      const grabBtn = h(`<button class="btn-action">📸 촬영!</button>`);
      root.appendChild(grabBtn);
      const status = root.querySelector('#arm-status');
      const ctx = cv.getContext('2d');

      const SLOTS = 5;
      let armX = 40, dir = 1, speed = 130, target = 2, got = 0, misses = 0, flashUntil = 0, flashOk = false;
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
          ctx.beginPath();
          ctx.roundRect(slotX(i) - 32, 150, 64, 64, 10);
          ctx.fill(); ctx.stroke();
          if (i === target) {
            ctx.fillStyle = '#5ee6a8';
            ctx.font = '700 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('ANGLE', slotX(i), 236);
          }
        }
        ctx.fillStyle = '#2c3444'; ctx.fillRect(20, 28, 400, 8);
        ctx.fillStyle = now < flashUntil ? (flashOk ? '#5ee6a8' : '#ff6b6b') : '#ef9a3c';
        ctx.fillRect(armX - 10, 30, 20, 70);
        ctx.fillRect(armX - 22, 96, 44, 14);
        // 카메라 헤드
        ctx.fillStyle = '#20242e';
        ctx.fillRect(armX - 16, 110, 32, 22);
        ctx.fillStyle = '#7ef7ff';
        ctx.beginPath(); ctx.arc(armX, 121, 6, 0, Math.PI * 2); ctx.fill();
      });

      grabBtn.addEventListener('click', () => {
        const hit = Math.abs(armX - slotX(target)) < 30;
        flashUntil = performance.now() + 300;
        flashOk = hit;
        if (hit) {
          got++;
          sfx.ok();
          speed += 55;
          target = (target + 2 + Math.floor(Math.random() * 2)) % SLOTS;
          status.innerHTML = `찰칵! <b>${got}/3</b>장 촬영했습니다.`;
          if (got >= 3) { grabBtn.disabled = true; timer(() => composite(bg), 500); }
        } else {
          misses++;
          sfx.bad();
          status.innerHTML = `앵글이 빗나갔어요! (실패 ${misses}/4)`;
          if (misses >= 4) { grabBtn.disabled = true; timer(() => done(false), 500); }
        }
      });
    }

    // 3단계: AI 합성 결과 + 생각 문답
    function composite(bg) {
      runCleanup(); // 촬영 게임의 rAF 중단
      root.innerHTML = '';
      root.appendChild(h(`<div class="m-result">
        <div class="big">${bg.icon}👤${bg.icon}</div>
        <h3>AI 합성 완료!</h3>
        <p>마치 ${bg.name}에서 촬영한 것처럼, AI가 당신과 배경을 자연스럽게 합성했습니다.</p>
      </div>`));
      const next = h(`<button class="btn-action">그런데…</button>`);
      next.addEventListener('click', () => {
        runReflect(root, {
          lead: '생각해 볼 질문',
          question: '이렇게 손쉽게 만들어진 화면을, 우리는 과연 ‘어디까지’ 믿을 수 있을까요?',
          answers: [
            { t: '눈으로 본 것도 의심해 봐야 한다', r: 'AI 합성이 쉬워질수록, 출처를 확인하는 habit이 중요해집니다. — 아, 습관이요! 로봇 티가 났네요. 🤖' },
            { t: '재미로 쓰면 문제없지 않을까?', r: '즐거운 도구인 건 분명해요. 다만 진짜처럼 보이는 가짜가 누군가를 속일 때 문제가 시작됩니다.' },
            { t: '믿을 수 있는 표시가 필요하다', r: '실제로 AI 생성물에 워터마크를 넣는 기술과 규칙이 세계 곳곳에서 만들어지고 있어요.' },
          ],
        }, done);
      });
      root.appendChild(next);
    }
  },

  // 4. 소형로봇전시 — 리쿠·러봇·발루 퀴즈 + 생각 문답
  4(root, done) {
    runQuiz(root, [
      {
        q: '머리 위에 살짝 손을 올리고, 눈이 보라색으로 바뀌면 말을 걸 수 있는 말동무 로봇은?',
        opts: ['리쿠', '러봇', '발루'],
        answer: 0,
        explain: '리쿠는 어르신들께는 말동무가 되어 드리고, 어린이집에서는 동화책을 읽어 주는 상호작용 로봇이에요.',
      },
      {
        q: '코를 살짝 누르면 웃고, 팔 안쪽에서 따뜻한 온기가 느껴지는 로봇은?',
        opts: ['발루', '러봇', '리쿠'],
        answer: 1,
        explain: '러봇은 러브(Love)와 로봇(Robot)을 합친 이름으로, 사랑을 주고받기 위해 태어난 친구입니다.',
      },
      {
        q: '풍선(벌룬)에서 이름을 따 왔고, 아무리 밀어도 절대 넘어지지 않는 이족보행 로봇은?',
        opts: ['발루', '리쿠', '러봇'],
        answer: 0,
        explain: '발루는 로봇공학자 데니스 홍 박사가 만든 로봇으로, 두 발로 걷는데도 넘어지지 않는 것이 특징이에요.',
      },
    ], (ok) => {
      if (!ok) return done(false);
      runReflect(root, {
        lead: '생각해 볼 질문',
        question: '언제나 내 말을 들어주고 내 기분에 완벽히 맞춰 주는 로봇 친구. 그런 친구와 오래 지내다 보면, 서로 부딪히며 맞춰가야 하는 ‘사람과 사람 사이의 관계’는 어떻게 느껴질까요?',
        answers: [
          { t: '사람 관계가 더 귀찮아질 것 같다', r: '솔직한 답이에요. 그래서 로봇이 주는 완벽한 편안함 속에서 우리가 놓치는 게 없는지 돌아보는 일이 중요합니다.' },
          { t: '그래도 사람 친구는 대체할 수 없다', r: '서툴게 부딪히고 화해하며 자라는 것이 사람 관계의 힘이죠. 로봇은 그걸 대신해 주지는 못할 거예요.' },
          { t: '둘 다 필요할 것 같다', r: '위로가 필요한 순간의 로봇, 함께 성장하는 사람 친구 — 균형을 아는 것이 미래의 지혜일지도 몰라요.' },
        ],
      }, done);
    });
  },

  // 5. AI사운드 뮤드럼 — 보코와 함께 떨어지는 드럼 노트 연주
  5(root, done) {
    const LANES = 4;
    const LANE_ICONS = ['🥁', '🪘', '🎩', '🛎️'];
    const LANE_COLORS = ['#ff7878', '#78b4ff', '#ffd75f', '#5ee6a8'];
    const W = 440, H = 340, HIT_Y = 270, FALL_SEC = 2.0;
    const TOTAL = 16, NEED = 12;

    root.appendChild(h(`<p class="m-status" id="drum-status">🐱 보코: “노트가 <b>회색 선</b>에 닿는 순간 그 줄을 탭!” (${NEED}/${TOTAL} 이상)</p>`));
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
        ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(LANE_ICONS[i], i * laneW + laneW / 2, H - 14);
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
              lead: '🐱 보코의 질문',
              question: '방금은 AI가 짜 놓은 리듬을 그대로 따라 연주했어요. 만약 AI가 알려주는 ‘정답’에만 맞춰 연주한다면, 그것을 나만의 음악이라고 할 수 있을까요?',
              answers: [
                { t: 'AI 리듬도 내가 연주하면 내 음악', r: '연주하는 손끝의 감정은 AI가 대신할 수 없죠. 도구는 빌려도 마음은 내 것이니까요.' },
                { t: '내 마음대로 쳐야 진짜 내 음악', r: '박자가 틀려도 내 기분을 담은 연주 — 보코도 가끔은 악보를 덮고 그렇게 연주한대요. 🐱' },
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
        status.innerHTML = `🐱 보코: “좋아요!” — 성공 <b>${hits}</b>/${TOTAL}`;
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
      const me = avatar ? `<span style="color:${avatar.color}">${avatar.face}</span>` : '👤';
      root.appendChild(h(`<div class="m-result">
        <div class="big">${me}🎤✨</div>
        <h3>팬미팅 성공! 찰칵 📸</h3>
        <p>${avatar
          ? `버추얼 아이돌이 아바타 ‘${avatar.name}’${avatar.face}와 기념사진을 찍었습니다.<br>가상 속에서의 이 만남은 어떤 의미일까요?`
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
    const FACES = ['😀', '😎', '🤖', '🦊'];
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
    const step2 = () => pickStep('아바타의 얼굴을 고르세요.', FACES, f => f, 'face', step3);
    const step3 = () => pickStep('아바타의 색을 고르세요.', COLORS,
      c => `<div style="width:34px;height:34px;border-radius:50%;background:${c};margin:0 auto"></div>`, 'color', reveal);

    function reveal() {
      root.innerHTML = '';
      root.appendChild(h(`<div class="m-result">
        <div class="big" style="color:${draft.color}">${draft.face}</div>
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
    const btn = h(`<button class="btn-action">⚽ 방향 결정!</button>`);
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
      status.innerHTML = `AI 코치: ${s.goal ? '⚽ 골!' : '🧤 노골.'} 파워 <b>${s.power}</b> · 정확도 <b>${s.acc}</b>`;
      if (shots.length >= 3) {
        btn.disabled = true;
        timer(() => {
          runCleanup(); // 슛 게임의 rAF 중단
          root.innerHTML = '';
          const goals = shots.filter(s2 => s2.goal).length;
          root.appendChild(h(`<div class="m-result">
            <div class="big">📊</div>
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
        btn.textContent = '⚽ 방향 결정!';
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
        btn.textContent = '💥 슛!';
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
      if (power >= 70 && acc >= 70) { pos = '스트라이커 ⚽'; why = '강한 파워와 높은 정확도 — 골문 앞에서 가장 위협적인 유형입니다.'; }
      else if (acc >= 70) { pos = '미드필더 🎯'; why = '정확도가 뛰어나요. 경기를 조립하는 정교한 패스 마스터 유형입니다.'; }
      else if (power >= 70) { pos = '수비수 🛡️'; why = '파워가 좋아요. 위기 상황을 시원하게 걷어내는 든든한 유형입니다.'; }
      else { pos = '골키퍼 🧤'; why = '침착한 판단력이 돋보여요. 마지막 순간 팀을 구하는 수호신 유형입니다.'; }

      root.innerHTML = '';
      root.appendChild(h(`<div>
        <p class="quiz-progress">AI 코치 분석 결과 ${shots ? '' : '(표준 데이터 기준)'}</p>
        <div class="m-result" style="padding-top:6px">
          <div class="big">${pos.split(' ')[1] || '📊'}</div>
          <h3>추천 포지션: ${pos}</h3>
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
    root.appendChild(h(`<p class="m-status" id="dart-status">움직이는 조준점으로 풍선을 노리세요. 어딘가에 <b>🔑 황금 열쇠</b>가!</p>`));
    const cv = h(`<canvas class="game-canvas" width="${W}" height="${H}"></canvas>`);
    root.appendChild(cv);
    const throwBtn = h(`<button class="btn-action">🎯 다트 던지기!</button>`);
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
          ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(b.hasKey ? '🔑' : '⭐', b.x, b.y + 9);
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
        ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('🎯', dx, dy);
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
          status.innerHTML = `🔑 <b>황금 열쇠 발견!</b> (다트 ${throws}개 만에)`;
          timer(() => reveal(), 900);
        } else {
          status.innerHTML = `⭐ 펑! 열쇠는 없었어요. 계속 던져 보세요!`;
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
        <div class="big">🔑</div>
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
    const FACES = ['😀', '😢', '😡', '😲', '😎', '🤔', '🥰', '😉'];
    let round = 0;
    const ROUNDS = 3;

    function play() {
      root.innerHTML = '';
      const target = FACES[Math.floor(Math.random() * FACES.length)];
      root.appendChild(h(`<p class="m-status">라운드 <b>${round + 1}/${ROUNDS}</b> — 아메카의 표정을 기억하세요!</p>`));
      const show = h(`<div class="face-target">${target}</div>`);
      root.appendChild(show);

      timer(() => {
        show.textContent = '🤖';
        const opts = new Set([target]);
        while (opts.size < 4) opts.add(FACES[Math.floor(Math.random() * FACES.length)]);
        const arr = [...opts].sort(() => Math.random() - 0.5);
        const grid = h(`<div class="face-opts"></div>`);
        arr.forEach(f => {
          const b = h(`<button class="face-opt">${f}</button>`);
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
