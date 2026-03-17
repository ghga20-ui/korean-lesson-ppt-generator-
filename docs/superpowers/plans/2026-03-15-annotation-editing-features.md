# Annotation Editing Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주석 순서 변경 버튼 가시성 개선, 슬라이드 간 잘라내기/붙여넣기 이동, 타겟 텍스트 변경 기능 구현

**Architecture:** AnnotationEditor에 잘라내기/타겟변경 UI 추가, editor/page.tsx에 clipboard 상태 관리, 텍스트 선택 시 모드(신규추가/붙여넣기/타겟변경)에 따라 분기

**Tech Stack:** TypeScript, React, Next.js, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-15-annotation-editing-features-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/editor/page.tsx` | Modify | clipboard 상태, onCut/onPaste 핸들러, props 전달 |
| `src/components/AnnotationEditor.tsx` | Modify | 버튼 가시성, 잘라내기/타겟변경/붙여넣기 UI, 텍스트선택 분기 |

---

## Chunk 1: 전체 구현

### Task 1: editor/page.tsx — clipboard 상태 및 핸들러

**Files:**
- Modify: `src/app/editor/page.tsx`

- [ ] **Step 1: clipboard 상태 추가**

import에 `Annotation` 추가하고 상태 선언:

```typescript
const [clipboardAnnotation, setClipboardAnnotation] = useState<Annotation | null>(null);
```

- [ ] **Step 2: onCutAnnotation 핸들러 추가**

`handleGenerate` 콜백 근처에:

```typescript
const handleCutAnnotation = useCallback((annotation: Annotation) => {
  setClipboardAnnotation(annotation);
  // 현재 슬라이드에서 제거
  setSlides((prev) =>
    prev.map((s) =>
      s.id === slides[currentSlideIndex]?.id
        ? { ...s, annotations: s.annotations.filter((a) => a.id !== annotation.id) }
        : s
    )
  );
}, [slides, currentSlideIndex]);
```

- [ ] **Step 3: onPasteAnnotation 핸들러 추가**

```typescript
const handlePasteAnnotation = useCallback(
  (startIndex: number, endIndex: number, targetText: string) => {
    if (!clipboardAnnotation) return;
    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    const nextOrder =
      currentSlide.annotations.length > 0
        ? Math.max(...currentSlide.annotations.map((a) => a.order)) + 1
        : 1;

    const newAnn: Annotation = {
      ...clipboardAnnotation,
      id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
      startIndex,
      endIndex,
      targetText,
      order: nextOrder,
    };

    setSlides((prev) =>
      prev.map((s) =>
        s.id === currentSlide.id
          ? { ...s, annotations: [...s.annotations, newAnn] }
          : s
      )
    );
    setClipboardAnnotation(null);
  },
  [clipboardAnnotation, slides, currentSlideIndex]
);
```

- [ ] **Step 4: AnnotationEditor에 props 전달**

```tsx
<AnnotationEditor
  slide={currentSlide}
  genre={genre}
  onUpdateSlide={handleUpdateSlide}
  onSplitAt={handleSplitAt}
  onMergeNext={handleMergeNext}
  isLastSlide={currentSlideIndex === slides.length - 1}
  clipboardAnnotation={clipboardAnnotation}
  onCutAnnotation={handleCutAnnotation}
  onPasteAnnotation={handlePasteAnnotation}
/>
```

---

### Task 2: AnnotationEditor.tsx — Props 및 상태 추가

**Files:**
- Modify: `src/components/AnnotationEditor.tsx`

- [ ] **Step 1: interface에 새 props 추가**

```typescript
interface AnnotationEditorProps {
  slide: SlideData;
  genre: Genre;
  onUpdateSlide: (updatedSlide: SlideData) => void;
  onSplitAt: (charIndex: number) => void;
  onMergeNext: () => void;
  isLastSlide: boolean;
  clipboardAnnotation: Annotation | null;
  onCutAnnotation: (annotation: Annotation) => void;
  onPasteAnnotation: (startIndex: number, endIndex: number, targetText: string) => void;
}
```

destructure에도 추가.

- [ ] **Step 2: retargetingId 상태 추가**

```typescript
const [retargetingId, setRetargetingId] = useState<string | null>(null);
```

슬라이드 변경 시 리셋:

```typescript
// 기존 useEffect (slide 변경 시) 에 추가
setRetargetingId(null);
```

---

### Task 3: AnnotationEditor.tsx — 텍스트 선택 분기 로직

**Files:**
- Modify: `src/components/AnnotationEditor.tsx`

- [ ] **Step 1: handleTextSelection 수정**

기존 `handleTextSelection` (또는 `handleMouseUp`) 함수에서 텍스트 선택 감지 후 분기:

```typescript
// 텍스트 선택 감지 후:
if (retargetingId) {
  // 타겟 변경 모드: 즉시 업데이트
  const ann = slide.annotations.find((a) => a.id === retargetingId);
  if (ann) {
    onUpdateSlide({
      ...slide,
      annotations: slide.annotations.map((a) =>
        a.id === retargetingId
          ? { ...a, startIndex, endIndex, targetText: selectedText }
          : a
      ),
    });
  }
  setRetargetingId(null);
  return;
}

