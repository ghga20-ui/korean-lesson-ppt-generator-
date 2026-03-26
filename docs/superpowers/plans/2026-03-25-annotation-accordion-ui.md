# 주석 편집 UI 아코디언 카드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `AnnotationEditor.tsx`의 우측 주석 목록 패널을 아코디언 카드 방식으로 교체하여 처음 사용자도 기능을 직관적으로 발견할 수 있게 한다.

**Architecture:** 하나의 파일(`AnnotationEditor.tsx`)만 수정. 상태 변수 정리 → 슬라이드 변경 effect 수정 → 주석 목록 렌더링 교체 순서로 진행. 마커·색상은 클릭 즉시 저장, 내용은 명시적 [저장] 버튼으로 저장.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, lucide-react (GripVertical 유지, ChevronUp/Down 제거)

---

## 파일 변경 범위

| 파일 | 변경 유형 | 내용 |
|---|---|---|
| `src/components/AnnotationEditor.tsx` | Modify | 상태 변수·effect·목록 렌더링 교체 |

다른 파일 변경 없음. `onCutAnnotation` prop 시그니처 유지.

---

## Task 1: 상태 변수 정리 및 슬라이드 변경 effect 수정

**Files:**
- Modify: `src/components/AnnotationEditor.tsx:98-151`

- [ ] **Step 1: 상태 변수 교체**

  `AnnotationEditor.tsx` line 98~108 영역에서 다음을 변경한다.

  **제거할 상태:**
  ```typescript
  // 제거
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingMarkerTypeId, setEditingMarkerTypeId] = useState<string | null>(null);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  ```

  **추가할 상태:**
  ```typescript
  // 추가 (editingContent는 유지)
  const [expandedAnnotationId, setExpandedAnnotationId] = useState<string | null>(null);
  ```

  `editingContent` / `setEditingContent`는 그대로 유지.

- [ ] **Step 2: 슬라이드 변경 useEffect에 expandedAnnotationId 초기화 추가**

  line 142~151 의 `useEffect` 블록:

  ```typescript
  // 변경 전
  useEffect(() => {
    setPopup(null);
    setPopupContent("");
    setRetargetingId(null);
    setIsTextEditMode(false);
    const existingSummary = slide.annotations.find(
      (a) => a.markerType === "summary"
    );
    setSummaryContent(existingSummary?.content || "");
  }, [slide.id, slide.annotations]);
  ```

  ```typescript
  // 변경 후
  useEffect(() => {
    setPopup(null);
    setPopupContent("");
    setRetargetingId(null);
    setExpandedAnnotationId(null);   // 추가
    setIsTextEditMode(false);
    const existingSummary = slide.annotations.find(
      (a) => a.markerType === "summary"
    );
    setSummaryContent(existingSummary?.content || "");
  }, [slide.id, slide.annotations]);
  ```

- [ ] **Step 3: saveEditContent 함수의 상태 변수명 업데이트**

  line 283~295 의 `saveEditContent` 함수에서 `setEditingAnnotationId` → `setExpandedAnnotationId` 로 변경:

  ```typescript
  const saveEditContent = useCallback(
    (id: string) => {
      if (!editingContent.trim()) { setExpandedAnnotationId(null); return; }
      onUpdateSlide({
        ...slide,
        annotations: slide.annotations.map((a) =>
          a.id === id ? { ...a, content: editingContent.trim() } : a
        ),
      });
      setExpandedAnnotationId(null);
    },
    [editingContent, slide, onUpdateSlide]
  );
  ```

- [ ] **Step 4: changeMarkerType, changeAnnotationColor 함수에서 불필요한 state 호출 제거**

  `changeMarkerType` (line 297~308) 에서 `setEditingMarkerTypeId(null)` 제거.
  `changeAnnotationColor` (line 310~321) 에서 `setEditingColorId(null)` 제거.

  ```typescript
  const changeMarkerType = useCallback(
    (id: string, newType: MarkerType) => {
      onUpdateSlide({
        ...slide,
        annotations: slide.annotations.map((a) =>
          a.id === id ? { ...a, markerType: newType } : a
        ),
      });
      // setEditingMarkerTypeId(null) 제거
    },
    [slide, onUpdateSlide]
  );

  const changeAnnotationColor = useCallback(
    (id: string, newColor: string) => {
      onUpdateSlide({
        ...slide,
        annotations: slide.annotations.map((a) =>
          a.id === id ? { ...a, color: newColor } : a
        ),
      });
      // setEditingColorId(null) 제거
    },
    [slide, onUpdateSlide]
  );
  ```

