// ===== RE:PLAY 전시홀 + 벽 구조 + 실사 기반 전시물 =====
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ZONES, HALL_RADIUS, WALLS, FACILITY } from './config.js';

const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// GLB 모델 슬롯: 파일이 있으면 절차 생성 모델을 실제 3D 모델로 교체
// 높이(height)에 맞춰 스케일·바닥을 정렬하고, hide 목록의 절차 모델을 숨김
function loadModelSlot(parent, path, { height = 1.5, x = 0, y = 0, z = 0, ry = 0, hide = [], onLoad } = {}) {
  gltfLoader.load(path, (gltf) => {
    const model = gltf.scene;
    const bbox = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3(); bbox.getSize(size);
    model.scale.setScalar(height / (size.y || 1));
    bbox.setFromObject(model);
    const center = new THREE.Vector3(); bbox.getCenter(center);
    model.position.set(-center.x, -bbox.min.y, -center.z);
    const wrap = new THREE.Group();
    wrap.add(model);
    wrap.position.set(x, y, z);
    wrap.rotation.y = ry;
    for (const o of hide) o.visible = false;
    parent.add(wrap);
    onLoad?.(wrap);
  }, undefined, () => {}); // 파일 없으면 절차 생성 모델 유지
}

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
function sph(r, material, w = 16, h = 12) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, w, h), material);
}

