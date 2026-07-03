// ===== HUD / 기록장 / 토스트 / 타임아웃 경고 / 엔딩 =====
import { ZONES, SEQUENCE } from './config.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

let toastTimer = null;

export const ui = {
  init({ onInteract, onReset, onIdleContinue }) {
    // 기록장 (미션 순서대로)
    const grid = $('stamp-grid');
    grid.innerHTML = '';
    SEQUENCE.forEach((zoneId, i) => {
      const z = ZONES.find(zz => zz.id === zoneId);
      const el = document.createElement('div');
      el.className = 'stamp';
      el.id = `stamp-${z.id}`;
      el.innerHTML = `
        <div class="s-num" style="background:${z.color}">${i + 1}</div>
        <div class="s-name">${z.name}</div>
        <div class="s-mark">·</div>`;
      grid.appendChild(el);
    });

    $('btn-stamps').addEventListener('click', () => {
      sfx.tap();
      $('stampbook-modal').classList.remove('hidden');
    });
    $('stampbook-close').addEventListener('click', () => {
      sfx.tap();
      $('stampbook-modal').classList.add('hidden');
    });
    $('btn-reset').addEventListener('click', () => {
      if (confirm('모든 기록을 지우고 처음부터 시작할까요?')) onReset();
    });

    this._onInteract = onInteract;
    $('prompt').addEventListener('click', () => {
      if (this._promptZoneId != null) this._onInteract(this._promptZoneId);
    });

    $('idle-continue').addEventListener('click', () => {
      sfx.tap();
      onIdleContinue();
    });
  },

  showHUD(v = true) { $('hud').classList.toggle('hidden', !v); },

  // 진행 상황: done = 완료한 미션 수
  updateProgress(doneCount, nextZone) {
    $('stamp-count').textContent = doneCount;
    SEQUENCE.forEach((zoneId, i) => {
      const el = $(`stamp-${zoneId}`);
      if (!el) return;
      const isDone = i < doneCount;
      const isNext = i === doneCount;
      el.classList.toggle('done', isDone);
      el.classList.toggle('next', isNext);
      el.querySelector('.s-mark').textContent = isDone ? '✓' : (isNext ? '▶' : '🔒');
    });
    const hudNext = $('hud-next');
    if (nextZone) {
      hudNext.innerHTML = `다음 미션 <b>${doneCount + 1}/10</b> — ${nextZone.name}`;
      hudNext.classList.remove('hidden');
    } else if (doneCount >= SEQUENCE.length) {
      hudNext.innerHTML = `🔑 황금 열쇠 획득 — 현실로 귀환합니다`;
      hudNext.classList.remove('hidden');
    } else {
      hudNext.classList.add('hidden');
    }
  },

  _promptZoneId: null,
  showPrompt(zoneId, text) {
    const p = $('prompt');
    if (zoneId == null) {
      this._promptZoneId = null;
      p.classList.add('hidden');
      return;
    }
    if (this._promptZoneId === zoneId && !p.classList.contains('hidden') && p.textContent === text) return;
    this._promptZoneId = zoneId;
    p.textContent = text;
    p.classList.remove('hidden');
  },

  toast(msg, ms = 2200) {
    const t = $('toast');
    t.innerHTML = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  },

  // 타임아웃 경고
  showIdleWarning(remainSec) {
    $('idle-remain').textContent = remainSec;
    $('idle-warning').classList.remove('hidden');
  },
  hideIdleWarning() { $('idle-warning').classList.add('hidden'); },

  showEnding({ minutes }) {
    $('ending-text').innerHTML = `
      황금 열쇠가 빛나며 통로가 열리고, 당신은 현실 세계로 돌아왔습니다.<br>
      로봇과 AI가 만든 미스터리 놀이터에서의 <b>10가지 미션 기록</b>이 아카이브에 저장되었습니다.<br><br>
      “로봇과 인공지능은 미래의 놀이 문화를 어떻게 바꾸게 될까?”<br>
      이제 당신만의 답을 가지고 있겠죠.<br><br>
      <span class="ending-credit">서울로봇인공지능과학관 — 이야기가 시작되는 곳</span>`;
    $('ending-stats').innerHTML = `
      <div class="stat"><div class="v">10/10</div><div class="k">완료한 미션</div></div>
      <div class="stat"><div class="v">${minutes}분</div><div class="k">탐험 시간</div></div>`;
    $('ending').classList.remove('hidden');
  },

  hideEnding() { $('ending').classList.add('hidden'); },

  showSplash(v = true) { $('splash').classList.toggle('hidden', !v); },
};
