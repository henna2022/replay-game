// ===== GLB 모델을 오프스크린 렌더 → 투명 PNG 스프라이트 (2D 미니게임용) =====
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const cache = new Map(); // path → Image (또는 진행 중 Promise)

// GLB를 정면에서 렌더한 투명 배경 이미지를 반환 (실패 시 null)
export function getModelSprite(path, { w = 320, h = 440 } = {}) {
  if (cache.has(path)) return cache.get(path);

  const promise = new Promise((resolve) => {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch { resolve(null); return; }
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x30343f, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 4, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb6ff, 1.2); rim.position.set(-3, 2, -2); scene.add(rim);

    const cam = new THREE.PerspectiveCamera(35, w / h, 0.01, 100);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(path, (gltf) => {
      const model = gltf.scene;
      scene.add(model);
      // 프레이밍: 바운딩 박스 중심을 원점에, 카메라를 정면에 배치
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3(); box.getSize(size);
      const center = new THREE.Vector3(); box.getCenter(center);
      model.position.sub(center);
      const maxDim = Math.max(size.x, size.y);
      const dist = (maxDim / 2) / Math.tan((cam.fov * Math.PI / 180) / 2) * 1.25;
      cam.position.set(0, 0, dist);
      cam.lookAt(0, 0, 0);

      renderer.render(scene, cam);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = renderer.domElement.toDataURL('image/png');
      // 정리
      renderer.dispose();
    }, undefined, () => { renderer.dispose(); resolve(null); });
  });

  cache.set(path, promise);
  promise.then((img) => cache.set(path, img)); // 완료되면 이미지로 캐시 교체
  return promise;
}
