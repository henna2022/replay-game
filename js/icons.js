// ===== Stroke 기반 라인 아이콘 (DOM 인라인 SVG + 캔버스 공용) =====
// 각 아이콘은 24x24 viewBox 기준 ops 배열. 이모지 대체용.
// op 종류: ['p', dString] | ['c', cx, cy, r] | ['l', x1,y1,x2,y2] | ['pl', 'x y x y ...']

const I = {
  // --- 조작/UI ---
  close: [['l', 6, 6, 18, 18], ['l', 18, 6, 6, 18]],
  check: [['p', 'M4 12.5 L9.5 18 L20 6.5']],
  play: [['p', 'M8 5 L19 12 L8 19 Z']],
  lock: [['p', 'M6 11 h12 v9 h-12 z'], ['p', 'M8.5 11 V8 a3.5 3.5 0 0 1 7 0 v3']],
  eye: [['p', 'M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z'], ['c', 12, 12, 3]],
  tap: [['p', 'M9 11 V6 a2 2 0 0 1 4 0 v5'], ['p', 'M13 11 v-1 a2 2 0 0 1 4 0 v6 a5 5 0 0 1 -5 5 h-2 a4 4 0 0 1 -3.5 -2 L4 18 a2 2 0 0 1 3 -2.5 l1.8 1.5'], ['p', 'M13 11 a2 2 0 0 1 4 0']],
  keyboard: [['p', 'M3 6 h18 v12 h-18 z'], ['l', 6, 9, 6.1, 9], ['l', 9, 9, 9.1, 9], ['l', 12, 9, 12.1, 9], ['l', 15, 9, 15.1, 9], ['l', 18, 9, 18.1, 9], ['l', 8, 14, 16, 14]],
  joystick: [['c', 12, 8, 2.5], ['l', 12, 10.5, 12, 16], ['p', 'M7 20 q5 -3 10 0']],
  footprint: [['p', 'M8 4 c-2 0 -3 2 -3 5 c0 2 1 3 2.5 3 c1.5 0 2.5 -1 2.5 -3 c0 -3 -1 -5 -2 -5 Z'], ['c', 15, 11, 1.4], ['c', 17.5, 9, 1.1], ['p', 'M6 15 c-1 0 -1.5 1.2 -1.5 2.5 c0 1.3 0.8 2.2 2 2.2 c1.2 0 1.8 -0.9 1.8 -2.2 c0 -1.5 -1 -2.5 -2.3 -2.5 Z']],
  arrowKeys: [['p', 'M12 4 L8 9 h8 Z'], ['p', 'M12 20 L8 15 h8 Z']],

  // --- 사물/미션 ---
  key: [['c', 8, 8, 4], ['p', 'M11 11 L20 20'], ['l', 17, 17, 19, 15], ['l', 20, 20, 22, 18]],
  medal: [['c', 12, 15, 5], ['p', 'M9 10.5 L7 3 h4 l1.5 4'], ['p', 'M15 10.5 L17 3 h-4 l-1.5 4'], ['p', 'M12 13 l1 2 h-2 z']],
  robot: [['p', 'M6 9 h12 v9 h-12 z'], ['l', 12, 5, 12, 9], ['c', 12, 4.2, 1], ['c', 9.5, 13, 1.1], ['c', 14.5, 13, 1.1], ['l', 9.5, 16, 14.5, 16], ['l', 5, 12, 6, 12], ['l', 18, 12, 19, 12]],
  bulb: [['p', 'M12 3 a6 6 0 0 1 4 10.5 c-1 1 -1.2 2 -1.2 3 h-5.6 c0 -1 -0.2 -2 -1.2 -3 A6 6 0 0 1 12 3 Z'], ['l', 9.4, 19, 14.6, 19], ['l', 10, 21, 14, 21]],
  spark: [['p', 'M12 3 L13.4 9 L19 12 L13.4 15 L12 21 L10.6 15 L5 12 L10.6 9 Z']],
  robotArm: [['p', 'M5 20 h5'], ['p', 'M7.5 20 v-6 l6 -6'], ['c', 7.5, 13.5, 1.4], ['c', 13.5, 8, 1.4], ['p', 'M13.5 8 l3 -3'], ['p', 'M15 3.5 h4 v4 h-4 z']],
  camera: [['p', 'M3 8 h4 l1.6 -2.2 h6.8 L17 8 h4 v11 h-18 z'], ['c', 12, 13.5, 3.6], ['l', 18.5, 10.5, 18.6, 10.5]],
  qr: [['p', 'M4 4 h6 v6 h-6 z'], ['p', 'M14 4 h6 v6 h-6 z'], ['p', 'M4 14 h6 v6 h-6 z'], ['l', 14, 14, 16, 14], ['l', 14, 14, 14, 16], ['l', 18, 14, 20, 14], ['l', 20, 16, 20, 20], ['l', 14, 20, 14, 18], ['l', 17, 17, 20, 17], ['l', 17, 17, 17, 20]],
  alert: [['p', 'M12 3 L22 20 H2 Z'], ['l', 12, 9, 12, 14], ['l', 12, 17, 12, 17.1]],
  book: [['p', 'M4 5 a2 2 0 0 1 2 -2 h6 v16 h-6 a2 2 0 0 0 -2 2 Z'], ['p', 'M20 5 a2 2 0 0 0 -2 -2 h-6 v16 h6 a2 2 0 0 1 2 2 Z']],
  battery: [['p', 'M3 8 h15 v8 h-15 z'], ['l', 20, 11, 20, 13], ['l', 6, 11, 6, 13], ['l', 9, 11, 9, 13], ['l', 12, 11, 12, 13]],
  balloon: [['p', 'M12 3 c3.5 0 5.5 3 5.5 6.5 c0 4 -3 7 -5.5 7 c-2.5 0 -5.5 -3 -5.5 -7 C6.5 6 8.5 3 12 3 Z'], ['p', 'M12 16.5 l-1 2 h2 z'], ['p', 'M11.5 20.5 q1 -1 2 0']],
  user: [['c', 12, 8, 3.5], ['p', 'M5 20 c0 -4 3.5 -6 7 -6 s7 2 7 6']],
  mic: [['p', 'M12 3 a3 3 0 0 1 3 3 v5 a3 3 0 0 1 -6 0 V6 a3 3 0 0 1 3 -3 Z'], ['p', 'M6 11 a6 6 0 0 0 12 0'], ['l', 12, 17, 12, 21], ['l', 9, 21, 15, 21]],
  soccer: [['c', 12, 12, 9], ['p', 'M12 7 l4 3 -1.5 5 h-5 L8 10 Z']],
  glove: [['p', 'M8 21 v-6 l-2 -2 a1.5 1.5 0 0 1 2 -2 l1 1 V5 a1.4 1.4 0 0 1 2.8 0 v4 a1.4 1.4 0 0 1 2.8 0 v1 a1.4 1.4 0 0 1 2.6 0 v6 a4 4 0 0 1 -1.5 3 Z']],
  chart: [['l', 4, 20, 20, 20], ['p', 'M7 20 v-6 h3 v6'], ['p', 'M13 20 v-10 h3 v10']],
  target: [['c', 12, 12, 9], ['c', 12, 12, 5], ['c', 12, 12, 1.4]],
  shield: [['p', 'M12 3 L20 6 v6 c0 5 -4 8 -8 9 c-4 -1 -8 -4 -8 -9 V6 Z']],
  drum: [['p', 'M4 9 c0 -2 3.5 -3.5 8 -3.5 s8 1.5 8 3.5 v6 c0 2 -3.5 3.5 -8 3.5 s-8 -1.5 -8 -3.5 Z'], ['p', 'M4 9 c0 2 3.5 3.5 8 3.5 s8 -1.5 8 -3.5'], ['l', 6, 14, 3, 19], ['l', 18, 14, 21, 19]],
  cymbal: [['p', 'M3 9 q9 -3 18 0 q-9 3 -18 0 Z'], ['l', 12, 9.5, 12, 20]],
  bell: [['p', 'M12 4 a5 5 0 0 1 5 5 c0 4 1.5 6 2 7 h-14 c0.5 -1 2 -3 2 -7 a5 5 0 0 1 5 -5 Z'], ['p', 'M10.5 20 a1.5 1.5 0 0 0 3 0'], ['l', 12, 2.5, 12, 4]],
  cat: [['p', 'M6 8 L5 4 L9 6.5'], ['p', 'M18 8 L19 4 L15 6.5'], ['p', 'M5 11 a7 6 0 0 1 14 0 c0 4 -3 7 -7 7 s-7 -3 -7 -7 Z'], ['l', 10, 11, 10.1, 11], ['l', 14, 11, 14.1, 11], ['p', 'M12 13.5 v1.5'], ['l', 6.5, 13, 9.5, 13.8], ['l', 17.5, 13, 14.5, 13.8]],
  dog: [['p', 'M6 7 l1.5 3'], ['p', 'M18 7 l-1.5 3'], ['p', 'M6.5 9 a6 5 0 0 1 11 0 c0.5 4 -2.5 8 -5.5 8 s-6 -4 -5.5 -8 Z'], ['l', 9.5, 11, 9.6, 11], ['l', 14.5, 11, 14.6, 11], ['p', 'M11 14 q1 1 2 0']],
  dancer: [['c', 13, 5, 1.6], ['p', 'M13 6.6 L11 13 L7 12'], ['p', 'M13 9 L17 11'], ['p', 'M11 13 L9 20'], ['p', 'M11.5 15 L15 19']],
  star: [['p', 'M12 3 L14.6 9.2 L21 9.8 L16 14 L17.6 20.4 L12 16.8 L6.4 20.4 L8 14 L3 9.8 L9.4 9.2 Z']],
  burst: [['p', 'M12 3 L13.5 9 L12 12 L10.5 9 Z'], ['p', 'M21 12 L15 13.5 L12 12 L15 10.5 Z'], ['p', 'M12 21 L10.5 15 L12 12 L13.5 15 Z'], ['p', 'M3 12 L9 10.5 L12 12 L9 13.5 Z'], ['l', 5, 5, 8.5, 8.5], ['l', 19, 5, 15.5, 8.5], ['l', 19, 19, 15.5, 15.5], ['l', 5, 19, 8.5, 15.5]],
  heart: [['p', 'M12 20 C6 15.5 3 12.5 3 8.8 A4.2 4.2 0 0 1 12 6.5 A4.2 4.2 0 0 1 21 8.8 C21 12.5 18 15.5 12 20 Z']],
  hourglass: [['l', 6, 3, 18, 3], ['l', 6, 21, 18, 21], ['p', 'M7 3 c0 5 5 6 5 9 c0 3 -5 4 -5 9'], ['p', 'M17 3 c0 5 -5 6 -5 9 c0 3 5 4 5 9']],
  mission: [['p', 'M12 3 L20 7 v6 c0 5 -4 7 -8 8 c-4 -1 -8 -3 -8 -8 V7 Z'], ['p', 'M9 12 l2 2 l4 -4']],

  // --- 얼굴(구분용) ---
  faceSmile: [['c', 12, 12, 9], ['l', 9, 10, 9.1, 10], ['l', 15, 10, 15.1, 10], ['p', 'M8.5 14 a4 4 0 0 0 7 0']],
  faceSad: [['c', 12, 12, 9], ['l', 9, 10, 9.1, 10], ['l', 15, 10, 15.1, 10], ['p', 'M8.5 16 a4 4 0 0 1 7 0']],
  faceAngry: [['c', 12, 12, 9], ['l', 8, 9, 10.5, 10.5], ['l', 16, 9, 13.5, 10.5], ['p', 'M8.5 16 a4 4 0 0 1 7 0']],
  faceSurprise: [['c', 12, 12, 9], ['l', 9, 10, 9.1, 10], ['l', 15, 10, 15.1, 10], ['c', 12, 15, 1.8]],
  faceCool: [['c', 12, 12, 9], ['p', 'M6.5 9.5 h4 v2 a1 1 0 0 1 -4 0 z'], ['p', 'M13.5 9.5 h4 v2 a1 1 0 0 1 -4 0 z'], ['l', 10.5, 10, 13.5, 10], ['p', 'M8.5 15 a4 4 0 0 0 7 0']],
  faceThink: [['c', 12, 12, 9], ['l', 9, 10, 9.1, 10], ['l', 15, 10, 15.1, 10], ['l', 10, 15, 14, 15]],
  faceLove: [['c', 12, 12, 9], ['p', 'M7.5 10.5 a1 1 0 0 1 2 0 a1 1 0 0 1 -1 1.2 a1 1 0 0 1 -1 -1.2'], ['p', 'M14.5 10.5 a1 1 0 0 1 2 0 a1 1 0 0 1 -1 1.2 a1 1 0 0 1 -1 -1.2'], ['p', 'M8.5 14 a4 4 0 0 0 7 0']],
  faceWink: [['c', 12, 12, 9], ['l', 8, 10, 10, 10], ['l', 15, 10, 15.1, 10], ['p', 'M8.5 14 a4 4 0 0 0 7 0']],
  faceRobot: [['p', 'M6 8 h12 v10 h-12 z'], ['l', 12, 5, 12, 8], ['c', 12, 4.3, 0.9], ['l', 9, 12, 10.5, 12], ['l', 13.5, 12, 15, 12], ['l', 9.5, 15.5, 14.5, 15.5]],
  faceFox: [['p', 'M4 6 L10 10 M20 6 L14 10'], ['p', 'M5 8 L12 5 L19 8 L16 15 L12 18 L8 15 Z'], ['l', 9.5, 11, 9.6, 11], ['l', 14.5, 11, 14.6, 11], ['p', 'M12 14 l-1.2 1.2 h2.4 z']],
};

