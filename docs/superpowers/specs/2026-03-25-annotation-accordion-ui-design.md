# 주석 편집 UI — 아코디언 카드 방식 설계 문서

**Date:** 2026-03-25
**Status:** Approved
**Scope:** `src/components/AnnotationEditor.tsx` 우측 주석 목록 패널

---

## 배경 및 목적

현재 주석 목록 패널은 각 항목에 아이콘 전용 버튼(Crosshair, Scissors, ChevronUp/Down, Trash)이 항상 노출되어 있다. 처음 사용하는 교사에게는 아이콘의 의미가 불명확하고, 색상·마커 변경 UI는 추가 클릭으로만 드러나는 숨겨진 인터랙션이다. 아코디언 카드 방식으로 **발견성**과 **편집 흐름**을 개선한다.

---

## 확정 설계

### 닫힌 상태 (항상 표시)

```
[드래그핸들] [N번] ● 색상점 [마커배지] 타겟 텍스트 (truncate)   ▼
                   주석 내용 미리보기 (1줄, truncate)
```

- 드래그 핸들(GripVertical)은 카드 좌측 맨 앞에 유지
- 순서 번호(원형 배지), 색상 점(annotation.color), 마커 유형 배지(MARKER_LABELS[ann.markerType] 한글명), 타겟 텍스트, 내용 미리보기
- `summary` 타입 주석은 목록에서 제외 — 하단 슬라이드 요약 textarea에서만 처리

### 열린 상태 (클릭 시 확장)

카드를 클릭하면 `expandedAnnotationId`를 해당 id로 설정하고, `editingContent`를 `ann.content`로 초기화한다.

**편집 섹션:**
- 마커 유형: `POPUP_MARKER_TYPES` 기준 pill 버튼 — **클릭 즉시 `onUpdateSlide` 반영** (별도 저장 불필요)
- 색상: 팔레트 도트 — **클릭 즉시 `onUpdateSlide` 반영** (별도 저장 불필요)
- 주석 내용: textarea — `editingContent` state로 관리, **[저장] 버튼 클릭 시에만 `onUpdateSlide` 반영**

**액션 버튼 행:**
- **[저장]**: `editingContent`를 `annotation.content`에 반영 → `onUpdateSlide` 호출 → 카드 닫힘 (`expandedAnnotationId = null`)
- **[타겟변경]**: `setRetargetingId(ann.id)` 호출 → 카드 즉시 닫힘 (`expandedAnnotationId = null`). 이후 본문에서 드래그 선택으로 타겟 변경 완료/취소 (기존 동작 그대로).
- **[다른 슬라이드로]**: `onCutAnnotation(ann)` 호출 → 카드 닫힘. 기존 Scissors 버튼과 동일한 동작, 레이블만 변경.
- **[삭제]**: `handleDeleteAnnotation(ann.id)` 호출.

**one-open-at-a-time**: 다른 카드를 클릭하면 현재 열린 카드는 닫힌다. textarea의 미저장 변경사항은 버려진다 (별도 확인 없음). 카드를 열 때 진행 중인 `retargetingId`가 있으면 `setRetargetingId(null)`로 취소한다.

**[저장] 빈 내용 처리**: `editingContent.trim()`이 비어있으면 `onUpdateSlide`를 호출하지 않고 카드만 닫는다 (현재 `saveEditContent` 동작 유지).

**슬라이드 변경 시 초기화**: 슬라이드가 변경될 때 `expandedAnnotationId`를 `null`로 초기화한다. 이를 기존 슬라이드 변경 `useEffect`(popup/retargetingId 초기화와 동일한 블록)에 추가한다.

---

## 상태 관리 변경

| 기존 상태 | 변경 후 |
|---|---|
| `editingAnnotationId` | → `expandedAnnotationId: string \| null` (카드 확장 추적) |
| `editingContent` | 유지 — 카드 열 때 `ann.content`로 초기화 |
| `editingMarkerTypeId` | **삭제** |
| `editingColorId` | **삭제** |

---

## 제거되는 것

- `ChevronUp` / `ChevronDown` 위/아래 이동 버튼 (드래그&드롭으로 충분)
- 마커 배지 클릭 → 인라인 드롭다운 (`editingMarkerTypeId` 방식)
- 색상 도트 클릭 → 인라인 팔레트 (`editingColorId` 방식)
- `lucide-react`의 `ChevronUp`, `ChevronDown` import (다른 곳에서 미사용 시 제거)

---

## 유지되는 것

- 드래그&드롭 순서 변경 (GripVertical 핸들, handleDragStart/Over/Drop/End)
- BatchEditPanel (헤더에 그대로)
- 텍스트 선택 팝업 (주석 추가 플로우) — 변경 없음
- 슬라이드 요약(summary) 하단 입력 — 변경 없음

---

## 영향 범위

- `src/components/AnnotationEditor.tsx`: 주석 목록 렌더링 부분(line ~836~1002) + 관련 상태 선언 교체
- 다른 컴포넌트, hooks, 타입 변경 없음
- `onCutAnnotation` prop 이름·시그니처 유지, 버튼 레이블만 "잘라내기" → "다른 슬라이드로" 변경