- [ ] **Step 5: import에서 ChevronUp, ChevronDown 제거**

  line 10:
  ```typescript
  // 변경 전
  import { ChevronUp, ChevronDown, Crosshair, Scissors, Trash2, GripVertical } from "lucide-react";

  // 변경 후
  import { Crosshair, Scissors, Trash2, GripVertical } from "lucide-react";
  ```

  > 참고: Crosshair, Scissors, Trash2 import는 Task 2 완료 후 실제로 사용되지 않으면 제거해도 됨. 아코디언에서는 아이콘 없이 텍스트 버튼을 쓰므로 Task 2 완료 후 제거.

---

## Task 2: 주석 목록 렌더링 교체 (아코디언 카드)

**Files:**
- Modify: `src/components/AnnotationEditor.tsx:836-1002` (우측 주석 패널 전체)

- [ ] **Step 1: summary 제외 및 카드 열기 핸들러 작성**

  `sortedAnnotations` 정의 바로 아래(line 578 부근)에 다음을 추가한다:

  ```typescript
  // summary 제외한 주석 목록
  const displayAnnotations = sortedAnnotations.filter(
    (a) => a.markerType !== "summary"
  );

  // 카드 열기 핸들러
  const handleExpandCard = useCallback(
    (ann: Annotation) => {
      // 진행 중 타겟변경 취소
      if (retargetingId) setRetargetingId(null);
      if (expandedAnnotationId === ann.id) {
        // 이미 열린 카드 클릭 → 닫기
        setExpandedAnnotationId(null);
      } else {
        setExpandedAnnotationId(ann.id);
        setEditingContent(ann.content);
      }
    },
    [retargetingId, expandedAnnotationId]
  );
  ```

