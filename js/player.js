// ===== 1인칭 플레이어 컨트롤 (터치 조이스틱 + 드래그 시점 / WASD + 마우스) =====
import * as THREE from 'three';

const EYE_HEIGHT = 1.6;
const WALK_SPEED = 4.2;
const LOOK_SPEED = 0.0042;
const PITCH_LIMIT = Math.PI / 2.9;
const PLAYER_RADIUS = 0.55;
const WALL_PUSH_R = 0.75; // 벽 두께 절반 + 플레이어 반지름

export class Player {
  /**
   * @param camera THREE.PerspectiveCamera
   * @param dom    입력을 받을 엘리먼트(렌더러 캔버스)
   * @param opts   { wallRadius, colliders: [{x,z,r}], walls: [{ax,az,bx,bz}],
   *                 onTap(ndcX,ndcY), onActivity(), joyBase, joyStick }
   */
  constructor(camera, dom, opts) {
    this.camera = camera;
    this.dom = dom;
    this.opts = opts;

    camera.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3(0, EYE_HEIGHT, 0);
    this.yaw = 0;
    this.pitch = 0;

    this.keys = new Set();
    this.joy = { x: 0, y: 0 };          // -1..1
    this.moveTouchId = null;
    this.lookTouchId = null;
    this.moveOrigin = { x: 0, y: 0 };
    this.lookLast = { x: 0, y: 0 };
    this.lookStart = { x: 0, y: 0, t: 0, moved: 0 };
    this.mouseDown = false;
    this.enabled = false;

    this._bind();
  }

  setPose(x, z, yaw) {
    this.pos.set(x, EYE_HEIGHT, z);
    this.yaw = yaw;
    this.pitch = 0;
    this._applyCamera();
  }