if (clipboardAnnotation) {
  // 붙여넣기 모드: 바로 붙여넣기
  onPasteAnnotation(startIndex, endIndex, selectedText);
  return;
}

// 기존: 주석 추가 팝업 표시
```

이 분기를 기존 selection 감지 로직 내부에 삽입. 정확한 위치는 현재 `setPopup({ ... })` 호출 직전.

---

### Task 4: AnnotationEditor.tsx — 버튼 가시성 + 새 버튼 추가

**Files:**
- Modify: `src/components/AnnotationEditor.tsx`

- [ ] **Step 1: 기존 액션 버튼 영역 교체**

현재 (주석 목록 각 항목 우측):
```tsx
<div className="flex flex-shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
  ▲ ▼ 🗑
</div>
```

변경 — 하단 한 줄에 항상 보이는 버튼들:
```tsx
<div className="mt-1.5 flex items-center gap-1">
  <button onClick={() => handleMoveAnnotation(ann.id, "up")}
    disabled={idx === 0}
    className="rounded px-1.5 py-0.5 text-xs text-[#1E2761]/60 hover:bg-[#CADCFC]/30 disabled:opacity-30"
    title="위로">▲</button>
  <button onClick={() => handleMoveAnnotation(ann.id, "down")}
    disabled={idx === sortedAnnotations.length - 1}
    className="rounded px-1.5 py-0.5 text-xs text-[#1E2761]/60 hover:bg-[#CADCFC]/30 disabled:opacity-30"
    title="아래로">▼</button>
  <button onClick={() => setRetargetingId(ann.id)}
    className="rounded px-1.5 py-0.5 text-xs text-[#1E2761]/60 hover:bg-[#CADCFC]/30"
    title="타겟 변경">🎯</button>
  <button onClick={() => onCutAnnotation(ann)}
    className="rounded px-1.5 py-0.5 text-xs text-[#1E2761]/60 hover:bg-[#CADCFC]/30"
    title="잘라내기">✂️</button>
  <button onClick={() => handleDeleteAnnotation(ann.id)}
    className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-50"
    title="삭제">🗑</button>
</div>
```

- [ ] **Step 2: 상태 표시 배너 추가**

주석 목록 상단 (또는 본문 영역 상단)에 모드 안내:

```tsx
{/* 타겟 변경 모드 배너 */}
{retargetingId && (
  <div className="mx-4 mt-2 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-300 px-3 py-2">
    <span className="text-xs text-amber-800">🎯 새 타겟 텍스트를 본문에서 드래그로 선택하세요</span>
    <button onClick={() => setRetargetingId(null)}
      className="text-xs text-amber-600 hover:text-amber-800">취소</button>
  </div>
)}

{/* 붙여넣기 대기 배너 */}
{clipboardAnnotation && !retargetingId && (
  <div className="mx-4 mt-2 flex items-center justify-between rounded-lg bg-blue-50 border border-blue-300 px-3 py-2">
    <span className="text-xs text-blue-800">📋 붙여넣을 위치를 본문에서 드래그로 선택하세요</span>
    <button onClick={() => {/* 부모에서 clipboard 해제 필요 — onCancelPaste prop 추가 */}}
      className="text-xs text-blue-600 hover:text-blue-800">취소</button>
  </div>
)}
```

**참고:** 붙여넣기 취소를 위해 `onCancelPaste` prop도 추가 필요:

editor/page.tsx에:
```typescript
const handleCancelPaste = useCallback(() => {
  setClipboardAnnotation(null);
}, []);
```

AnnotationEditor props에 `onCancelPaste: () => void` 추가.

---

### Task 5: 빌드 확인

- [ ] **Step 1: 빌드**

Run: `npx next build 2>&1 | tail -10`
Expected: 성공

- [ ] **Step 2: 수동 테스트**

1. 주석 추가 → ▲/▼ 버튼이 항상 보이고 클릭 용이한지
2. ✂️ 클릭 → 배너 표시 → 다른 슬라이드 → 텍스트 선택 → 주석 이동 확인
3. 🎯 클릭 → 배너 표시 → 텍스트 선택 → 타겟만 변경, 내용/색상 유지 확인
4. 기존 주석 추가 플로우 정상 동작 확인

---

## Verification

- [ ] ▲/▼ 버튼이 hover 없이 항상 보이고 충분한 크기
- [ ] 잘라내기 → 다른 슬라이드 → 텍스트 선택 → 붙여넣기 완료
- [ ] 타겟 변경 → 주석 내용/색상/마커 유지, 위치만 변경
- [ ] 잘라내기 후 붙여넣기 취소 가능
- [ ] 타겟 변경 모드 취소 가능
- [ ] 기존 주석 추가/삭제/순서변경 기능 정상