- [ ] **Step 2: 우측 주석 패널 렌더링 교체**

  `{/* Right panel: annotation list */}` 섹션(line 836~999)에서 `<ul>` 내부의 `sortedAnnotations.map(...)` 블록 전체를 `displayAnnotations.map(...)` 아코디언 카드로 교체한다.

  **빈 상태 (주석 없음):**
  ```tsx
  {displayAnnotations.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="mb-2 text-2xl text-[#6B3F26]/20">+</span>
      <p className="text-xs text-[#6B3F26]/60">
        텍스트를 선택하여
        <br />
        주석을 추가하세요
      </p>
    </div>
  ) : (
    <ul className="divide-y divide-[#EEDDD0]/30">
      {displayAnnotations.map((ann, idx) => {
        const isExpanded = expandedAnnotationId === ann.id;
        return (
          <li
            key={ann.id}
            draggable
            onDragStart={(e) => handleDragStart(e, ann.id)}
            onDragOver={(e) => handleDragOver(e, ann.id)}
            onDrop={(e) => handleDrop(e, ann.id)}
            onDragEnd={handleDragEnd}
            className={`relative transition-all
              ${draggedId === ann.id ? "opacity-30" : "opacity-100"}
              ${isExpanded ? "bg-[#fdf8f5]" : "bg-white"}
            `}
          >
            {dragOverId === ann.id && draggedId !== ann.id && (
              <div className="absolute left-0 top-0 h-0.5 w-full rounded-full bg-blue-500 shadow-sm z-10" />
            )}

            {/* ── 닫힌 헤더 (항상 표시) ── */}
            <div
              className="flex cursor-pointer items-start gap-2 px-3 py-2.5 hover:bg-[#EEDDD0]/10"
              onClick={() => handleExpandCard(ann)}
            >
              {/* 드래그 핸들 */}
              <div
                className="mt-0.5 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0"
                title="드래그하여 순서 변경"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </div>

              {/* 번호 배지 */}
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#6B3F26] text-[10px] font-bold text-white">
                {ann.order}
              </span>

              {/* 요약 정보 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {/* 색상 점 */}
                  <span
                    className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: ann.color || DEFAULT_ANNOTATION_COLOR }}
                  />
                  {/* 마커 배지 */}
                  <span
                    className={`flex-shrink-0 rounded border px-1.5 py-0 text-[10px] font-semibold ${MARKER_BORDER_COLORS[ann.markerType]}`}
                    style={{ color: ann.color || DEFAULT_ANNOTATION_COLOR }}
                  >
                    {MARKER_LABELS[ann.markerType]}
                  </span>
                  {/* 타겟 텍스트 */}
                  <span className="truncate text-xs font-medium text-[#374151]">
                    {ann.targetText}
                  </span>
                </div>
                {/* 내용 미리보기 */}
                <p className="truncate text-xs text-[#6b7280]">{ann.content}</p>
              </div>

              {/* 펼치기 화살표 */}
              <span className="mt-0.5 flex-shrink-0 text-[10px] text-[#9ca3af]">
                {isExpanded ? "▲" : "▼"}
              </span>
            </div>

            {/* ── 열린 편집 영역 ── */}
            {isExpanded && (
              <div className="border-t border-[#eeddd0] px-4 pb-3 pt-3 flex flex-col gap-3">
                {/* 마커 유형 */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">마커 유형</p>
                  <div className="flex flex-wrap gap-1">
                    {POPUP_MARKER_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => changeMarkerType(ann.id, type)}
                        className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          ann.markerType === type
                            ? "border-[#6B3F26] bg-[#6B3F26] text-white"
                            : "border-[#eeddd0] text-[#6B3F26]/60 hover:border-[#6B3F26]/40 hover:text-[#6B3F26]"
                        }`}
                      >
                        {MARKER_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 색상 */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">색상</p>
                  <div className="flex gap-1.5">
                    {ANNOTATION_COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => changeAnnotationColor(ann.id, c)}
                        className={`h-5 w-5 rounded-full border-2 transition-all hover:scale-110 ${
                          (ann.color || DEFAULT_ANNOTATION_COLOR) === c
                            ? "border-gray-700 scale-110"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                {/* 주석 내용 */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">주석 내용</p>
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="w-full resize-none rounded-lg border border-[#eeddd0] px-2.5 py-1.5 text-sm text-[#1E2761] outline-none focus:border-[#6B3F26] focus:ring-1 focus:ring-[#6B3F26]/20"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveEditContent(ann.id);
                      }
                      if (e.key === "Escape") setExpandedAnnotationId(null);
                    }}
                  />
                </div>

                {/* 액션 버튼 */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => saveEditContent(ann.id)}
                    className="rounded-lg bg-[#6B3F26] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#6B3F26]/90"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => { setRetargetingId(ann.id); setExpandedAnnotationId(null); }}
                    className="rounded-lg border border-[#eeddd0] px-3 py-1 text-xs text-[#6B3F26] transition-colors hover:bg-[#eeddd0]/30"
                  >
                    타겟변경
                  </button>
                  <button
                    onClick={() => { onCutAnnotation(ann); setExpandedAnnotationId(null); }}
                    className="rounded-lg border border-[#eeddd0] px-3 py-1 text-xs text-[#6B3F26] transition-colors hover:bg-[#eeddd0]/30"
                  >
                    다른 슬라이드로
                  </button>
                  <button
                    onClick={() => handleDeleteAnnotation(ann.id)}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-500 transition-colors hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  )}
  ```

- [ ] **Step 3: lucide-react import 정리**

  Task 2 완료 후 Crosshair, Scissors, Trash2 는 더 이상 사용되지 않음. import 정리:
  ```typescript
  import { GripVertical } from "lucide-react";
  ```

- [ ] **Step 4: 개발 서버에서 브라우저 수동 검증**

  `npm run dev` 실행 후 http://localhost:3000 에서 다음을 확인:

  1. 주석 목록에서 각 카드가 닫힌 상태로 표시됨 (색상점 + 마커배지 + 타겟 + 내용 미리보기)
  2. summary 주석이 목록에 표시되지 않음
  3. 카드 클릭 시 펼쳐짐 (마커 pill + 색상 + textarea + 액션 버튼)
  4. 다른 카드 클릭 시 이전 카드 닫힘 (one-open-at-a-time)
  5. 마커 pill 클릭 시 즉시 반영 (배지 색상 변경)
  6. 색상 도트 클릭 시 즉시 반영
  7. textarea 편집 후 [저장] → 내용 반영 + 카드 닫힘
  8. [타겟변경] → 카드 닫힘 + 상단 바에 "새 타겟 텍스트를 드래그" 안내
  9. [다른 슬라이드로] → 주석 잘라내기 동작 (클립보드 모드 진입)
  10. [삭제] → 주석 제거
  11. 드래그&드롭으로 순서 변경
  12. 슬라이드 변경 시 열린 카드 자동 닫힘
  13. 타겟변경 중 다른 카드 클릭 → 타겟변경 취소됨

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/AnnotationEditor.tsx
  git commit -m "feat: 주석 목록 UI 아코디언 카드 방식으로 교체"
  ```

---

## 참고: 변경되지 않는 것

- `handleMoveAnnotation` 함수: 코드에 남아있어도 무방 (BatchEditPanel에서 참조 가능성)
- `BatchEditPanel` 컴포넌트: 그대로 유지
- 텍스트 선택 팝업 플로우: 변경 없음
- 슬라이드 요약 하단 입력: 변경 없음
- `onCutAnnotation` prop 이름: 변경 없음 (버튼 레이블만 변경)
