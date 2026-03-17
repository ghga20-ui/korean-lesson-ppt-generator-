# Annotation Color Customization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주석마다 개별 색상을 프리셋 팔레트에서 선택하여 PPT/HTML 출력에 반영

**Architecture:** `Annotation` 인터페이스에 `color` 필드 추가 → 생성기들이 해당 색상 사용 → 에디터 UI에 팔레트 추가

**Tech Stack:** TypeScript, Next.js, pptxgenjs, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-15-annotation-color-customization-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types.ts` | Modify | `Annotation.color` 필드, 팔레트 상수 추가 |
| `src/lib/pptx-generator.ts` | Modify | `annotation.color` 기반 PPT 색상 적용 |
| `src/lib/html-generator.ts` | Modify | inline style로 색상 적용 |
| `src/lib/annotation-matcher.ts` | Modify | color 필드 전달 |
| `src/components/AnnotationEditor.tsx` | Modify | 팔레트 UI + 색상 dot |
| `src/app/editor/page.tsx` | Modify | 새 주석 생성 시 기본 color |

---

## Chunk 1: Data Model + Generators

### Task 1: types.ts — color 필드 및 팔레트 상수 추가

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Annotation 인터페이스에 color 추가**

```typescript
// Annotation 인터페이스 마지막 필드로 추가
/** Marker and annotation text color (hex, e.g. "#294C67") */
color: string;
```

- [ ] **Step 2: 팔레트 상수 추가**

파일 하단에 추가:

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

- [ ] **Step 3: 빌드 확인**

Run: `npx next build 2>&1 | tail -20`

타입 에러가 발생할 수 있음 (기존 코드에서 color 없이 Annotation 생성하는 곳). 이는 Task 2~4에서 수정.

---

### Task 2: annotation-matcher.ts — color 필드 전달

**Files:**
- Modify: `src/lib/annotation-matcher.ts`

- [ ] **Step 1: matchAnnotationsToText()에서 color 전달**

`matchAnnotationsToText` 함수에서 반환하는 matched annotation에 color가 포함되도록 확인.
현재 `ExtractedAnnotation`에는 color가 없으므로, matched 생성 시 `DEFAULT_ANNOTATION_COLOR` 할당:

```typescript
// matched annotation 생성 부분에서:
color: DEFAULT_ANNOTATION_COLOR,
```

`DEFAULT_ANNOTATION_COLOR`를 import.

- [ ] **Step 2: distributeAnnotationsToSlides()에서 color 전달**

slide annotation 생성 시 `ann.color` 전달:

```typescript
slideAnnotations.push({
  ...ann,
  // ... 기존 필드들 ...
  color: ann.color,  // 추가
});
```

---

### Task 3: pptx-generator.ts — annotation.color 사용

**Files:**
- Modify: `src/lib/pptx-generator.ts`

- [ ] **Step 1: getAnnotationColor 함수 수정**

```typescript
// Before
function getAnnotationColor(_index: number): string {
  return MARKER_COLOR;
}

// After — 삭제하고 buildSlide 내에서 직접 annotation.color 사용
```

- [ ] **Step 2: buildSlide()에서 color 변경**

기존:
```typescript
const color = getAnnotationColor(idx);
```

변경:
```typescript
const color = (annotation.color || MARKER_COLOR).replace("#", "");
```

PPT는 `#` 없는 hex를 사용하므로 `replace("#", "")` 필요.

- [ ] **Step 3: summary 박스 색상 반영**

summary annotation에서도 `annotation.color` 사용:
- `SUMMARY_BORDER_COLOR` 대신 `color` 변수
- summary 텍스트 색상도 `color`

단, `SUMMARY_BG_COLOR`(배경)은 유지 — 또는 color 기반으로 연한 배경 자동 생성 (optional).

- [ ] **Step 4: getAnnotationColor 함수 제거**

더 이상 사용하지 않으므로 삭제.

---

### Task 4: html-generator.ts — inline style 색상 적용

**Files:**
- Modify: `src/lib/html-generator.ts`

