# 3D 모델 슬롯

이 폴더에 GLB 파일을 넣으면 게임 속 절차 생성 모델이 실제 3D 모델로 자동 교체됩니다.

| 파일명 | 대상 |
|---|---|
| `robot-dance.glb` | 로봇 댄스 존의 댄스 로봇 |

## 동작 방식

- 파일이 있으면: 자동으로 크기(높이 약 1.6m)와 바닥 위치를 맞춰 배치합니다.
  모델에 **애니메이션 클립이 포함**되어 있으면 첫 번째 클립을 자동 재생합니다
  (댄스/Idle 클립이 들어있는 rigged 모델 권장).
- 파일이 없으면: 코드로 만든 절차 생성 로봇(관절형 바디 + 하와이안 셔츠 + 레이)이 표시됩니다.

## 모델을 구하는 방법

1. **에셋 마켓에서 구매/다운로드** — Sketchfab, Fab(언리얼), CGTrader, TurboSquid 등에서
   "dancing robot", "humanoid robot rigged" 등으로 검색. 라이선스 확인 후
   **glTF(.glb) 형식**으로 다운로드(FBX만 있으면 Blender에서 .glb로 내보내기).
2. **AI 이미지 → 3D 변환** — Meshy, Tripo3D, Rodin 등에 참고 사진을 업로드하면
   수 분 안에 GLB를 받을 수 있습니다. 리깅/애니메이션은 Mixamo(무료)에서
   자동 리깅 + 댄스 클립을 입혀 GLB로 내보내면 됩니다.
3. **Blender로 직접 제작/의뢰** — 내보낼 때 File → Export → glTF 2.0(.glb) 선택.

## 웹용 최적화 팁

- 단일 `.glb` 파일 (텍스처 포함), **15MB 이하** 권장 (GitHub Pages 로딩 속도)
- 텍스처 2048px 이하면 충분합니다
- 용량이 크면 `gltf-transform optimize input.glb output.glb` 로 압축
  (Draco 압축은 별도 디코더 설정이 필요하니 비압축 또는 meshopt 권장)
