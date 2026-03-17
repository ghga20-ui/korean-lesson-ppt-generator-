# Annotation Color Customization

## Context

현재 모든 마커 도형과 주석 텍스트는 단일 색상(`#294C67`, 진한 파랑)으로 고정되어 있다. 교사가 수업에서 마커 종류별/주석별로 색상을 달리하여 시각적 구분을 주고 싶은 요구가 있다. 예: "파란 밑줄은 표현법, 빨간 원은 핵심어" 등.

## Requirements

- 주석마다 개별 색상 설정 가능
- 프리셋 팔레트(8색)에서 클릭으로 선택
- 마커 도형 + 주석 텍스트가 같은 색상으로 연동
- 주석 추가/편집 시 색상 선택 UI 제공
- PPT, HTML 출력 모두 반영

## Design

### 1. Data Model (`src/lib/types.ts`)

`Annotation` 인터페이스에 `color` 필드 추가:

```typescript
export interface Annotation {
  id: string;
  startIndex: number;
  endIndex: number;
  targetText: string;
  content: string;
  markerType: MarkerType;
  order: number;
  color: string;  // NEW: hex color (e.g. "#294C67")
}
```

기본값 상수:

```typescript
export const DEFAULT_ANNOTATION_COLOR = "#294C67";

export const ANNOTATION_COLOR_PALETTE = [
  "#294C67", // 진한 파랑 (기본)
  "#C0392B", // 빨강
  "#27AE60", // 초록
  "#8E44AD", // 보라
  "#D68910", // 주황
  "#2980B9", // 하늘
  "#1ABC9C", // 청록
  "#7F8C8D", // 회색
];
```

### 2. PPT Generator (`src/lib/pptx-generator.ts`)

`getAnnotationColor()` 함수 수정:

```typescript
// Before
function getAnnotationColor(_index: number): string {
  return MARKER_COLOR;
}

// After — annotation 객체를 받아 color 필드 사용
// MARKER_COLOR 상수는 fallback으로만 유지
```

`buildSlide()`에서 `color = annotation.color || MARKER_COLOR` 로 변경.
summary 박스도 `annotation.color` 반영.

### 3. HTML Generator (`src/lib/html-generator.ts`)

CSS 상수 대신 inline style로 각 annotation의 color 적용:
- `.ann-wrap`의 `border-color`, `::before`/`::after` color
- `.ann-text`의 color
- `.marker-svg`의 stroke
- `.summary`의 border-color, color

### 4. Editor UI (`src/components/AnnotationEditor.tsx`)

**주석 추가 팝업:**
- 마커 타입 선택 행 아래에 컬러 팔레트 행 추가
- 8개 색상을 작은 원(●)으로 표시
- 선택된 색상에 체크마크 또는 테두리 표시
- 기본값: `#294C67`

**주석 목록:**
- 각 주석 항목 좌측에 색상 점(dot) 표시
- 점 클릭 시 팔레트 펼쳐서 색상 변경 가능

**에디터 텍스트 하이라이트:**
- 현재 `MARKER_COLORS` Tailwind 상수 대신 annotation.color 기반 동적 배경색
- `annotation.color + "20"` (alpha 12%) 으로 연한 하이라이트

### 5. 관련 파일 수정

**`src/lib/annotation-matcher.ts`:**
- `distributeAnnotationsToSlides()`에서 생성하는 Annotation에 color 필드 전달

**`src/app/editor/page.tsx`:**
- 새 annotation 생성 시 `color: DEFAULT_ANNOTATION_COLOR` 포함

### 6. 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/types.ts` | Annotation에 color 필드, 팔레트 상수 |
| `src/lib/pptx-generator.ts` | annotation.color 사용 |
| `src/lib/html-generator.ts` | inline style로 color 적용 |
| `src/components/AnnotationEditor.tsx` | 팔레트 UI, 목록 색상 dot |
| `src/lib/annotation-matcher.ts` | color 필드 전달 |
| `src/app/editor/page.tsx` | 기본 color 설정 |

## Verification

1. 에디터에서 주석 추가 → 팔레트에서 빨강 선택 → PPT 생성 → 해당 밑줄/주석이 빨간색인지 확인
2. 같은 슬라이드에 파랑/빨강/초록 주석 혼합 → PPT에서 각각 다른 색상 확인
3. HTML 미리보기에서도 동일한 색상 반영 확인
4. 색상 미지정 주석은 기본 파랑(`#294C67`) 유지 확인
5. Gemini 추출 주석에 기본 색상 자동 할당 확인