// 사진 텍스처 (전시 실사 스크린)
function photoTex(path) {
  const tex = texLoader.load(path);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// 사진을 입힌 발광 스크린 (전시 프로젝션/모니터 느낌)
function photoScreen(w, h, path, brightness = 1) {
  const material = new THREE.MeshBasicMaterial({ map: photoTex(path) });
  material.color.setScalar(brightness);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
}

// 캔버스 텍스처 헬퍼
function canvasTex(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 한글 텍스트 캔버스 라벨
function makeLabel(text, { color = '#ffffff', bg = null, size = 90, w = 1024, h = 192, font = '800' } = {}) {
  return canvasTex(w, h, (ctx) => {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.font = `${font} ${size}px "Pretendard","Apple SD Gothic Neo",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2 + 6);
  });
}

function makeZoneSign(zone) {
  const g = new THREE.Group();
  const post = cyl(0.05, 0.05, 2.6, mat('#3a4152'));
  post.position.y = 1.3;
  g.add(post);

  const tex = makeLabel(`${zone.id}  ${zone.name}`, { color: '#ffffff', bg: '#161a24', size: 76 });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: tex }));
  panel.position.y = 2.75;
  g.add(panel);
  const panelBack = panel.clone();
  panelBack.rotation.y = Math.PI;
  g.add(panelBack);

  const dot = sph(0.14, glow(zone.color, 1.4), 12, 12);
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

  const placeholder = canvasTex(512, 352, (ctx) => {
    ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, 512, 352);
    ctx.strokeStyle = '#2c3444'; ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, 484, 324);
    ctx.fillStyle = '#3d465c';
    ctx.font = '700 44px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PHOTO ARCHIVE', 256, 160);
    ctx.font = '500 26px sans-serif';
    ctx.fillText(`zone-${String(zoneId).padStart(2, '0')}.jpg`, 256, 215);
  });

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

function makeCheckMark() {
  const tex = makeLabel('✓ 기록 완료', { color: '#5ee6a8', size: 96, w: 512, h: 160 });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.55),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false })
  );
  m.visible = false;
  return m;
}

/* ---------- 존별 전시물 빌더 (전시 사진 기반) ---------- */

const builders = {
  // 2. 로봇 댄스 — 보라 네온 무대: LED 월 + 하네스 휴머노이드(꽃셔츠) + 로봇개
  2(zone) {
    const g = new THREE.Group();

    // 반짝이 보라 바닥
    const floorTex = canvasTex(512, 512, (ctx) => {
      ctx.fillStyle = '#241a33'; ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 900; i++) {
        const b = Math.random();
        ctx.fillStyle = `rgba(${180 + b * 60},${140 + b * 80},${255},${0.08 + b * 0.25})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.6, 1.6);
      }
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.7, 28),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.25 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.02; g.add(floor);

    // LED 월 (레드/블루 버스트 애니메이션)
    const ledCanvas = document.createElement('canvas');
    ledCanvas.width = 512; ledCanvas.height = 256;
    const lctx = ledCanvas.getContext('2d');
    const ledTex = new THREE.CanvasTexture(ledCanvas);
    ledTex.colorSpace = THREE.SRGBColorSpace;
    const dots = Array.from({ length: 46 }, () => ({
      x: Math.random() * 512, y: Math.random() * 256,
      r: 4 + Math.random() * 14, hue: Math.random() < 0.5 ? 355 : 215,
      vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 24, p: Math.random() * Math.PI * 2,
    }));
    function drawLED(t) {
      lctx.fillStyle = '#0a0714'; lctx.fillRect(0, 0, 512, 256);
      // 대각 스트릭
      lctx.strokeStyle = 'rgba(80,110,255,0.16)'; lctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        lctx.beginPath();
        const ox = ((t * 30 + i * 80) % 640) - 64;
        lctx.moveTo(ox, 256); lctx.lineTo(ox + 130, 0); lctx.stroke();
      }
      for (const d of dots) {
        const tw = 0.55 + Math.sin(t * 2.4 + d.p) * 0.45;
        const grd = lctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
        grd.addColorStop(0, `hsla(${d.hue}, 95%, 66%, ${0.85 * tw})`);
        grd.addColorStop(1, 'transparent');
        lctx.fillStyle = grd;
        lctx.beginPath(); lctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); lctx.fill();
        d.x = (d.x + d.vx * 0.016 + 512) % 512;
        d.y = (d.y + d.vy * 0.016 + 256) % 256;
      }
      ledTex.needsUpdate = true;
    }
    drawLED(0);
    const ledFrame = box(5.6, 3.0, 0.16, mat('#101018')); ledFrame.position.set(0, 1.7, -2.25); g.add(ledFrame);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.8), new THREE.MeshBasicMaterial({ map: ledTex }));
    led.position.set(0, 1.7, -2.16); g.add(led);

    // 왼쪽 흰 벽 + 세로 네온 3줄
    const sideWall = box(0.12, 3.0, 2.2, mat('#e8e8ec', { roughness: 0.9 }));
    sideWall.position.set(-2.7, 1.5, -1.0); g.add(sideWall);
    for (let i = 0; i < 3; i++) {
      const neon = box(0.05, 2.3, 0.06, glow('#c45cff', 2.0));
      neon.position.set(-2.62, 1.6, -1.7 + i * 0.6);
      g.add(neon);
    }

    // 하네스 갠트리
    const gantry = new THREE.Group();
    const gPost1 = box(0.09, 3.1, 0.09, mat('#15151c')); gPost1.position.set(-0.8, 1.55, 0.35); gantry.add(gPost1);
    const gPost2 = gPost1.clone(); gPost2.position.x = 0.8; gantry.add(gPost2);
    const gBeam = box(1.75, 0.09, 0.09, mat('#15151c')); gBeam.position.y = 3.1; gantry.add(gBeam);
    g.add(gantry);

    // ── 댄스 로봇: 관절형 휴머노이드 + 하와이안 셔츠 + 레이 (전시 실물 참고) ──
    // 하와이안 셔츠 패턴 (히비스커스 + 잎)
    const floralTex = canvasTex(512, 512, (ctx) => {
      ctx.fillStyle = '#f1ead6'; ctx.fillRect(0, 0, 512, 512);
      const leaf = (x, y, r, rot, col) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.3, r, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };
      const hibiscus = (x, y, r, rot, col) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = col;
        for (let p = 0; p < 5; p++) {
          ctx.rotate((Math.PI * 2) / 5);
          ctx.beginPath(); ctx.ellipse(0, r * 0.6, r * 0.36, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#c9a23c';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };
      for (let i = 0; i < 30; i++) {
        leaf(Math.random() * 512, Math.random() * 512, 17 + Math.random() * 15,
          Math.random() * Math.PI, i % 2 ? '#71925a' : '#54774a');
      }
      const cols = ['#e39ab5', '#e8b64f', '#d97f56', '#e8788f'];
      for (let i = 0; i < 24; i++) {
        hibiscus(Math.random() * 512, Math.random() * 512, 15 + Math.random() * 14,
          Math.random() * Math.PI, cols[i % 4]);
      }
    });

    const shellMat2 = mat('#e6e9ee', { roughness: 0.32, metalness: 0.28 }); // 흰 유광 셸
    const jointMat2 = mat('#191a20', { roughness: 0.3, metalness: 0.45 });  // 검은 관절
    const shirtMat = new THREE.MeshStandardMaterial({ map: floralTex, roughness: 0.85 });
    const capsule = (r, len, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m);

    const robot = new THREE.Group();
    const refs = {};

    // 다리 (허벅지/정강이 캡슐 + 원형 무릎 포드 + 신발)
    for (const s of [-1, 1]) {
      const thigh = capsule(0.055, 0.26, shellMat2); thigh.position.set(s * 0.09, 0.71, 0); robot.add(thigh);
      const kneePod = cyl(0.052, 0.052, 0.13, jointMat2, 12);
      kneePod.rotation.z = Math.PI / 2; kneePod.position.set(s * 0.09, 0.52, 0.01); robot.add(kneePod);
      const shin = capsule(0.042, 0.3, shellMat2); shin.position.set(s * 0.09, 0.3, 0); robot.add(shin);
      const ankle = sph(0.038, jointMat2, 10, 8); ankle.position.set(s * 0.09, 0.1, 0); robot.add(ankle);
      const shoe = box(0.095, 0.07, 0.24, jointMat2); shoe.position.set(s * 0.09, 0.04, 0.045); robot.add(shoe);
    }
    const hip = box(0.24, 0.11, 0.15, jointMat2); hip.position.y = 0.87; robot.add(hip);

    // 상체 (트위스트 그룹)
    const upper = new THREE.Group(); upper.position.y = 0.93; robot.add(upper);
    refs.upper = upper;
    const shorts = cyl(0.14, 0.16, 0.14, mat('#3a3d45', { roughness: 0.8 }), 10);
    shorts.position.y = 0.02; upper.add(shorts);
    // 루즈핏 셔츠 + 소매
    const shirt = cyl(0.165, 0.225, 0.5, shirtMat, 12);
    shirt.position.y = 0.32; upper.add(shirt);
    // 팔 (어깨 피벗 → 팔꿈치 피벗 → 장갑) — 소매는 팔을 따라 움직임
    for (const s of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(s * 0.28, 0.53, 0);
      const shoulder = sph(0.05, jointMat2, 10, 8); armPivot.add(shoulder);
      const sleeve = cyl(0.08, 0.098, 0.16, shirtMat, 10);
      sleeve.position.y = -0.07; armPivot.add(sleeve);
      const upperArm = capsule(0.038, 0.15, shellMat2); upperArm.position.y = -0.13; armPivot.add(upperArm);
      const elbowPivot = new THREE.Group(); elbowPivot.position.y = -0.24; armPivot.add(elbowPivot);
      const elbow = sph(0.042, jointMat2, 10, 8); elbowPivot.add(elbow);
      const forearm = capsule(0.034, 0.16, shellMat2); forearm.position.y = -0.12; elbowPivot.add(forearm);
      const glove = box(0.07, 0.1, 0.055, jointMat2); glove.position.y = -0.25; elbowPivot.add(glove);
      upper.add(armPivot);
      refs[s < 0 ? 'armL' : 'armR'] = armPivot;
      refs[s < 0 ? 'foreL' : 'foreR'] = elbowPivot;
    }
    // 목 + 유광 블랙 헬멧 + 바이저
    const neck = cyl(0.045, 0.05, 0.07, jointMat2, 10); neck.position.y = 0.62; upper.add(neck);
    const headPivot = new THREE.Group(); headPivot.position.y = 0.76; upper.add(headPivot);
    refs.head = headPivot;
    const helmet = sph(0.115, mat('#0c0d12', { roughness: 0.12, metalness: 0.65 }), 20, 16);
    helmet.scale.set(0.92, 1.08, 0.98); headPivot.add(helmet);
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.113, 16, 12, -0.75, 1.5, 1.0, 0.85),
      new THREE.MeshStandardMaterial({ color: '#232a3d', roughness: 0.06, metalness: 0.9 })
    );
    visor.scale.set(0.94, 1.05, 1.0);
    visor.rotation.y = -Math.PI / 2; // 정면(+z)으로
    headPivot.add(visor);

    // 레이 (목걸이 링 + 앞으로 길게 늘어진 스트랜드)
    const leiColors = ['#e88bb0', '#f2b3c9', '#d96a94'];
    function leiStrand(radius, tiltX, y, z, count) {
      const strand = new THREE.Group();
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const cluster = new THREE.Group();
        for (let p = 0; p < 4; p++) {
          const f = sph(0.021, mat(leiColors[(i + p) % 3], { roughness: 0.9 }), 7, 5);
          f.position.set((Math.random() - 0.5) * 0.032, (Math.random() - 0.5) * 0.032, (Math.random() - 0.5) * 0.032);
          cluster.add(f);
        }
        cluster.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius * 0.8);
        strand.add(cluster);
      }
      strand.rotation.x = tiltX;
      strand.position.set(0, y, z);
      return strand;
    }
    upper.add(leiStrand(0.15, 0.35, 0.56, 0.02, 16));  // 목 둘레
    upper.add(leiStrand(0.2, 1.35, 0.36, 0.13, 22));   // 가슴 앞 긴 스트랜드

    robot.position.y = 0.03;
    g.add(robot);

    // 하네스 스트랩 (갠트리 연결)
    const strapL = cyl(0.013, 0.013, 1.5, mat('#191920'), 6);
    strapL.position.set(-0.17, 2.3, 0); strapL.rotation.z = 0.07; g.add(strapL);
    const strapR = strapL.clone(); strapR.position.x = 0.17; strapR.rotation.z = -0.07; g.add(strapR);

    // 로봇개 (바닥에 엎드림)
    const dog = new THREE.Group();
    const dogMat = mat('#d3d5da', { roughness: 0.45, metalness: 0.2 });
    const dogBody = box(0.52, 0.15, 0.2, dogMat); dogBody.position.y = 0.14; dog.add(dogBody);
    const dogHead = box(0.16, 0.11, 0.14, mat('#2a2c33')); dogHead.position.set(0.32, 0.16, 0); dog.add(dogHead);
    const dogEye = box(0.02, 0.03, 0.08, glow('#7ef7ff', 1.4)); dogEye.position.set(0.41, 0.17, 0); dog.add(dogEye);
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const thigh = box(0.07, 0.06, 0.16, dogMat);
      thigh.position.set(sx * 0.19, 0.1, sz * 0.14);
      dog.add(thigh);
      const shin = box(0.05, 0.04, 0.2, mat('#8f939c'));
      shin.position.set(sx * 0.19, 0.05, sz * 0.17);
      dog.add(shin);
    }
    dog.position.set(-1.5, 0, 0.9);
    dog.rotation.y = 0.6;
    g.add(dog);

    // ── 실제 3D 모델 슬롯: G1 휴머노이드 + 로봇개 ──
    let g1Model = null, dogModel = null;
    loadModelSlot(g, 'assets/models/g1.glb', {
      height: 1.5, x: 0, y: 0.03, z: 0,
      hide: [robot, strapL, strapR],
      onLoad: (w) => { g1Model = w; },
    });
    loadModelSlot(g, 'assets/models/robotdog.glb', {
      height: 0.55, x: -1.5, y: 0, z: 0.9, ry: 0.6,
      hide: [dog],
      onLoad: (w) => { dogModel = w; },
    });

    // 흰 페데스탈 + 식물/꽃
    const ped1 = box(0.42, 0.75, 0.42, mat('#eceef1', { roughness: 0.9 })); ped1.position.set(-2.2, 0.375, -1.5); g.add(ped1);
    const plant = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const leaf = sph(0.07, mat('#4c7a4f', { roughness: 0.9 }), 7, 5);
      leaf.position.set((Math.random() - 0.5) * 0.2, 0.8 + Math.random() * 0.22, (Math.random() - 0.5) * 0.2);
      leaf.scale.y = 1.9;
      plant.add(leaf);
    }
    plant.position.set(-2.2, 0, -1.5); g.add(plant);
    const ped2 = box(0.42, 0.55, 0.42, mat('#eceef1', { roughness: 0.9 })); ped2.position.set(2.35, 0.275, 0.6); g.add(ped2);
    const bouquet = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const f = sph(0.05, mat(['#e8a7bf', '#e5c96a', '#d8845c'][i % 3], { roughness: 0.9 }), 7, 5);
      f.position.set((Math.random() - 0.5) * 0.22, 0.6 + Math.random() * 0.1, (Math.random() - 0.5) * 0.22);
      bouquet.add(f);
    }
    bouquet.position.set(2.35, 0, 0.6); g.add(bouquet);

    let t = 0, acc = 0;
    return {
      group: g,
      update(dt) {
        t += dt; acc += dt;
        if (acc > 0.12) { acc = 0; drawLED(t); }
        if (g1Model) {
          // G1 모델 댄스 (바운스 + 스웨이 + 트위스트)
          const beat = t * 4.6;
          g1Model.position.y = 0.03 + Math.abs(Math.sin(beat)) * 0.06;
          g1Model.rotation.y = Math.sin(t * 1.15) * 0.55;
          g1Model.rotation.z = Math.sin(beat * 0.5) * 0.06;
        } else {
          // 절차 생성 로봇 댄스 (하네스에 매달린 채)
          const beat = t * 4.6;
          robot.position.y = 0.03 + Math.abs(Math.sin(beat)) * 0.045;
          robot.rotation.y = Math.sin(t * 1.15) * 0.4;
          refs.upper.rotation.y = Math.sin(beat * 0.5) * 0.18;
          refs.armL.rotation.z = 0.5 + Math.sin(beat) * 0.75;
          refs.armR.rotation.z = -0.5 - Math.sin(beat + 1.4) * 0.75;
          refs.armL.rotation.x = Math.sin(beat * 0.5) * 0.5;
          refs.armR.rotation.x = Math.cos(beat * 0.5) * 0.5;
          refs.foreL.rotation.x = -0.5 + Math.sin(beat + 0.5) * 0.45;
          refs.foreR.rotation.x = -0.5 + Math.cos(beat) * 0.45;
          refs.head.rotation.y = Math.sin(t * 1.7) * 0.3;
          refs.head.rotation.x = Math.sin(beat) * 0.06;
        }
        if (dogModel) {
          dogModel.rotation.y = 0.6 + Math.sin(t * 0.7) * 0.18;
          dogModel.position.y = Math.abs(Math.sin(t * 2.3)) * 0.025;
        } else {
          dog.rotation.y = 0.6 + Math.sin(t * 0.7) * 0.08;
        }
      },
    };
  },

  // 3. 로봇팔스튜디오 — 흰 부스 창 + 커브 배경 + 흰색 6축 협동로봇 + 배경선택 스크린
  3(zone) {
    const g = new THREE.Group();

    // 커브 배경 (사이클로라마)
    const cyc = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.1, 2.9, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76),
      new THREE.MeshStandardMaterial({ color: '#c9c6cf', roughness: 0.95, side: THREE.BackSide })
    );
    cyc.position.set(0, 1.45, -0.4);
    g.add(cyc);
    const cycFloor = new THREE.Mesh(new THREE.CircleGeometry(2.05, 24),
      new THREE.MeshStandardMaterial({ color: '#8e8b94', roughness: 0.95 }));
    cycFloor.rotation.x = -Math.PI / 2; cycFloor.position.set(0, 0.02, -0.4); g.add(cycFloor);

    // 보라 세로 라이트 2줄 (배경)
    for (let i = 0; i < 2; i++) {
      const strip = box(0.04, 1.2, 0.04, glow('#a06cff', 1.6));
      strip.position.set(-0.7 + i * 1.5, 1.7, -2.15);
      g.add(strip);
    }

    // 흰 부스 프레임 (창)
    const frameMat = mat('#f0f0f3', { roughness: 0.9 });
    const fL = box(0.5, 2.9, 0.16, frameMat); fL.position.set(-1.85, 1.45, 1.15); g.add(fL);
    const fR = fL.clone(); fR.position.x = 1.85; g.add(fR);
    const fT = box(4.2, 0.45, 0.16, frameMat); fT.position.set(0, 2.9, 1.15); g.add(fT);
    const fB = box(3.2, 0.7, 0.3, frameMat); fB.position.set(0, 0.35, 1.15); g.add(fB);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.85),
      new THREE.MeshStandardMaterial({ color: '#bcd4e8', transparent: true, opacity: 0.09, roughness: 0.05 }));
    glass.position.set(0, 1.62, 1.15); g.add(glass);

    // 로봇팔 (UR 스타일: 흰 링크 + 회색 조인트 링)
    const linkMat = mat('#eef0f3', { roughness: 0.35, metalness: 0.15 });
    const jointMat = mat('#9aa0a8', { roughness: 0.4, metalness: 0.3 });
    const pedestal = box(0.34, 0.85, 0.34, mat('#17181d')); pedestal.position.set(0.3, 0.425, -0.4); g.add(pedestal);

    const armBase = cyl(0.11, 0.13, 0.14, linkMat); armBase.position.set(0.3, 0.92, -0.4); g.add(armBase);
    const shoulderPivot = new THREE.Group(); shoulderPivot.position.set(0.3, 1.0, -0.4); g.add(shoulderPivot);
    const shoulderJoint = cyl(0.1, 0.1, 0.2, jointMat); shoulderJoint.rotation.z = Math.PI / 2; shoulderPivot.add(shoulderJoint);
    const upperPivot = new THREE.Group(); shoulderPivot.add(upperPivot);
    const upper = cyl(0.075, 0.075, 0.8, linkMat); upper.position.y = 0.4; upperPivot.add(upper);
    const elbowPivot = new THREE.Group(); elbowPivot.position.y = 0.8; upperPivot.add(elbowPivot);
    const elbowJoint = cyl(0.085, 0.085, 0.18, jointMat); elbowJoint.rotation.z = Math.PI / 2; elbowPivot.add(elbowJoint);
    const fore = cyl(0.06, 0.06, 0.62, linkMat); fore.position.y = 0.31; elbowPivot.add(fore);
    const wrist1 = cyl(0.06, 0.06, 0.13, jointMat); wrist1.rotation.z = Math.PI / 2; wrist1.position.y = 0.64; elbowPivot.add(wrist1);
    // 카메라 헤드
    const camHead = box(0.16, 0.11, 0.13, mat('#22242b', { roughness: 0.35 })); camHead.position.y = 0.76; elbowPivot.add(camHead);
    const lens = cyl(0.035, 0.035, 0.05, glow('#7ef7ff', 1.6), 12);
    lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.76, 0.09); elbowPivot.add(lens);

    // 배경 선택 터치스크린 (전시 실사)
    const kiosk = new THREE.Group();
    const kStand = box(0.4, 0.95, 0.3, mat('#e6e7ea')); kStand.position.y = 0.475; kiosk.add(kStand);
    const kScreen = photoScreen(0.92, 0.55, 'assets/textures/screen-arm-bg.jpg');
    kScreen.position.set(0, 1.18, 0.1); kScreen.rotation.x = -0.3; kiosk.add(kScreen);
    const kFrame = box(1.0, 0.63, 0.05, mat('#17181d')); kFrame.position.set(0, 1.17, 0.07); kFrame.rotation.x = -0.3; kiosk.add(kFrame);
    kiosk.position.set(1.95, 0, 0.7); kiosk.rotation.y = -0.5;
    g.add(kiosk);

    // 웹캠
    const webcam = sph(0.045, mat('#191a20'), 10, 8); webcam.position.set(-0.7, 0.75, 0.85); g.add(webcam);
    const camBase = box(0.09, 0.05, 0.09, mat('#2a2c33')); camBase.position.set(-0.7, 0.71, 0.85); g.add(camBase);

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        shoulderPivot.rotation.y = Math.sin(t * 0.45) * 0.9;
        upperPivot.rotation.z = -0.5 + Math.sin(t * 0.6) * 0.32;
        elbowPivot.rotation.z = 1.15 + Math.cos(t * 0.55) * 0.4;
      },
    };
  },

  // 4. 소형로봇전시(마음나누기) — 리쿠 · 러봇 · 발루 (실사 기반)
  4(zone) {
    const g = new THREE.Group();

    // 흰 진열 카운터 2단
    const counterMat = mat('#eceef1', { roughness: 0.9 });
    const c1 = box(2.0, 1.0, 1.0, counterMat); c1.position.set(-0.85, 0.5, 0); g.add(c1);
    const c2 = box(1.3, 0.82, 1.0, counterMat); c2.position.set(0.95, 0.41, 0.15); g.add(c2);

    // ---- 리쿠 (단발머리 소형 휴머노이드) ----
    const liku = new THREE.Group();
    const hair = sph(0.115, mat('#2e2a28', { roughness: 0.85 }), 16, 12);
    hair.position.y = 0.42; hair.scale.set(1, 1.02, 1); liku.add(hair);
    const face = sph(0.096, mat('#f2efe9', { roughness: 0.6 }), 14, 10);
    face.position.set(0, 0.408, 0.032); liku.add(face);
    const bangs = box(0.15, 0.05, 0.04, mat('#2e2a28')); bangs.position.set(0, 0.472, 0.078); liku.add(bangs);
    const eyeL = sph(0.016, glow('#7fb2ff', 1.5), 8, 6); eyeL.position.set(-0.035, 0.415, 0.115); liku.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.035; liku.add(eyeR);
    const likuTorso = box(0.17, 0.2, 0.13, mat('#f2efe9', { roughness: 0.6 })); likuTorso.position.y = 0.22; liku.add(likuTorso);
    const chest = box(0.09, 0.035, 0.02, mat('#3a3f46')); chest.position.set(0, 0.26, 0.068); liku.add(chest);
    const shoulderMat = mat('#4a4440', { roughness: 0.7 });
    const shL = box(0.05, 0.14, 0.06, shoulderMat); shL.position.set(-0.115, 0.24, 0); liku.add(shL);
    const shR = shL.clone(); shR.position.x = 0.115; liku.add(shR);
    const handL = box(0.04, 0.06, 0.05, mat('#f2efe9')); handL.position.set(-0.115, 0.14, 0.01); liku.add(handL);
    const handR = handL.clone(); handR.position.x = 0.115; liku.add(handR);
    const legLm = box(0.06, 0.12, 0.09, mat('#3a3f46')); legLm.position.set(-0.045, 0.06, 0.02); liku.add(legLm);
    const legRm = legLm.clone(); legRm.position.x = 0.045; liku.add(legRm);
    liku.position.set(-1.5, 1.0, 0.1);
    liku.rotation.y = 0.35;
    g.add(liku);

    // ---- 러봇 (빨간 망토 + 크림 프릴 + 센서 혼) ----
    const lovot = new THREE.Group();
    const lvBody = sph(0.155, mat('#8a6a52', { roughness: 0.95 }), 16, 12);
    lvBody.scale.y = 1.12; lvBody.position.y = 0.2; lovot.add(lvBody);
    // 빨간 후드 (머리를 감싸는 형태)
    const hood = sph(0.135, mat('#c23b3b', { roughness: 0.92 }), 16, 12);
    hood.position.set(0, 0.345, -0.012); hood.scale.set(1.06, 1.05, 1.02); lovot.add(hood);
    const faceHole = sph(0.095, mat('#7a5a44', { roughness: 0.95 }), 14, 10);
    faceHole.position.set(0, 0.335, 0.062); lovot.add(faceHole);
    // 프릴 (크림)
    const frill = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.038, 8, 20), mat('#efe3cd', { roughness: 0.95 }));
    frill.rotation.x = Math.PI / 2; frill.position.y = 0.1; lovot.add(frill);
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.185, 0.2, 16, 1, true), mat('#c23b3b', { roughness: 0.92, side: THREE.DoubleSide }));
    cape.position.y = 0.185; lovot.add(cape);
    // 큰 청록 눈 + 주황 코
    const lvEyeL = sph(0.028, glow('#59d6d6', 1.2), 10, 8); lvEyeL.position.set(-0.038, 0.35, 0.135); lovot.add(lvEyeL);
    const lvEyeR = lvEyeL.clone(); lvEyeR.position.x = 0.038; lovot.add(lvEyeR);
    const lvNose = sph(0.013, glow('#ffab91', 1.0), 8, 6); lvNose.position.set(0, 0.318, 0.148); lovot.add(lvNose);
    // 센서 혼
    const horn = cyl(0.018, 0.022, 0.075, mat('#17181d', { roughness: 0.3 }), 10);
    horn.position.y = 0.478; lovot.add(horn);
    const hornTip = sph(0.02, mat('#17181d', { roughness: 0.3 }), 8, 6); hornTip.position.y = 0.52; lovot.add(hornTip);
    // 바퀴 베이스
    const wheelBase = cyl(0.075, 0.09, 0.05, mat('#2a2c33'), 12); wheelBase.position.y = 0.025; lovot.add(wheelBase);
    lovot.position.set(-0.65, 1.0, 0.1);
    lovot.rotation.y = -0.25;
    g.add(lovot);

    // ---- 발루 (은박 풍선 이족보행) ----
    const ballu = new THREE.Group();
    const foilMat = new THREE.MeshStandardMaterial({
      color: '#d4d8de', metalness: 0.95, roughness: 0.22, flatShading: true,
    });
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 8), foilMat);
    balloon.scale.set(0.82, 1.28, 0.62);
    balloon.position.y = 0.62;
    ballu.add(balloon);
    // 다리 (아주 가는 검정)
    const bLegMat = mat('#26282e', { roughness: 0.5 });
    const bLegL = cyl(0.008, 0.008, 0.4, bLegMat, 6); bLegL.position.set(-0.05, 0.2, 0); ballu.add(bLegL);
    const bLegR = bLegL.clone(); bLegR.position.x = 0.05; ballu.add(bLegR);
    const bFootL = box(0.05, 0.02, 0.09, bLegMat); bFootL.position.set(-0.05, 0.01, 0.015); ballu.add(bFootL);
    const bFootR = bFootL.clone(); bFootR.position.x = 0.05; ballu.add(bFootR);
    // 연결 스트링
    const strL = cyl(0.003, 0.003, 0.16, bLegMat, 4); strL.position.set(-0.05, 0.46, 0); ballu.add(strL);
    const strR = strL.clone(); strR.position.x = 0.05; ballu.add(strR);
    ballu.position.set(0.95, 0.82, 0.15);
    g.add(ballu);

    // ── 실제 3D 모델 슬롯: 리쿠 · 러봇 (발루는 balu.glb 준비되면 자동 교체) ──
    let likuModel = null, lovotModel = null, balluModel = null;
    loadModelSlot(g, 'assets/models/liku.glb', {
      height: 0.52, x: -1.5, y: 1.0, z: 0.1, ry: 0.35,
      hide: [liku], onLoad: (w) => { likuModel = w; },
    });
    loadModelSlot(g, 'assets/models/lovbot.glb', {
      height: 0.46, x: -0.65, y: 1.0, z: 0.1, ry: -0.25,
      hide: [lovot], onLoad: (w) => { lovotModel = w; },
    });
    loadModelSlot(g, 'assets/models/balu.glb', {
      height: 0.62, x: 0.95, y: 0.82, z: 0.15,
      hide: [ballu], onLoad: (w) => { balluModel = w; },
    });

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        if (likuModel) likuModel.rotation.y = 0.35 + Math.sin(t * 0.6) * 0.4;
        else liku.rotation.y = 0.35 + Math.sin(t * 0.6) * 0.4;      // 리쿠 두리번
        if (lovotModel) {
          lovotModel.position.y = 1.0 + Math.abs(Math.sin(t * 2.0)) * 0.028;
          lovotModel.rotation.y = -0.25 + Math.sin(t * 0.9) * 0.15;
        } else {
          lovot.position.y = 1.0 + Math.abs(Math.sin(t * 2.0)) * 0.028; // 러봇 콩콩
          lovot.rotation.y = -0.25 + Math.sin(t * 0.9) * 0.15;
        }
        if (balluModel) {
          balluModel.rotation.z = Math.sin(t * 1.4) * 0.12;
        } else {
          ballu.rotation.z = Math.sin(t * 1.4) * 0.12;              // 발루 흔들 (안 넘어짐!)
          balloon.position.y = 0.62 + Math.sin(t * 1.8) * 0.02;
        }
      },
    };
  },

  // 5. AI사운드 뮤드럼 — 전자드럼 세트 + 보코(노란 화면) + 바닥 테이프
  5(zone) {
    const g = new THREE.Group();

    // 흰 부스 벽 + 보코 스크린 (전시 실사)
    const wall = box(3.4, 2.9, 0.14, mat('#e9e9ec', { roughness: 0.92 }));
    wall.position.set(0, 1.45, -1.7); g.add(wall);
    const bokoFrame = box(1.9, 1.18, 0.06, mat('#17181d')); bokoFrame.position.set(0, 1.85, -1.6); g.add(bokoFrame);
    const boko = photoScreen(1.8, 1.08, 'assets/textures/screen-boko.jpg');
    boko.position.set(0, 1.85, -1.56); g.add(boko);

    // 바닥 노란 테이프
    for (let i = 0; i < 2; i++) {
      const tape = box(1.8, 0.015, 0.07, glow('#e8c33a', 0.5));
      tape.position.set(0, 0.02, 0.75 + i * 0.5);
      g.add(tape);
    }
    const darkFloor = new THREE.Mesh(new THREE.CircleGeometry(2.1, 24),
      new THREE.MeshStandardMaterial({ color: '#3a3c42', roughness: 0.95 }));
    darkFloor.rotation.x = -Math.PI / 2; darkFloor.position.y = 0.01; g.add(darkFloor);

    // ---- 전자드럼 세트 ----
    const rackMat = mat('#17181d', { roughness: 0.5 });
    const padWhite = mat('#f0f0f0', { roughness: 0.55 });
    const rimMat = mat('#202128', { roughness: 0.4 });

    function meshPad(r) {
      const grp = new THREE.Group();
      const padTop = cyl(r, r, 0.045, padWhite, 20); grp.add(padTop);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 8, 20), rimMat);
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.02; grp.add(rim);
      return grp;
    }

    // 랙 프레임
    const rackL = cyl(0.024, 0.024, 1.05, rackMat, 8); rackL.position.set(-0.75, 0.55, -0.45); g.add(rackL);
    const rackR = rackL.clone(); rackR.position.x = 0.75; g.add(rackR);
    const rackBar = cyl(0.02, 0.02, 1.55, rackMat, 8);
    rackBar.rotation.z = Math.PI / 2; rackBar.position.set(0, 0.95, -0.45); g.add(rackBar);

    // 스네어 + 톰 2
    const snare = meshPad(0.16); snare.position.set(-0.42, 0.78, -0.1); snare.rotation.x = 0.16; g.add(snare);
    const tom1 = meshPad(0.135); tom1.position.set(-0.12, 0.98, -0.38); tom1.rotation.x = 0.3; g.add(tom1);
    const tom2 = meshPad(0.135); tom2.position.set(0.26, 0.98, -0.38); tom2.rotation.x = 0.3; g.add(tom2);

    // 심벌 (하이햇 + 크래시, 어두운 러버)
    const cymMat = mat('#2b2d34', { roughness: 0.5, metalness: 0.3 });
    const hihat = cyl(0.15, 0.15, 0.015, cymMat, 20); hihat.position.set(-0.78, 1.05, 0.05); hihat.rotation.x = 0.08; g.add(hihat);
    const hihat2 = hihat.clone(); hihat2.position.y = 1.01; g.add(hihat2);
    const hhStand = cyl(0.015, 0.015, 1.0, rackMat, 6); hhStand.position.set(-0.78, 0.5, 0.05); g.add(hhStand);
    const crash = cyl(0.19, 0.19, 0.015, cymMat, 20); crash.position.set(0.72, 1.28, -0.1); crash.rotation.x = 0.14; crash.rotation.z = -0.1; g.add(crash);
    const crStand = cyl(0.015, 0.015, 1.24, rackMat, 6); crStand.position.set(0.72, 0.62, -0.1); g.add(crStand);

    // 킥 타워 + 페달
    const kick = box(0.3, 0.34, 0.12, mat('#26282e')); kick.position.set(0.05, 0.19, 0.12); g.add(kick);
    const kickFace = cyl(0.11, 0.11, 0.02, padWhite, 16);
    kickFace.rotation.x = Math.PI / 2; kickFace.position.set(0.05, 0.2, 0.185); g.add(kickFace);
    const pedal = box(0.09, 0.02, 0.22, mat('#8f939c', { metalness: 0.6 })); pedal.position.set(0.05, 0.02, 0.33); g.add(pedal);

    // 드럼 의자
    const throne = cyl(0.17, 0.17, 0.07, mat('#1d1e24'), 16); throne.position.set(0.05, 0.55, 0.85); g.add(throne);
    const thronePost = cyl(0.03, 0.03, 0.5, rackMat, 8); thronePost.position.set(0.05, 0.27, 0.85); g.add(thronePost);

    // 스틱 (연주 애니메이션)
    const stickMat = mat('#d9c9a0', { roughness: 0.7 });
    const stickL = cyl(0.012, 0.012, 0.4, stickMat, 6);
    stickL.position.set(-0.35, 1.05, 0.15); stickL.rotation.x = 1.0; g.add(stickL);
    const stickR = stickL.clone(); stickR.position.x = 0.25; g.add(stickR);

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        stickL.rotation.x = 1.0 + Math.max(0, Math.sin(t * 6)) * 0.5;
        stickR.rotation.x = 1.0 + Math.max(0, Math.sin(t * 6 + Math.PI)) * 0.5;
        hihat.rotation.z = Math.sin(t * 6) * 0.02;
        crash.rotation.z = -0.1 + Math.sin(t * 3.1) * 0.03;
      },
    };
  },

  // 6. 버추얼 아이돌 — 홀로그램 팬미팅 무대
  6(zone) {
    const g = new THREE.Group();
    const stage = cyl(1.7, 1.9, 0.3, mat('#20242e'), 24); stage.position.y = 0.15; g.add(stage);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.045, 8, 40), glow(zone.color, 1.5));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.31; g.add(ring);

    const idolMat = new THREE.MeshStandardMaterial({
      color: zone.color, emissive: new THREE.Color(zone.color), emissiveIntensity: 0.7,
      transparent: true, opacity: 0.85,
    });
    const idol = new THREE.Group();
    const iTorso = box(0.55, 0.7, 0.3, idolMat); iTorso.position.y = 1.15; idol.add(iTorso);
    const iHead = box(0.34, 0.32, 0.32, idolMat); iHead.position.y = 1.72; idol.add(iHead);
    const iArmL = new THREE.Group();
    const iArmMeshL = box(0.14, 0.6, 0.14, idolMat); iArmMeshL.position.y = -0.28; iArmL.add(iArmMeshL);
    iArmL.position.set(-0.37, 1.45, 0); idol.add(iArmL);
    const iArmR = new THREE.Group();
    const iArmMeshR = box(0.14, 0.6, 0.14, idolMat); iArmMeshR.position.y = -0.28; iArmR.add(iArmMeshR);
    iArmR.position.set(0.37, 1.45, 0); idol.add(iArmR);
    const iLegL = box(0.16, 0.75, 0.16, idolMat); iLegL.position.set(-0.15, 0.42, 0); idol.add(iLegL);
    const iLegR = iLegL.clone(); iLegR.position.x = 0.15; idol.add(iLegR);
    idol.position.y = 0.5;
    g.add(idol);

    const sticks = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const s = new THREE.Group();
      const pole = cyl(0.03, 0.03, 0.7, mat('#3a4152')); pole.position.y = 0.35; s.add(pole);
      const bulb = sph(0.09, glow('#ffd75f', 1.2), 10, 10); bulb.position.y = 0.78; s.add(bulb);
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
        iArmL.rotation.z = Math.sin(t * 2.5) * 0.6 + 0.9;
        iArmR.rotation.z = -Math.sin(t * 2.5) * 0.6 - 0.9;
        sticks.forEach((b, i) => { b.material.emissiveIntensity = 0.7 + Math.max(0, Math.sin(t * 3 + i)) * 1.2; });
      },
    };
  },

  // 7. 디지털 아바타 — 세로 키오스크(에너지 버스트) + 가상세계 프로젝션 월
  7(zone) {
    const g = new THREE.Group();

    // 가상세계 프로젝션 월 (전시 실사: 숲 유적)
    const wallFrame = box(3.8, 2.7, 0.14, mat('#101018')); wallFrame.position.set(0, 1.55, -1.7); g.add(wallFrame);
    const world = photoScreen(3.64, 2.54, 'assets/textures/screen-avatar-world.jpg');
    world.position.set(0, 1.55, -1.61); g.add(world);

    // 세로형 아바타 생성 키오스크 (전시 실사: 블루 버스트)
    const kioskBody = box(0.6, 1.95, 0.14, mat('#f0f0f3', { roughness: 0.5 }));
    kioskBody.position.set(0.9, 1.05, -0.2); g.add(kioskBody);
    const kioskScreen = photoScreen(0.46, 1.55, 'assets/textures/screen-avatar-kiosk.jpg', 1.1);
    kioskScreen.position.set(0.9, 1.08, -0.12); g.add(kioskScreen);
    const camDot = sph(0.028, mat('#17181d'), 8, 6); camDot.position.set(0.9, 1.98, -0.12); g.add(camDot);
    const kioskBase = box(0.5, 0.06, 0.42, mat('#c9cbd1')); kioskBase.position.set(0.9, 0.03, -0.2); g.add(kioskBase);

    // 서있는 자리 표시
    const spot = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), glow('#7fb2ff', 0.9));
    spot.rotation.x = -Math.PI / 2; spot.position.set(-0.6, 0.03, 0.5); g.add(spot);

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        kioskScreen.material.color.setScalar(1.0 + Math.sin(t * 2.2) * 0.12);
        spot.material.emissiveIntensity = 0.7 + Math.sin(t * 2.6) * 0.35;
      },
    };
  },

  // 8. AI축구 — 잔디 부스 + 골키퍼 프로젝션 + 끈 달린 공 + 트러스 라이트
  8(zone) {
    const g = new THREE.Group();

    // 잔디 텍스처
    const turfTex = canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = '#3e7a41'; ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 3200; i++) {
        const s = Math.random();
        ctx.fillStyle = `rgba(${34 + s * 60},${96 + s * 70},${40 + s * 46},0.5)`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 2.6);
      }
    });
    turfTex.wrapS = turfTex.wrapT = THREE.RepeatWrapping;

    // 잔디 바닥 (통로형)
    const turfFloorMat = new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.95 });
    turfFloorMat.map.repeat.set(2, 3);
    const turf = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.08, 4.6), turfFloorMat);
    turf.position.y = 0.04; g.add(turf);

    // 잔디 측벽 2개
    const turfWallMat = new THREE.MeshStandardMaterial({ map: turfTex.clone(), roughness: 0.95 });
    turfWallMat.map.repeat.set(3, 1.4);
    turfWallMat.map.needsUpdate = true;
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.0, 4.3), turfWallMat);
    wallL.position.set(-1.68, 1.0, 0.1); g.add(wallL);
    const wallR = wallL.clone(); wallR.position.x = 1.68; g.add(wallR);

    // 정면 골키퍼 프로젝션 (전시 실사)
    const screenBack = box(3.4, 2.5, 0.12, mat('#0e0f14')); screenBack.position.set(0, 1.35, -2.25); g.add(screenBack);
    const goalScreen = photoScreen(3.24, 2.34, 'assets/textures/screen-goal.jpg', 1.05);
    goalScreen.position.set(0, 1.35, -2.17); g.add(goalScreen);

    // AI SOCCER 사이드 텍스트
    const soccerLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.4),
      new THREE.MeshBasicMaterial({ map: makeLabel('AI SOCCER', { color: '#cfe8d8', size: 84, font: '800' }), transparent: true })
    );
    soccerLabel.position.set(-1.6, 1.7, 0.4);
    soccerLabel.rotation.y = Math.PI / 2;
    g.add(soccerLabel);

    // 트러스 + 마젠타 라이트
    const trussMat = mat('#5a5e68', { metalness: 0.6, roughness: 0.4 });
    const trussL = box(0.09, 2.5, 0.09, trussMat); trussL.position.set(-1.55, 1.25, 1.95); g.add(trussL);
    const trussR = trussL.clone(); trussR.position.x = 1.55; g.add(trussR);
    const trussTop = box(3.2, 0.09, 0.09, trussMat); trussTop.position.set(0, 2.5, 1.95); g.add(trussTop);
    const neonL = box(0.04, 1.7, 0.04, glow('#ff4fd8', 1.8)); neonL.position.set(-1.48, 1.2, 1.95); g.add(neonL);
    const neonR = neonL.clone(); neonR.position.x = 1.48; g.add(neonR);

    // 노란 공 + 끈 (오른쪽 벽 앵커로 연결)
    const ball = sph(0.2, mat('#f2c229', { roughness: 0.5 }), 14, 12);
    ball.position.set(0.1, 0.28, 1.1); g.add(ball);
    const tether = cyl(0.005, 0.005, 1.85, mat('#26282e'), 4);
    tether.position.set(0.85, 1.05, 1.05);
    tether.rotation.z = -0.95;
    tether.rotation.y = 0.1;
    g.add(tether);
    const anchor = box(0.06, 0.06, 0.06, mat('#26282e'));
    anchor.position.set(1.6, 1.72, 0.98); g.add(anchor);

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        ball.rotation.z = Math.sin(t * 0.8) * 0.4;
        ball.position.x = 0.1 + Math.sin(t * 0.8) * 0.05;
        neonL.material.emissiveIntensity = 1.5 + Math.sin(t * 2.2) * 0.5;
        neonR.material.emissiveIntensity = 1.5 + Math.sin(t * 2.2 + 1) * 0.5;
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

  // 10. 운과 확률 — 파스텔 풍선 프로젝션 월 + 다트폰 거치대 + 황금 열쇠
  10(zone) {
    const g = new THREE.Group();

    // 프로젝션 월 (전시 실사: 파스텔 풍선)
    const wallFrame = box(4.3, 3.0, 0.14, mat('#101018')); wallFrame.position.set(0, 1.7, -1.5); g.add(wallFrame);
    const balloonWall = photoScreen(4.14, 2.84, 'assets/textures/wall-darts.jpg', 1.05);
    balloonWall.position.set(0, 1.7, -1.41); g.add(balloonWall);

    // 회색 카펫
    const carpet = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24),
      new THREE.MeshStandardMaterial({ color: '#5b5e66', roughness: 0.98 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.y = 0.015; g.add(carpet);

    // 다트폰 화면 텍스처
    const phoneTex = canvasTex(128, 256, (ctx) => {
      ctx.fillStyle = '#f5f6f8'; ctx.fillRect(0, 0, 128, 256);
      // 초록 다트
      ctx.save();
      ctx.translate(64, 128); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#1e8a4a';
      ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(10, -13); ctx.lineTo(16, 0); ctx.lineTo(10, 13); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2b2d33'; ctx.fillRect(-38, -2.4, 52, 4.8);
      ctx.fillStyle = '#8a4a2a'; ctx.fillRect(-16, -3.6, 12, 7.2);
      ctx.restore();
    });

    // 흰 거치대 2개 + 폰
    for (let i = 0; i < 2; i++) {
      const ped = box(0.45, 0.95, 0.45, mat('#eceef1', { roughness: 0.9 }));
      ped.position.set(-0.55 + i * 1.1, 0.475, 0.75); g.add(ped);
      const phone = box(0.1, 0.015, 0.2, mat('#17181d', { roughness: 0.3 }));
      phone.position.set(-0.55 + i * 1.1, 0.965, 0.75);
      phone.rotation.z = 0.0; phone.rotation.x = -0.12;
      g.add(phone);
      const pScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.18),
        new THREE.MeshBasicMaterial({ map: phoneTex }));
      pScreen.rotation.x = -Math.PI / 2 - 0.12;
      pScreen.position.set(-0.55 + i * 1.1, 0.975, 0.75);
      g.add(pScreen);
    }

    // 황금 열쇠 (미션 완료 시 밝게)
    const key = new THREE.Group();
    const kRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 20), glow('#ffd75f', 0.5));
    key.add(kRing);
    const kBody = box(0.08, 0.4, 0.05, glow('#ffd75f', 0.5)); kBody.position.y = -0.32; key.add(kBody);
    const kTooth = box(0.14, 0.07, 0.05, glow('#ffd75f', 0.5)); kTooth.position.set(0.06, -0.46, 0); key.add(kTooth);
    key.position.set(0, 3.3, -0.4);
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
        key.position.y = 3.3 + Math.sin(t * 2) * 0.1;
        balloonWall.material.color.setScalar(1.0 + Math.sin(t * 1.6) * 0.06);
      },
    };
  },

  // 11. 아메카 — 회색 리얼 헤드 + 흰 숄더 셸 + 스터드 블랙 박스 + "Meet AMECA"
  11(zone) {
    const g = new THREE.Group();

    // 검은 백월 + Meet AMECA
    const backWall = box(3.2, 2.9, 0.14, mat('#0b0c10', { roughness: 0.9 }));
    backWall.position.set(0, 1.45, -1.0); g.add(backWall);
    const meet = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.62),
      new THREE.MeshBasicMaterial({ map: makeLabel('Meet AMECA', { color: '#f2f3f5', size: 100, font: '800' }), transparent: true })
    );
    meet.position.set(0, 2.25, -0.91); g.add(meet);

    // 스터드 블랙 박스 (광택 + 은색 도트 그리드)
    const studTex = canvasTex(256, 256, (ctx) => {
      ctx.fillStyle = '#0d0d10'; ctx.fillRect(0, 0, 256, 256);
      for (let y = 14; y < 256; y += 24) {
        for (let x = 14; x < 256; x += 24) {
          const grd = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 4.2);
          grd.addColorStop(0, '#e8eaee');
          grd.addColorStop(0.55, '#7f838c');
          grd.addColorStop(1, '#0d0d10');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fill();
        }
      }
    });
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.05, 0.95),
      new THREE.MeshStandardMaterial({ map: studTex, color: '#ffffff', roughness: 0.25, metalness: 0.35 }));
    pedestal.position.y = 0.525; g.add(pedestal);

    // ---- 아메카 상반신 ----
    const bust = new THREE.Group();
    // 흰 숄더/체스트 셸
    const shellMat = mat('#f0f1f4', { roughness: 0.35, metalness: 0.08 });
    const chestShell = box(0.66, 0.4, 0.32, shellMat);
    chestShell.position.y = 0.22; bust.add(chestShell);
    const shoulderL = sph(0.13, shellMat, 12, 10); shoulderL.position.set(-0.33, 0.36, 0); shoulderL.scale.set(1, 0.85, 1); bust.add(shoulderL);
    const shoulderR = shoulderL.clone(); shoulderR.position.x = 0.33; bust.add(shoulderR);
    // 체스트: 스피커 그릴 + 세로 LED 슬롯
    const grillTex = canvasTex(64, 64, (ctx) => {
      ctx.fillStyle = '#1c1d22'; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#3c3e46';
      for (let y = 6; y < 64; y += 8) for (let x = 6; x < 64; x += 8) {
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    });
    const grill = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20),
      new THREE.MeshStandardMaterial({ map: grillTex, roughness: 0.6 }));
    grill.position.set(0.13, 0.26, 0.165); bust.add(grill);
    const ledSlot = box(0.035, 0.2, 0.012, glow('#dfe3ea', 0.7));
    ledSlot.position.set(-0.12, 0.25, 0.165); bust.add(ledSlot);

    // 회색 목 + 헤드
    const skinMat = mat('#9aa0ab', { roughness: 0.55, metalness: 0.12 });
    const faceMat = mat('#b9bfc9', { roughness: 0.5, metalness: 0.08 });
    const neck = cyl(0.075, 0.09, 0.16, skinMat, 12); neck.position.y = 0.5; bust.add(neck);

    const headPivot = new THREE.Group(); headPivot.position.y = 0.72; bust.add(headPivot);
    const skull = sph(0.155, skinMat, 20, 16);
    skull.scale.set(0.92, 1.12, 0.98); headPivot.add(skull);
    // 얼굴판 (밝은 회색)
    const facePlate = sph(0.15, faceMat, 20, 16);
    facePlate.scale.set(0.86, 1.06, 0.9);
    facePlate.position.z = 0.022; headPivot.add(facePlate);
    // 눈: 소켓 + 홍채
    const sockL = sph(0.032, mat('#23252b', { roughness: 0.3 }), 10, 8); sockL.position.set(-0.055, 0.035, 0.135); headPivot.add(sockL);
    const sockR = sockL.clone(); sockR.position.x = 0.055; headPivot.add(sockR);
    const irisL = sph(0.014, mat('#7d95a8', { roughness: 0.25 }), 8, 6); irisL.position.set(-0.055, 0.035, 0.162); headPivot.add(irisL);
    const irisR = irisL.clone(); irisR.position.x = 0.055; headPivot.add(irisR);
    // 코·입 힌트
    const nose = box(0.028, 0.05, 0.03, faceMat); nose.position.set(0, -0.02, 0.155); headPivot.add(nose);
    const mouth = box(0.07, 0.008, 0.012, mat('#818994')); mouth.position.set(0, -0.075, 0.148); headPivot.add(mouth);
    // 눈썹 (표정 포인트)
    const browL = box(0.045, 0.008, 0.012, mat('#5d636e')); browL.position.set(-0.055, 0.075, 0.15); headPivot.add(browL);
    const browR = browL.clone(); browR.position.x = 0.055; headPivot.add(browR);
    // 뒤통수 다크 커버
    const backCap = sph(0.152, mat('#3a3d45', { roughness: 0.4 }), 16, 12);
    backCap.scale.set(0.9, 1.1, 0.72); backCap.position.z = -0.055; headPivot.add(backCap);

    bust.position.y = 1.05;
    g.add(bust);

    // ── 실제 3D 모델 슬롯: 아메카 ──
    let amecaModel = null;
    loadModelSlot(g, 'assets/models/ameca.glb', {
      height: 1.0, y: 1.05,
      hide: [bust], onLoad: (w) => { amecaModel = w; },
    });

    // 스포트라이트 콘
    const spot = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 2.2, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#dfe8f5', transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })
    );
    spot.position.set(0, 2.6, 0);
    g.add(spot);

    let t = 0;
    return {
      group: g,
      update(dt) {
        t += dt;
        if (amecaModel) {
          amecaModel.rotation.y = Math.sin(t * 0.6) * 0.35; // 좌우 둘러보기
          return;
        }
        headPivot.rotation.y = Math.sin(t * 0.6) * 0.5;
        headPivot.rotation.x = Math.sin(t * 0.35) * 0.1;
        // 눈썹 미세 표정
        const b = Math.sin(t * 0.9);
        browL.position.y = 0.075 + Math.max(0, b) * 0.012;
        browR.position.y = 0.075 + Math.max(0, -b) * 0.012;
        ledSlot.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 1.4)) * 0.6;
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
    const angle = Math.atan2(dx, dz);

    const wall = box(WALL_THICK, WALL_HEIGHT, len, wallMat);
    wall.position.set((w.a[0] + w.b[0]) / 2, WALL_HEIGHT / 2, (w.a[1] + w.b[1]) / 2);
    wall.rotation.y = angle;
    scene.add(wall);

    const strip = box(WALL_THICK + 0.04, 0.06, len, stripMat);
    strip.position.set(wall.position.x, WALL_HEIGHT - 0.1, wall.position.z);
    strip.rotation.y = angle;
    scene.add(strip);

    segments.push({ ax: w.a[0], az: w.a[1], bx: w.b[0], bz: w.b[1] });
  }

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

  const hw = f.w / 2, hd = f.d / 2;
  segments.push(
    { ax: f.x - hw, az: f.z - hd, bx: f.x + hw, bz: f.z - hd },
    { ax: f.x + hw, az: f.z - hd, bx: f.x + hw, bz: f.z + hd },
    { ax: f.x + hw, az: f.z + hd, bx: f.x - hw, bz: f.z + hd },
    { ax: f.x - hw, az: f.z + hd, bx: f.x - hw, bz: f.z - hd },
  );

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
  arrow.rotation.x = Math.PI;
  arrow.position.y = 4.6;
  g.add(arrow);

  g.visible = false;
  scene.add(g);
  return { group: g, pillar, arrow };
}

/* ---------- 홀(건물) ---------- */

function buildHall(scene) {
  const floorTex = canvasTex(1024, 1024, (ctx) => {
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
  });
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

  const entTex = makeLabel('⬆ ENTRANCE', { color: '#9aa3b5', size: 72, w: 768, h: 160 });
  const ent = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.62), new THREE.MeshBasicMaterial({ map: entTex, transparent: true }));
  ent.position.set(6.7, 2.6, HALL_RADIUS - 0.4);
  ent.rotation.y = Math.PI;
  scene.add(ent);

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
  const unlockables = {};

  for (const zone of ZONES) {
    const [x, z] = zone.pos;
    const built = builders[zone.id](zone);
    const root = new THREE.Group();
    root.position.set(x, 0, z);
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
    setKeyObtained(v) {
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