  _bind() {
    const dom = this.dom;

    // --- 터치 ---
    dom.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        const isMoveZone = t.clientX < window.innerWidth * 0.45 && t.clientY > window.innerHeight * 0.4;
        if (isMoveZone && this.moveTouchId === null) {
          this.moveTouchId = t.identifier;
          this.moveOrigin = { x: t.clientX, y: t.clientY };
          this.moveStart = { t: performance.now(), moved: 0 };
          this._showJoy(t.clientX, t.clientY);
        } else if (this.lookTouchId === null) {
          this.lookTouchId = t.identifier;
          this.lookLast = { x: t.clientX, y: t.clientY };
          this.lookStart = { x: t.clientX, y: t.clientY, t: performance.now(), moved: 0 };
        }
      }
      e.preventDefault();
    }, { passive: false });

    dom.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this.moveTouchId) {
          const dx = t.clientX - this.moveOrigin.x;
          const dy = t.clientY - this.moveOrigin.y;
          if (this.moveStart) this.moveStart.moved = Math.max(this.moveStart.moved, Math.abs(dx) + Math.abs(dy));
          const max = 52;
          const len = Math.hypot(dx, dy) || 1;
          const cl = Math.min(len, max);
          this.joy.x = (dx / len) * (cl / max);
          this.joy.y = (dy / len) * (cl / max);
          this._moveJoyStick(this.joy.x * max, this.joy.y * max);
        } else if (t.identifier === this.lookTouchId) {
          const dx = t.clientX - this.lookLast.x;
          const dy = t.clientY - this.lookLast.y;
          this.lookLast = { x: t.clientX, y: t.clientY };
          this.lookStart.moved += Math.abs(dx) + Math.abs(dy);
          this.yaw -= dx * LOOK_SPEED;
          this.pitch = THREE.MathUtils.clamp(this.pitch - dy * LOOK_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
        }
      }
      e.preventDefault();
    }, { passive: false });

    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.moveTouchId) {
          this.moveTouchId = null;
          this.joy.x = this.joy.y = 0;
          this._hideJoy();
          // 조이스틱 존에서도 짧은 탭은 상호작용으로 처리 (데드존 방지)
          if (this.enabled && this.moveStart
            && this.moveStart.moved < 14 && performance.now() - this.moveStart.t < 300) {
            this._emitTap(t.clientX, t.clientY);
          }
          this.moveStart = null;
        } else if (t.identifier === this.lookTouchId) {
          const dt = performance.now() - this.lookStart.t;
          if (this.enabled && this.lookStart.moved < 14 && dt < 400) {
            this._emitTap(t.clientX, t.clientY);
          }
          this.lookTouchId = null;
        }
      }
    };
    dom.addEventListener('touchend', endTouch);
    dom.addEventListener('touchcancel', endTouch);

    // --- 마우스 ---
    dom.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.mouseDown = true;
      this.lookStart = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.mouseDown) return;
      this.opts.onActivity?.();
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.lookStart.moved += Math.abs(dx) + Math.abs(dy);
      this.yaw -= dx * LOOK_SPEED;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * LOOK_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
    });
    window.addEventListener('mouseup', (e) => {
      if (!this.mouseDown) return;
      this.mouseDown = false;
      if (this.enabled && this.lookStart.moved < 6) this._emitTap(e.clientX, e.clientY);
    });

    // --- 키보드 ---
    window.addEventListener('keydown', (e) => { this.keys.add(e.code); this.opts.onActivity?.(); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // --- 활동 감지 (무입력 타임아웃용, 모달·UI 터치 포함) ---
    window.addEventListener('pointerdown', () => this.opts.onActivity?.(), { capture: true });
    window.addEventListener('touchstart', () => this.opts.onActivity?.(), { capture: true, passive: true });
    window.addEventListener('touchmove', () => this.opts.onActivity?.(), { capture: true, passive: true });
  }

  _emitTap(cx, cy) {
    const ndcX = (cx / window.innerWidth) * 2 - 1;
    const ndcY = -(cy / window.innerHeight) * 2 + 1;
    this.opts.onTap?.(ndcX, ndcY);
  }

  _showJoy(x, y) {
    const b = this.opts.joyBase;
    if (!b) return;
    b.classList.remove('hidden');
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    this._moveJoyStick(0, 0);
  }
  _moveJoyStick(dx, dy) {
    const s = this.opts.joyStick;
    if (s) s.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  _hideJoy() { this.opts.joyBase?.classList.add('hidden'); }

  update(dt) {
    if (!this.enabled) return;

    // 정지 상태로 유지 중인 터치/드래그도 활동으로 집계 (홀드 중 타임아웃 방지)
    if (this.moveTouchId !== null || this.lookTouchId !== null || this.mouseDown) {
      this.opts.onActivity?.();
    }

    let mx = this.joy.x;
    let mz = this.joy.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;

    const len = Math.hypot(mx, mz);
    if (len > 1e-4) {
      if (len > 1) { mx /= len; mz /= len; }
      // forward = (-sin(yaw), -cos(yaw)), right = (cos(yaw), -sin(yaw))
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const dx = mx * cos + mz * sin;
      const dz = -mx * sin + mz * cos;
      this.pos.x += dx * WALK_SPEED * dt;
      this.pos.z += dz * WALK_SPEED * dt;
    }

    this._collide();
    this._applyCamera();
  }

  _collide() {
    // 원형 벽
    const maxR = this.opts.wallRadius - PLAYER_RADIUS;
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > maxR) {
      this.pos.x *= maxR / d;
      this.pos.z *= maxR / d;
    }
    // 전시물 원형 콜라이더 밀어내기
    for (const c of this.opts.colliders) {
      const dx = this.pos.x - c.x;
      const dz = this.pos.z - c.z;
      const dist = Math.hypot(dx, dz);
      const min = c.r + PLAYER_RADIUS;
      if (dist < min && dist > 1e-5) {
        const push = min / dist;
        this.pos.x = c.x + dx * push;
        this.pos.z = c.z + dz * push;
      }
    }
    // 벽 세그먼트 밀어내기
    for (const w of (this.opts.walls || [])) {
      const abx = w.bx - w.ax, abz = w.bz - w.az;
      const len2 = abx * abx + abz * abz;
      if (len2 < 1e-8) continue;
      let s = ((this.pos.x - w.ax) * abx + (this.pos.z - w.az) * abz) / len2;
      s = Math.max(0, Math.min(1, s));
      const cx = w.ax + abx * s, cz = w.az + abz * s;
      const dx = this.pos.x - cx, dz = this.pos.z - cz;
      const dist = Math.hypot(dx, dz);
      if (dist < WALL_PUSH_R) {
        if (dist > 1e-5) {
          this.pos.x = cx + (dx / dist) * WALL_PUSH_R;
          this.pos.z = cz + (dz / dist) * WALL_PUSH_R;
        } else {
          // 정확히 벽 위: 벽 법선 방향으로 밀어냄
          const nl = Math.hypot(abz, abx) || 1;
          this.pos.x = cx + (-abz / nl) * WALL_PUSH_R;
          this.pos.z = cz + (abx / nl) * WALL_PUSH_R;
        }
      }
    }
  }

  _applyCamera() {
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
