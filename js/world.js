// ===== RE:PLAY 전시홀 + 벽 구조 + 11개 전시물 (저폴리) =====
import * as THREE from 'three';
import { ZONES, HALL_RADIUS, WALLS, FACILITY } from './config.js';

const texLoader = new THREE.TextureLoader();

const WALL_HEIGHT = 3.2;
const WALL_THICK = 0.35;

/* ---------- 공용 헬퍼 ---------- */

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, ...opts });
}
function glow(color, intensity = 1) {
  return new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.5,
  });
}
function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}
function cyl(rt, rb, h, material, seg = 16) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
}

// 한글 텍스트 캔버스 라벨
function makeLabel(text, { color = '#ffffff', bg = null, size = 90, w = 1024, h = 192 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.font = `800 ${size}px "Pretendard","Apple SD Gothic Neo",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeZoneSign(zone) {
  const g = new THREE.Group();
  const post = cyl(0.05, 0.05, 2.6, mat('#3a4152'));
  post.position.y = 1.3;
  g.add(post);

  const tex = makeLabel(`${zone.id}  ${zone.name}`, { color: '#ffffff', bg: '#161a24', size: 76 });
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.5),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  panel.position.y = 2.75;
  g.add(panel);
  const panelBack = panel.clone();
  panelBack.rotation.y = Math.PI;
  g.add(panelBack);

  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), glow(zone.color, 1.4));
  dot.position.y = 3.15;
  g.add(dot);
  return g;
}

// 사진 아카이브 액자 — assets/photos/zone-XX.jpg 가 있으면 자동 표시
function makePhotoPanel(zoneId) {
  const g = new THREE.Group();
  const frame = box(2.5, 1.75, 0.08, mat('#262c3a'));
  frame.position.y = 1.7;
  g.add(frame);

  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 352;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, 512, 352);
  ctx.strokeStyle = '#2c3444'; ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 484, 324);
  ctx.fillStyle = '#3d465c';
  ctx.font = '700 44px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('PHOTO ARCHIVE', 256, 160);
  ctx.font = '500 26px sans-serif';
  ctx.fillText(`zone-${String(zoneId).padStart(2, '0')}.jpg`, 256, 215);
  const placeholder = new THREE.CanvasTexture(canvas);
  placeholder.colorSpace = THREE.SRGBColorSpace;

  const photoMat = new THREE.MeshBasicMaterial({ map: placeholder });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.55), photoMat);
  photo.position.set(0, 1.7, 0.05);
  g.add(photo);

  texLoader.load(
    `assets/photos/zone-${String(zoneId).padStart(2, '0')}.jpg`,
    (tex) => { tex.colorSpace = THREE.SRGBColorSpace; photoMat.map = tex; photoMat.needsUpdate = true; },
    undefined,
    () => {}
  );
  return g;
}

function makeHumanoid(color, { emissiveBody = false } = {}) {
  const bodyMat = emissiveBody
    ? new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.7, transparent: true, opacity: 0.85 })
    : mat(color);
  const jointMat = emissiveBody ? bodyMat : mat('#20242e');

  const g = new THREE.Group();
  const torso = box(0.55, 0.7, 0.3, bodyMat); torso.position.y = 1.15; g.add(torso);
  const head = box(0.34, 0.32, 0.32, bodyMat); head.position.y = 1.72; g.add(head);
  const eyeMat = glow('#7ef7ff', 1.6);
  const eyeL = box(0.07, 0.05, 0.02, eyeMat); eyeL.position.set(-0.08, 1.74, 0.17); g.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.08; g.add(eyeR);

  const armL = new THREE.Group();
  const armMeshL = box(0.14, 0.6, 0.14, jointMat); armMeshL.position.y = -0.28; armL.add(armMeshL);
  armL.position.set(-0.37, 1.45, 0); g.add(armL);
  const armR = new THREE.Group();
  const armMeshR = box(0.14, 0.6, 0.14, jointMat); armMeshR.position.y = -0.28; armR.add(armMeshR);
  armR.position.set(0.37, 1.45, 0); g.add(armR);

  const legL = box(0.16, 0.75, 0.16, jointMat); legL.position.set(-0.15, 0.42, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);

  g.userData.arms = { l: armL, r: armR };
  g.userData.head = head;
  return g;
}

function makeCheckMark() {
  const tex = makeLabel('✓ 기록 완료', { color: '#5ee6a8', size: 96, w: 512, h: 160 });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.55),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false })
  );
  m.visible = false;
  return m;
}

/* ---------- 존별 전시물 빌더 ---------- */

const builders = {
  // 1. 통로(INTRO) — 귀환 게이트 + 키오스크
  1(zone) {
    const g = new THREE.Group();
    const pillarMat = mat('#232939');
    const p1 = box(0.4, 3.2, 0.4, pillarMat); p1.position.set(-1.6, 1.6, 0); g.add(p1);
    const p2 = p1.clone(); p2.position.x = 1.6; g.add(p2);
    const beam = box(3.9, 0.5, 0.5, pillarMat); beam.position.y = 3.35; g.add(beam);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.42),
      new THREE.MeshBasicMaterial({ map: makeLabel('RE:PLAY', { color: '#5ee6a8', size: 110 }), transparent: true })
    );
    sign.position.set(0, 3.36, 0.27); g.add(sign);

    // 게이트 안쪽 포털 막 (황금 열쇠 획득 시 활성화)
    const portal = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 2.9),
      new THREE.MeshBasicMaterial({ color: '#ffd75f', transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false })
    );
    portal.position.y = 1.55; g.add(portal);

    const kiosk = new THREE.Group();
    const stand = box(0.5, 1.0, 0.4, mat('#2a3040')); stand.position.y = 0.5; kiosk.add(stand);
    const screen = box(0.9, 0.6, 0.06, glow('#3aa66a', 0.6));
    screen.position.set(0, 1.2, 0); screen.rotation.x = -0.35; kiosk.add(screen);
    kiosk.position.set(2.4, 0, 0.9);
    g.add(kiosk);

    let t = 0, unlocked = false;
    return {
      group: g,
      setUnlocked(v) {
        unlocked = v;
        portal.material.opacity = v ? 0.4 : 0.06;
      },
      update(dt) {
        t += dt;
        sign.material.opacity = 0.75 + Math.sin(t * 2.2) * 0.25;
        if (unlocked) portal.material.opacity = 0.32 + Math.sin(t * 3) * 0.12;
      },
    };
  },

  // 2. 로봇 댄스 — 무대 + 춤추는 로봇 + 미러볼
  2(zone) {
    const g = new THREE.Group();
    const stage = cyl(2.1, 2.3, 0.35, mat('#20242e'), 24); stage.position.y = 0.175; g.add(stage);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.05, 8, 32), glow(zone.color, 1.2));
    edge.rotation.x = Math.PI / 2; edge.position.y = 0.36; g.add(edge);

    const robot = makeHumanoid('#e8e4da'); robot.position.y = 0.35; g.add(robot);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#cfd6e4', metalness: 0.9, roughness: 0.25, flatShading: true }));
    ball.position.y = 3.6; g.add(ball);

    const cones = [];
    ['#ff5f7a', '#5f8dff', '#ffd75f'].forEach((c, i) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 2.6, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
      );
      cone.position.set(Math.cos(i * 2.1) * 1.1, 2.4, Math.sin(i * 2.1) * 1.1);
      g.add(cone); cones.push(cone);
    });

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        robot.userData.arms.l.rotation.z = Math.sin(t * 4) * 0.9 + 0.4;
        robot.userData.arms.r.rotation.z = -Math.sin(t * 4 + 1) * 0.9 - 0.4;
        robot.rotation.y = Math.sin(t * 1.4) * 0.7;
        robot.position.y = 0.35 + Math.abs(Math.sin(t * 4)) * 0.08;
        ball.rotation.y = t * 1.5;
        cones.forEach((c, i) => { c.rotation.y = t * (0.6 + i * 0.2); c.rotation.x = Math.sin(t + i) * 0.18; });
      },
    };
  },

  // 3. 로봇팔스튜디오 — 작업대 + 로봇팔 카메라 + 배경 스크린
  3(zone) {
    const g = new THREE.Group();
    const table = box(2.6, 0.85, 1.4, mat('#2a3040')); table.position.y = 0.425; g.add(table);

    // 크로마키 배경 스크린
    const chroma = box(3.0, 2.2, 0.08, glow('#2f9e5f', 0.35));
    chroma.position.set(0, 1.6, -1.3); g.add(chroma);

    const armMat = mat('#ef9a3c');
    const base = cyl(0.3, 0.38, 0.3, mat('#20242e')); base.position.set(0, 1.0, -0.3); g.add(base);
    const seg1Pivot = new THREE.Group(); seg1Pivot.position.set(0, 1.15, -0.3); g.add(seg1Pivot);
    const seg1 = box(0.18, 1.0, 0.18, armMat); seg1.position.y = 0.5; seg1Pivot.add(seg1);
    const seg2Pivot = new THREE.Group(); seg2Pivot.position.y = 1.0; seg1Pivot.add(seg2Pivot);
    const seg2 = box(0.14, 0.8, 0.14, armMat); seg2.position.y = 0.4; seg2Pivot.add(seg2);
    // 그리퍼 대신 카메라 헤드
    const cam = box(0.3, 0.2, 0.24, mat('#20242e')); cam.position.y = 0.9; seg2Pivot.add(cam);
    const lens = cyl(0.07, 0.07, 0.1, glow('#7ef7ff', 1.4)); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.9, 0.16); seg2Pivot.add(lens);

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        seg1Pivot.rotation.z = Math.sin(t * 0.9) * 0.5;
        seg1Pivot.rotation.y = Math.sin(t * 0.5) * 0.8;
        seg2Pivot.rotation.z = Math.cos(t * 0.9) * 0.9 - 0.6;
      },
    };
  },

  // 4. 소형로봇전시(상호작용 로봇) — 리쿠 · 러봇 · 발루
  4(zone) {
    const g = new THREE.Group();
    const pedestal = box(3.2, 1.0, 1.2, mat('#242a38')); pedestal.position.y = 0.5; g.add(pedestal);

    const bots = [];

    // 리쿠 — 흰 몸통, 보라색 눈
    const liku = new THREE.Group();
    const lb = box(0.26, 0.3, 0.2, mat('#e8e4da')); lb.position.y = 0.15; liku.add(lb);
    const lh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat('#e8e4da')); lh.position.y = 0.4; liku.add(lh);
    const le = box(0.1, 0.04, 0.02, glow('#b388ff', 1.8)); le.position.set(0, 0.41, 0.12); liku.add(le);
    liku.position.set(-1.05, 1.0, 0); g.add(liku); bots.push(liku);

    // 러봇 — 빨간 옷, 둥근 몸
    const lovot = new THREE.Group();
    const vb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), mat('#e2574c')); vb.position.y = 0.2; lovot.add(vb);
    const vh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat('#f5e9dc')); vh.position.y = 0.42; lovot.add(vh);
    const ve1 = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), mat('#20242e')); ve1.position.set(-0.045, 0.44, 0.1); lovot.add(ve1);
    const ve2 = ve1.clone(); ve2.position.x = 0.045; lovot.add(ve2);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), glow('#ffab91', 1.2)); nose.position.set(0, 0.41, 0.115); lovot.add(nose);
    lovot.position.set(0, 1.0, 0); g.add(lovot); bots.push(lovot);

    // 발루 — 풍선 머리 이족보행
    const ballu = new THREE.Group();
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#8ecff5', roughness: 0.3, transparent: true, opacity: 0.9 }));
    balloon.scale.y = 1.25; balloon.position.y = 0.5; ballu.add(balloon);
    const legL = box(0.03, 0.34, 0.03, mat('#4a5568')); legL.position.set(-0.06, 0.17, 0); ballu.add(legL);
    const legR = legL.clone(); legR.position.x = 0.06; ballu.add(legR);
    ballu.position.set(1.05, 1.0, 0); g.add(ballu); bots.push(ballu);

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        bots[0].rotation.y = Math.sin(t) * 0.5;                       // 리쿠 두리번
        bots[1].position.y = 1.0 + Math.abs(Math.sin(t * 2.2)) * 0.04; // 러봇 콩콩
        bots[2].rotation.z = Math.sin(t * 1.6) * 0.14;                 // 발루 흔들 (안 넘어짐!)
      },
    };
  },

  // 5. AI사운드 뮤드럼 — 드럼셋 + 보코(고양이) 스크린
  5(zone) {
    const g = new THREE.Group();
    const stage = cyl(1.9, 2.0, 0.25, mat('#20242e'), 20); stage.position.y = 0.125; g.add(stage);

    const drumMat = mat('#42a5f5', { roughness: 0.4 });
    const kick = cyl(0.55, 0.55, 0.5, drumMat); kick.rotation.z = Math.PI / 2; kick.rotation.y = Math.PI / 2; kick.position.set(0, 0.8, 0.2); g.add(kick);
    const tom1 = cyl(0.3, 0.3, 0.35, drumMat); tom1.position.set(-0.55, 1.25, 0); g.add(tom1);
    const tom2 = tom1.clone(); tom2.position.x = 0.55; g.add(tom2);
    const cymbalMat = mat('#e6c15a', { metalness: 0.8, roughness: 0.3 });
    const cym1 = cyl(0.42, 0.42, 0.03, cymbalMat); cym1.position.set(-1.0, 1.65, -0.2); g.add(cym1);
    const cym2 = cym1.clone(); cym2.position.x = 1.0; g.add(cym2);
    const stand1 = cyl(0.03, 0.03, 1.6, mat('#3a4152')); stand1.position.set(-1.0, 0.85, -0.2); g.add(stand1);
    const stand2 = stand1.clone(); stand2.position.x = 1.0; g.add(stand2);

    const stickL = box(0.05, 0.5, 0.05, mat('#e8e4da')); stickL.position.set(-0.55, 1.75, 0.3); stickL.rotation.x = 0.6; g.add(stickL);
    const stickR = stickL.clone(); stickR.position.x = 0.55; g.add(stickR);

    // 보코 스크린 (고양이 AI 선생님)
    const bokoTex = makeLabel('🐱 BOKO', { color: '#ffd75f', bg: '#131824', size: 88, w: 512, h: 192 });
    const boko = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.55), new THREE.MeshBasicMaterial({ map: bokoTex }));
    boko.position.set(0, 2.3, -0.6); g.add(boko);

    const wave = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.03, 8, 40), glow(zone.color, 1.0));
    wave.rotation.x = Math.PI / 2; wave.position.y = 2.9; g.add(wave);

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        stickL.rotation.x = 0.6 + Math.max(0, Math.sin(t * 6)) * 0.7;
        stickR.rotation.x = 0.6 + Math.max(0, Math.sin(t * 6 + Math.PI)) * 0.7;
        const s = 1 + Math.sin(t * 6) * 0.08;
        wave.scale.set(s, s, 1);
        cym1.rotation.z = Math.sin(t * 6) * 0.04;
        cym2.rotation.z = Math.sin(t * 6 + 1) * 0.04;
      },
    };
  },

  // 6. 버추얼 아이돌 — 홀로그램 팬미팅 무대
  6(zone) {
    const g = new THREE.Group();
    const stage = cyl(1.7, 1.9, 0.3, mat('#20242e'), 24); stage.position.y = 0.15; g.add(stage);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.045, 8, 40), glow(zone.color, 1.5));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.31; g.add(ring);

    const idol = makeHumanoid(zone.color, { emissiveBody: true });
    idol.position.y = 0.5; g.add(idol);

    const sticks = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const s = new THREE.Group();
      const pole = cyl(0.03, 0.03, 0.7, mat('#3a4152')); pole.position.y = 0.35; s.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), glow('#ffd75f', 1.2)); bulb.position.y = 0.78; s.add(bulb);
      s.position.set(Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6);
      g.add(s); sticks.push(bulb);
    }

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        idol.position.y = 0.5 + Math.sin(t * 1.8) * 0.12;
        idol.rotation.y = t * 0.7;
        idol.userData.arms.l.rotation.z = Math.sin(t * 2.5) * 0.6 + 0.9;
        idol.userData.arms.r.rotation.z = -Math.sin(t * 2.5) * 0.6 - 0.9;
        sticks.forEach((b, i) => { b.material.emissiveIntensity = 0.7 + Math.max(0, Math.sin(t * 3 + i)) * 1.2; });
      },
    };
  },

  // 7. 디지털 아바타 — 대형 스크린 + 얼굴
  7(zone) {
    const g = new THREE.Group();
    const frame = box(2.9, 2.0, 0.18, mat('#20242e')); frame.position.y = 1.9; g.add(frame);

    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 352;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.8), new THREE.MeshBasicMaterial({ map: tex }));
    screen.position.set(0, 1.9, 0.1); g.add(screen);

    const stand = box(0.5, 0.9, 0.5, mat('#2a3040')); stand.position.y = 0.45; g.add(stand);

    function drawFace(blink, hue) {
      ctx.fillStyle = '#0d1020'; ctx.fillRect(0, 0, 512, 352);
      ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(256, 176, 110, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `hsl(${hue}, 80%, 65%)`;
      const eyeH = blink ? 4 : 26;
      ctx.fillRect(205 - 12, 150 - eyeH / 2, 24, eyeH);
      ctx.fillRect(307 - 12, 150 - eyeH / 2, 24, eyeH);
      ctx.beginPath(); ctx.arc(256, 215, 38, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      tex.needsUpdate = true;
    }
    drawFace(false, 330);

    let t = 0, nextBlink = 2, blinkUntil = -1, acc = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        acc += dt;
        if (t > nextBlink) { blinkUntil = t + 0.18; nextBlink = t + 2 + (t * 7 % 3); }
        // 0.15초에 한 번만 리드로우 (매 프레임 캔버스→GPU 업로드 방지)
        if (acc > 0.15) { acc = 0; drawFace(t < blinkUntil, 330 + Math.sin(t * 0.4) * 40); }
      },
    };
  },

  // 8. 축구 슛팅 — 잔디 + 골대 + AI 코치 스크린
  8(zone) {
    const g = new THREE.Group();
    const turf = box(3.6, 0.1, 4.4, mat('#2f6b45')); turf.position.y = 0.05; g.add(turf);

    const goalMat = mat('#e8e4da');
    const postL = cyl(0.06, 0.06, 1.6, goalMat); postL.position.set(-1.2, 0.8, -1.7); g.add(postL);
    const postR = postL.clone(); postR.position.x = 1.2; g.add(postR);
    const bar = cyl(0.06, 0.06, 2.44, goalMat); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.62, -1.7); g.add(bar);

    const net = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, side: THREE.DoubleSide }));
    net.position.set(0, 0.8, -1.85); g.add(net);

    const keeper = makeHumanoid('#8d6e63'); keeper.scale.setScalar(0.75); keeper.position.set(0, 0.1, -1.3); g.add(keeper);

    const coachTex = makeLabel('AI COACH', { color: '#5ee6a8', bg: '#131824', size: 80, w: 640, h: 160 });
    const coach = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshBasicMaterial({ map: coachTex }));
    coach.position.set(0, 2.3, -1.7); g.add(coach);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.4, flatShading: true }));
    ball.position.set(0, 0.32, 1.2); g.add(ball);

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        keeper.position.x = Math.sin(t * 1.6) * 0.8;
        keeper.userData.arms.l.rotation.z = 1.2; keeper.userData.arms.r.rotation.z = -1.2;
        ball.rotation.z = -t * 0.8;
      },
    };
  },

  // 9. 데이터 분석실 — 모니터 데스크 + 서버랙
  9(zone) {
    const g = new THREE.Group();
    const desk = box(3.0, 0.8, 1.1, mat('#2a3040')); desk.position.y = 0.4; g.add(desk);

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    for (let i = 0; i < 2; i++) {
      const mFrame = box(1.2, 0.75, 0.07, mat('#20242e')); mFrame.position.set(-0.72 + i * 1.44, 1.25, -0.2); g.add(mFrame);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.65), new THREE.MeshBasicMaterial({ map: tex }));
      scr.position.set(-0.72 + i * 1.44, 1.25, -0.16); g.add(scr);
    }

    const rack = box(0.8, 2.2, 0.7, mat('#1c212e')); rack.position.set(1.9, 1.1, -0.6); g.add(rack);
    const leds = [];
    for (let i = 0; i < 5; i++) {
      const led = box(0.5, 0.05, 0.02, glow(i % 2 ? '#5ee6a8' : '#ef9a3c', 1.2));
      led.position.set(1.9, 0.5 + i * 0.38, -0.24); g.add(led); leds.push(led);
    }

    let t = 0;
    let bars = Array.from({ length: 10 }, (_, i) => 30 + (i * 37) % 60);
    function drawChart() {
      ctx.fillStyle = '#0d1322'; ctx.fillRect(0, 0, 256, 128);
      bars = bars.map(b => Math.max(14, Math.min(100, b + ((t * 997) % 7) - 3 + Math.sin(t * 3 + b) * 6)));
      bars.forEach((b, i) => {
        ctx.fillStyle = i === 6 ? '#ef9a3c' : '#4f8dff';
        ctx.fillRect(8 + i * 25, 118 - b, 17, b);
      });
      tex.needsUpdate = true;
    }
    drawChart();
    let acc = 0;
    return {
      group: g,
      update(dt) {
        t += dt; acc += dt;
        if (acc > 0.25) { acc = 0; drawChart(); leds.forEach((l, i) => { l.visible = Math.sin(t * 4 + i * 1.7) > -0.3; }); }
      },
    };
  },

  // 10. 운과 확률 — 풍선 벽 + 다트 + 황금 열쇠
  10(zone) {
    const g = new THREE.Group();

    // 풍선 보드
    const board = box(3.2, 2.4, 0.15, mat('#242a38')); board.position.set(0, 1.7, -0.8); g.add(board);
    const balloonColors = ['#e2574c', '#ffd75f', '#5ee6a8', '#6aa7ff', '#ec5fa3', '#b388ff', '#ef9a3c', '#4dd0e1', '#aed581'];
    const balloons = [];
    for (let i = 0; i < 9; i++) {
      const bx = (i % 3 - 1) * 0.95;
      const by = 1.7 + (Math.floor(i / 3) - 1) * 0.75;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10),
        new THREE.MeshStandardMaterial({ color: balloonColors[i], roughness: 0.35 }));
      b.scale.y = 1.15;
      b.position.set(bx, by, -0.6);
      g.add(b); balloons.push(b);
    }

    // 다트 스탠드
    const stand = box(0.5, 0.9, 0.5, mat('#2a3040')); stand.position.set(0, 0.45, 1.3); g.add(stand);
    const dart = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 8), glow('#ffd75f', 0.8));
    dart.rotation.x = Math.PI / 2; dart.position.set(0, 1.0, 1.3); g.add(dart);

    // 황금 열쇠 (미션 완료 시 밝게)
    const key = new THREE.Group();
    const kRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 20), glow('#ffd75f', 0.5));
    key.add(kRing);
    const kBody = box(0.08, 0.4, 0.05, glow('#ffd75f', 0.5)); kBody.position.y = -0.32; key.add(kBody);
    const kTooth = box(0.14, 0.07, 0.05, glow('#ffd75f', 0.5)); kTooth.position.set(0.06, -0.46, 0); key.add(kTooth);
    key.position.set(0, 3.2, -0.4);
    g.add(key);

    let t = 0;
    return {
      group: g,
      setUnlocked(v) {
        key.children.forEach(m => { m.material.emissiveIntensity = v ? 2.0 : 0.5; });
      },
      update(dt) {
        t += dt;
        key.rotation.y = t * 1.2;
        key.position.y = 3.2 + Math.sin(t * 2) * 0.1;
        balloons.forEach((b, i) => { b.position.x = (i % 3 - 1) * 0.95 + Math.sin(t * 1.3 + i) * 0.04; });
      },
    };
  },

  // 11. 아메카전시 — 휴머노이드 상반신 부스
  11(zone) {
    const g = new THREE.Group();
    const booth = box(2.2, 0.9, 1.4, mat('#242a38')); booth.position.y = 0.45; g.add(booth);
    const backWall = box(2.2, 2.4, 0.12, mat('#1c212e')); backWall.position.set(0, 1.65, -0.64); g.add(backWall);
    const stripe = box(2.2, 0.06, 0.13, glow(zone.color, 1.2)); stripe.position.set(0, 2.7, -0.64); g.add(stripe);

    const grey = mat('#b9bfc9', { roughness: 0.35, metalness: 0.3 });
    const torso = box(0.6, 0.62, 0.34, grey); torso.position.y = 1.25; g.add(torso);
    const neck = cyl(0.08, 0.08, 0.14, grey); neck.position.y = 1.63; g.add(neck);
    const headPivot = new THREE.Group(); headPivot.position.y = 1.86; g.add(headPivot);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), grey); headPivot.add(head);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 14, -Math.PI / 3.2, Math.PI / 1.6, Math.PI / 4, Math.PI / 2),
      mat('#e9e2d6', { roughness: 0.5 }));
    headPivot.add(face);
    const eyeMat2 = glow('#4fc3f7', 1.5);
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMat2); eL.position.set(-0.08, 0.04, 0.21); headPivot.add(eL);
    const eR = eL.clone(); eR.position.x = 0.08; headPivot.add(eR);

    const shL = new THREE.Group();
    const armL = box(0.13, 0.5, 0.13, grey); armL.position.y = -0.22; shL.add(armL);
    shL.position.set(-0.4, 1.5, 0); g.add(shL);
    const shR = new THREE.Group();
    const armR = box(0.13, 0.5, 0.13, grey); armR.position.y = -0.22; shR.add(armR);
    shR.position.set(0.4, 1.5, 0); g.add(shR);

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        headPivot.rotation.y = Math.sin(t * 0.6) * 0.55;
        headPivot.rotation.x = Math.sin(t * 0.35) * 0.12;
        shL.rotation.x = Math.sin(t * 0.8) * 0.15;
        shR.rotation.x = Math.sin(t * 0.8 + 1) * 0.15;
      },
    };
  },
};

/* ---------- 벽 구조 ---------- */

function buildWalls(scene) {
  const wallMat = mat('#1f2534', { roughness: 0.9 });
  const stripMat = glow('#3d5a80', 0.5);
  const segments = [];

  for (const w of WALLS) {
    const dx = w.b[0] - w.a[0];
    const dz = w.b[1] - w.a[1];
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz); // z축 기준 회전

    const wall = box(WALL_THICK, WALL_HEIGHT, len, wallMat);
    wall.position.set((w.a[0] + w.b[0]) / 2, WALL_HEIGHT / 2, (w.a[1] + w.b[1]) / 2);
    wall.rotation.y = angle;
    scene.add(wall);

    // 상단 발광 스트립
    const strip = box(WALL_THICK + 0.04, 0.06, len, stripMat);
    strip.position.set(wall.position.x, WALL_HEIGHT - 0.1, wall.position.z);
    strip.rotation.y = angle;
    scene.add(strip);

    segments.push({ ax: w.a[0], az: w.a[1], bx: w.b[0], bz: w.b[1] });
  }

  // 시설 블록 (엘리베이터·계단·화장실)
  const f = FACILITY;
  const block = box(f.w, WALL_HEIGHT, f.d, mat('#1c2230', { roughness: 0.95 }));
  block.position.set(f.x, WALL_HEIGHT / 2, f.z);
  scene.add(block);

  const facLabel = (text, x, z, ry) => {
    const tex = makeLabel(text, { color: '#8a94a8', size: 64, w: 640, h: 160 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, 2.1, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  facLabel('ELEVATOR', f.x - f.w / 4, f.z - f.d / 2 - 0.05, 0);
  facLabel('STAIRS', f.x + f.w / 4, f.z - f.d / 2 - 0.05, 0);
  facLabel('🚻', f.x + f.w / 2 + 0.05, f.z, Math.PI / 2);

  // 블록 4변을 충돌 세그먼트로 추가
  const hw = f.w / 2, hd = f.d / 2;
  segments.push(
    { ax: f.x - hw, az: f.z - hd, bx: f.x + hw, bz: f.z - hd },
    { ax: f.x + hw, az: f.z - hd, bx: f.x + hw, bz: f.z + hd },
    { ax: f.x + hw, az: f.z + hd, bx: f.x - hw, bz: f.z + hd },
    { ax: f.x - hw, az: f.z + hd, bx: f.x - hw, bz: f.z - hd },
  );

  // 계단 스텁 라벨
  const stTex = makeLabel('STAIRS', { color: '#8a94a8', size: 64, w: 640, h: 160 });
  [[-16.8, -6.4, 0], [-16.4, 1.4, Math.PI]].forEach(([x, z, ry]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48),
      new THREE.MeshBasicMaterial({ map: stTex, transparent: true, side: THREE.DoubleSide }));
    m.position.set(x, 2.0, z);
    m.rotation.y = ry;
    scene.add(m);
  });

  return segments;
}

/* ---------- 다음 미션 안내 비컨 ---------- */

function makeBeacon(scene) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 7, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: '#5ee6a8', transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
  );
  pillar.position.y = 3.5;
  g.add(pillar);

  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.65, 4), glow('#5ee6a8', 1.5));
  arrow.rotation.x = Math.PI; // 아래를 향하도록
  arrow.position.y = 4.6;
  g.add(arrow);

  g.visible = false;
  scene.add(g);
  return { group: g, pillar, arrow };
}

/* ---------- 홀(건물) ---------- */

function buildHall(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14171f'; ctx.fillRect(0, 0, 1024, 1024);
  ctx.strokeStyle = '#1e2330'; ctx.lineWidth = 2;
  for (let r = 60; r <= 512; r += 64) {
    ctx.beginPath(); ctx.arc(512, 512, r, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(512, 512);
    ctx.lineTo(512 + Math.cos(a) * 512, 512 + Math.sin(a) * 512); ctx.stroke();
  }
  const floorTex = new THREE.CanvasTexture(canvas);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(HALL_RADIUS, 48),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(HALL_RADIUS, HALL_RADIUS, 7, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: '#181d29', roughness: 0.95, side: THREE.BackSide })
  );
  wall.position.y = 3.5;
  scene.add(wall);

  const strip = new THREE.Mesh(
    new THREE.CylinderGeometry(HALL_RADIUS - 0.05, HALL_RADIUS - 0.05, 0.12, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: '#3d5a80', side: THREE.BackSide })
  );
  strip.position.y = 3.2;
  scene.add(strip);

  const ceil = new THREE.Mesh(
    new THREE.CircleGeometry(HALL_RADIUS, 48),
    new THREE.MeshStandardMaterial({ color: '#0d0f16', roughness: 1 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 7;
  scene.add(ceil);

  // 입구 표시 (통로 위)
  const entTex = makeLabel('⬆ ENTRANCE', { color: '#9aa3b5', size: 72, w: 768, h: 160 });
  const ent = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.62), new THREE.MeshBasicMaterial({ map: entTex, transparent: true }));
  ent.position.set(6.7, 2.6, HALL_RADIUS - 0.4);
  ent.rotation.y = Math.PI;
  scene.add(ent);

  // 입구 바닥 발광 라인
  const entLine = box(3.4, 0.02, 0.12, glow('#5ee6a8', 1.2));
  entLine.position.set(6.7, 0.02, 12.2);
  scene.add(entLine);

  const dCount = 160;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(dCount * 3);
  for (let i = 0; i < dCount; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * (HALL_RADIUS - 2);
    dPos[i * 3] = Math.cos(a) * r;
    dPos[i * 3 + 1] = 0.5 + Math.random() * 5.5;
    dPos[i * 3 + 2] = Math.sin(a) * r;
  }
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
    color: '#5a6a8a', size: 0.04, transparent: true, opacity: 0.55, depthWrite: false,
  }));
  scene.add(dust);
  return { dust };
}

/* ---------- 월드 조립 ---------- */

export function buildWorld(scene) {
  const { dust } = buildHall(scene);
  const wallSegments = buildWalls(scene);
  const beacon = makeBeacon(scene);

  scene.add(new THREE.HemisphereLight('#aebedd', '#2a2f3d', 1.8));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(6, 12, 4);
  scene.add(key);
  const fill = new THREE.PointLight('#7fb2ff', 60, 50);
  fill.position.set(0, 6, 0);
  scene.add(fill);

  const exhibits = [];
  const colliders = [];
  const hitboxes = [];
  const unlockables = {}; // zoneId → setUnlocked

  for (const zone of ZONES) {
    const [x, z] = zone.pos;
    const built = builders[zone.id](zone);
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    // 홀 중심(입구 쪽 약간 치우침)을 바라보도록 회전
    root.rotation.y = Math.atan2(-x + 3, -z + 12);
    root.add(built.group);

    const sign = makeZoneSign(zone);
    sign.position.set(-2.2, 0, 0.8);
    root.add(sign);
    const photo = makePhotoPanel(zone.id);
    photo.position.set(2.4, 0, 0.3);
    photo.rotation.y = -0.3;
    root.add(photo);

    const check = makeCheckMark();
    check.position.set(0, 3.9, 0);
    root.add(check);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 5, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.position.set(x, 2.5, z);
    hit.userData.zoneId = zone.id;
    scene.add(hit);
    hitboxes.push(hit);

    scene.add(root);
    colliders.push({ x, z, r: 2.1 });

    if (built.setUnlocked) unlockables[zone.id] = built.setUnlocked;

    exhibits.push({
      zone, root, check,
      update: built.update || null,
      setCompleted(v) { check.visible = v; },
    });
  }

  let t = 0;
  return {
    exhibits,
    colliders,
    walls: wallSegments,
    hitboxes,
    setZoneCompleted(zoneId, v = true) {
      exhibits.find(e => e.zone.id === zoneId)?.setCompleted(v);
    },
    // 황금 열쇠 획득 → 통로 포털 + 열쇠 발광
    setKeyObtained(v) {
      unlockables[1]?.(v);
      unlockables[10]?.(v);
    },
    setBeacon(zoneId, color = '#5ee6a8') {
      if (!zoneId) { beacon.group.visible = false; return; }
      const zone = ZONES.find(z => z.id === zoneId);
      if (!zone) { beacon.group.visible = false; return; }
      beacon.group.position.set(zone.pos[0], 0, zone.pos[1]);
      beacon.pillar.material.color.set(color);
      beacon.arrow.material.color.set(color);
      beacon.arrow.material.emissive.set(color);
      beacon.group.visible = true;
    },
    update(dt, camera) {
      t += dt;
      dust.rotation.y = t * 0.01;
      if (beacon.group.visible) {
        beacon.arrow.position.y = 4.6 + Math.sin(t * 2.5) * 0.25;
        beacon.arrow.rotation.y = t * 1.5;
        beacon.pillar.material.opacity = 0.1 + Math.sin(t * 2) * 0.05;
      }
      for (const e of exhibits) {
        e.update?.(dt);
        if (e.check.visible) {
          e.check.lookAt(camera.position);
          e.check.position.y = 3.9 + Math.sin(t * 2) * 0.08;
        }
      }
    },
  };
}