- [ ] **Step 1: buildSlideHtml()에서 각 annotation의 color를 inline style로 전달**

`ann-wrap`에 `style="--ann-color: ${ann.color}"` CSS 변수 추가:

```html
<span class="ann-wrap step" data-step="0" data-marker="underline"
      style="--ann-color: #C0392B">
```

- [ ] **Step 2: CSS에서 CSS 변수 참조**

기존 하드코딩된 `${MARKER_COLOR}` → `var(--ann-color, ${MARKER_COLOR})`:

```css
.ann-wrap[data-marker="underline"].shown {
  border-bottom-color: var(--ann-color, #294C67);
}
```

동일하게 rectangle, bracket, circle/triangle SVG stroke, annotation text color 모두 변경.

- [ ] **Step 3: summary에도 color 적용**

summary div에 `style="--ann-color: ${sum.color}"` 추가.

- [ ] **Step 4: 빌드 확인**

Run: `npx next build 2>&1 | tail -10`

---

## Chunk 2: Editor UI

### Task 5: AnnotationEditor.tsx — 팔레트 UI 추가

**Files:**
- Modify: `src/components/AnnotationEditor.tsx`

- [ ] **Step 1: 팔레트 import**

```typescript
import { DEFAULT_ANNOTATION_COLOR, ANNOTATION_COLOR_PALETTE } from "@/lib/types";
```

- [ ] **Step 2: 주석 추가 팝업에 색상 선택 행 추가**

마커 타입 선택 행 아래에:

```tsx
<div className="flex items-center gap-1.5 mt-2">
  <span className="text-xs text-gray-500 mr-1">색상</span>
  {ANNOTATION_COLOR_PALETTE.map((c) => (
    <button
      key={c}
      onClick={() => setSelectedColor(c)}
      className={`w-5 h-5 rounded-full border-2 transition-all ${
        selectedColor === c ? "border-gray-800 scale-110" : "border-transparent"
      }`}
      style={{ backgroundColor: c }}
      title={c}
    />
  ))}
</div>
```

- [ ] **Step 3: selectedColor 상태 추가**

```typescript
const [selectedColor, setSelectedColor] = useState(DEFAULT_ANNOTATION_COLOR);
```

주석 생성 시 `color: selectedColor` 포함.

- [ ] **Step 4: 주석 목록에 색상 dot + 변경 기능**

각 주석 항목 좌측에:

```tsx
<button
  className="w-3 h-3 rounded-full flex-shrink-0"
  style={{ backgroundColor: ann.color }}
  onClick={(e) => { e.stopPropagation(); toggleColorPicker(ann.id); }}
/>
```

색상 dot 클릭 시 인라인 팔레트 펼침.

- [ ] **Step 5: 에디터 하이라이트 색상 동적 적용**

기존 `MARKER_COLORS` Tailwind 상수 대신 annotation.color 기반:

```tsx
style={{ backgroundColor: ann.color + "20" }}
```

`#294C67` + `"20"` = `#294C6720` (12% alpha).

---

### Task 6: editor/page.tsx — 기본 color 설정

**Files:**
- Modify: `src/app/editor/page.tsx`

- [ ] **Step 1: 새 annotation 생성 시 color 포함**

수동 annotation 추가하는 모든 곳에:

```typescript
color: DEFAULT_ANNOTATION_COLOR,
```

`DEFAULT_ANNOTATION_COLOR`를 import.

- [ ] **Step 2: 빌드 + 전체 테스트**

Run: `npx next build 2>&1 | tail -10`

---

## Verification

- [ ] 에디터에서 주석 추가 → 팔레트에서 빨강 선택 → PPT 생성 → 빨간 밑줄/주석 확인
- [ ] 같은 슬라이드에 파랑/빨강/초록 혼합 → PPT에서 각각 다른 색상
- [ ] HTML 미리보기에서도 동일 색상
- [ ] 색상 미지정 주석 → 기본 파랑 유지
- [ ] Gemini 추출 주석 → 기본 색상 자동 할당
