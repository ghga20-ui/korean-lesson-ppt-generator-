# 야간 자율 작업 계획 (2026-07-10)

오케스트레이션: 계획·설계·검증 = Fable(메인 세션), 구현 = opus 서브에이전트.
PowerPoint 렌더는 단일 인스턴스 — 렌더 검증은 메인 세션이 직렬로만 수행한다.
서브에이전트는 **렌더 금지**(코드만 작성, 검증은 컨트롤러 몫).

## 현재 커버리지 구멍 (N1의 근거)

| | underline | circle | rect | triangle | bracket | summary |
|---|---|---|---|---|---|---|
| 운문(poetry) | ✅ 스윕+게이트 | ✅ 스윕 | ✅ 스윕 | ✅ 스윕 | ✅ 게이트 | ✅ 게이트 |
| 산문(novel) | ✅ 게이트(28pt) | ❌ | ❌ | ❌ | ❌ | ❌ |

산문은 밑줄 1종만 검증됨. 기하 모델이 장르 무관이 됐으므로 이론상 동일하나,
산문 기본 28pt는 스윕(24/36/44)의 보간 구간 — 렌더로 확정한다.
추가: 감싸기 도형(circle/rect/triangle)의 **렌더 기반 enclosure invariant**가
run_cases.py에 없다(Tier-1에만 있음) — 신설한다.

## N2/N3: 폰트

설치 확인된 후보 6종: 한컴산뜻돋움(기본·옛한글 유일), 맑은 고딕, 바탕, 돋움,
나눔고딕, 나눔명조. (바탕·나눔명조 = 문학용 세리프.)

캘리브레이션(폰트당 렌더 6회, 36pt/ls1.8 고정):
- hangul advance: 2점법 — 1번째 글자 x0와 10번째 글자 x0을 접두사 프로빙으로 얻어 /9
- baselineAdjustEm: 실측 잉크 바닥 − 한컴 모델 예측, /em
- capHeightEm: 실측 (y1−y0)/em
- lineStepRatio: 4줄 렌더에서 (y1_line3 − y1_line0 + 3·drift)/(3·fs·ls/72·PXI)
- latin/digit 버킷: 근사 복사(고딕류←맑은고딕, 세리프류←바탕 실측 1회면 충분하나
  시간상 hangul 대비 비율 복사 허용 — 줄바꿈에만 영향, 문서화)

FontMetrics 확장: `capHeightEm?`, `baselineAdjustEm?` (기본 0.90 / 0).
geometry의 baselineAtLine·glyphTop이 이를 읽는다.

## N3: 설정 UI (신설)

**발견: 설정 편집 UI가 없다.** pptSettings는 상태로만 존재. 신설 범위:
- AnnotateStep 사이드바(PPT 생성 버튼 위)에 접이식 "슬라이드 설정" 패널:
  폰트(드롭다운, 옛한글 지원 배지), 글자 크기(24–44 step2), 줄간격(1.2–2.2 step0.1)
- AnnotationEditor.tsx:90의 기본값 재파생 버그 수정 — pptSettings를 props로 수급
- 저장/복원은 이미 pptSettings를 나른다(1-3 수정 완료)

## N4: UI/UX 1차 — 교정지 (docs/mockups/direction-a.html의 안전한 부분)

- 팔레트 토큰 교체: #6B3F26/#EEDDD0(AI 기본값 1번) → 종이 #FBFAF7 · 먹 #16202B ·
  교과서 파랑 #294C67 · 연필 #5B6470 · 교정 빨강 #A6362F · 여백 하늘 #E8EFF5
- 저대비 텍스트: text-[#6B3F26]/40·50·60 (2.0~3.2:1) → 실색 단계로 교체 (AA)
- 카피: "PPT 생성"→"PPT 내보내기", "주석 추출 + 분할"→"PDF에서 주석 가져오기" 등
- 여백 주석(marginalia) 레이아웃은 **범위 밖** — 별도 설계 필요, 야간 미실행

## N5: 리허설 모드 (목업의 시그니처)

AnnotateStep에 "리허설" 버튼: 현재 슬라이드의 주석을 order 순으로
클릭마다 하나씩 등장(마커 → 텍스트). Esc/완료로 종료. 미리보기 부재를 메운다.

## 게이트 (모든 태스크 공통)

npm test 88+ 통과, tsc 0오류, lint 오류 0(기존 경고만), 렌더 게이트 전부 PASS,
Playwright로 UI 동작 확인. 태스크마다 커밋.