const ALIAS = {
  notebook: 'book', books: 'book', 'open-book': 'book',
  party: 'spark', sparkles: 'spark', bolt: 'spark',
  phone: 'qr',
  glove2: 'glove',
  hihat: 'cymbal', hat: 'cymbal',
  person: 'user', mic2: 'mic',
};

export function iconOps(name) {
  return I[name] || I[ALIAS[name]] || null;
}

// DOM 인라인 SVG 문자열
export function svgIcon(name, { size = 18, sw = 2, cls = '' } = {}) {
  const ops = iconOps(name);
  if (!ops) return '';
  let inner = '';
  for (const op of ops) {
    if (op[0] === 'p') inner += `<path d="${op[1]}"/>`;
    else if (op[0] === 'c') inner += `<circle cx="${op[1]}" cy="${op[2]}" r="${op[3]}"/>`;
    else if (op[0] === 'l') inner += `<line x1="${op[1]}" y1="${op[2]}" x2="${op[3]}" y2="${op[4]}"/>`;
    else if (op[0] === 'pl') inner += `<polyline points="${op[1]}"/>`;
  }
  return `<svg class="lni ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${inner}</svg>`;
}

// 정적 HTML의 [data-icon] 요소를 인라인 SVG로 채움
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.iconDone) return;
    const size = parseInt(el.dataset.iconSize || '18', 10);
    const sw = parseFloat(el.dataset.iconSw || '2');
    const svg = svgIcon(el.dataset.icon, { size, sw });
    if (svg) { el.innerHTML = svg; el.dataset.iconDone = '1'; }
  });
}

// 캔버스에 라인 아이콘 그리기 (중심 cx,cy / 한 변 size)
export function drawIcon(ctx, name, cx, cy, size, color = '#fff', lineWidth = 2) {
  const ops = iconOps(name);
  if (!ops) return;
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth / s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const op of ops) {
    ctx.beginPath();
    if (op[0] === 'p') { ctx.stroke(new Path2D(op[1])); continue; }
    else if (op[0] === 'c') ctx.arc(op[1], op[2], op[3], 0, Math.PI * 2);
    else if (op[0] === 'l') { ctx.moveTo(op[1], op[2]); ctx.lineTo(op[3], op[4]); }
    else if (op[0] === 'pl') {
      const pts = op[1].split(/\s+/).map(Number);
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    }
    ctx.stroke();
  }
  ctx.restore();
}
