"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { usePanelResize } from "@/hooks/usePanelResize";
import type { SlideData, Genre, Annotation, MarkerType } from "@/lib/types";
import { DEFAULT_ANNOTATION_COLOR, ANNOTATION_COLOR_PALETTE, DEFAULT_POETRY_SETTINGS, DEFAULT_NOVEL_SETTINGS } from "@/lib/types";
import { countVisualLines } from "@/lib/pptx-geometry";
import { getMaxLinesPerSlide } from "@/lib/slide-splitter";
import { TEXT_LEFT_MARGIN } from "@/lib/pptx-constants";
import { GripVertical } from "lucide-react";
import BatchEditPanel from "@/components/BatchEditPanel";

interface AnnotationEditorProps {
  slide: SlideData;
  genre: Genre;
  onUpdateSlide: (updatedSlide: SlideData) => void;
  onSplitAt: (charIndex: number) => void;
  onMergeNext: () => void;
  onMergePrev: () => void;
  isFirstSlide: boolean;
  isLastSlide: boolean;
  clipboardAnnotation: Annotation | null;
  onCutAnnotation: (annotation: Annotation) => void;
  onPasteAnnotation: (startIndex: number, endIndex: number, targetText: string) => void;
  onCancelPaste: () => void;
  pendingUnmatched: import("@/lib/types").ExtractedAnnotation | null;
  onAddUnmatched: (startIndex: number, endIndex: number, targetText: string) => void;
  onCancelUnmatched: () => void;
}

const MARKER_COLORS: Record<MarkerType, string> = {
  underline: "bg-blue-200/60",
  circle: "bg-green-200/60",
  rectangle: "bg-orange-200/60",
  triangle: "bg-purple-200/60",
  bracket: "bg-teal-200/60",
  summary: "bg-slate-200/60",
};

const MARKER_BORDER_COLORS: Record<MarkerType, string> = {
  underline: "border-blue-400",
  circle: "border-green-400",
  rectangle: "border-orange-400",
  triangle: "border-purple-400",
  bracket: "border-teal-400",
  summary: "border-slate-400",
};

const MARKER_LABELS: Record<MarkerType, string> = {
  underline: "밑줄",
  circle: "원형",
  rectangle: "네모",
  triangle: "세모",
  bracket: "꺾쇠",
  summary: "요약",
};

/** Marker types shown in the text-selection popup (excludes summary) */
const POPUP_MARKER_TYPES: MarkerType[] = ["underline", "circle", "rectangle", "triangle", "bracket"];

interface SelectionPopup {
  x: number;
  y: number;
  startIndex: number;
  endIndex: number;
  selectedText: string;
}

export default function AnnotationEditor({
  slide,
  genre,
  onUpdateSlide,
  onSplitAt,
  onMergeNext,
  onMergePrev,
  isFirstSlide,
  isLastSlide,
  clipboardAnnotation,
  onCutAnnotation,
  onPasteAnnotation,
  onCancelPaste,
  pendingUnmatched,
  onAddUnmatched,
  onCancelUnmatched,
}: AnnotationEditorProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Overflow indicator
  const pptSettings = genre === "poetry" ? DEFAULT_POETRY_SETTINGS : DEFAULT_NOVEL_SETTINGS;
  const textAreaWidth = pptSettings.slideWidth - TEXT_LEFT_MARGIN * 2;
  const maxLines = getMaxLinesPerSlide(pptSettings);
  const usedLines = countVisualLines(slide.text, pptSettings.fontSize, textAreaWidth);
  const overflowRatio = usedLines / maxLines;
  const isOverflow = usedLines > maxLines + 1;   // 9줄부터 경고
  const isWarning = !isOverflow && usedLines >= maxLines; // 7-8줄은 주의

  const [popup, setPopup] = useState<SelectionPopup | null>(null);
  const [popupMarkerType, setPopupMarkerType] =
    useState<MarkerType>("underline");
  const [popupContent, setPopupContent] = useState("");
  const [popupColor, setPopupColor] = useState(DEFAULT_ANNOTATION_COLOR);
  const [summaryContent, setSummaryContent] = useState("");
  const [retargetingId, setRetargetingId] = useState<string | null>(null);
  const [expandedAnnotationId, setExpandedAnnotationId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Annotation panel resize
  const { width: annotationPanelWidth, startDrag: startAnnotationPanelDrag } = usePanelResize(380, 200, 560, "left");

  // Split mode state
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitCharIndex, setSplitCharIndex] = useState<number | null>(null);

  // Text edit mode state
  const [isTextEditMode, setIsTextEditMode] = useState(false);
  const [editingText, setEditingText] = useState("");

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        textRef.current &&
        !textRef.current.contains(e.target as Node)
      ) {
        setPopup(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset popup when slide changes; load existing summary
  useEffect(() => {
    setPopup(null);
    setPopupContent("");
    setRetargetingId(null);
    setExpandedAnnotationId(null);
    setIsTextEditMode(false);
    const existingSummary = slide.annotations.find(
      (a) => a.markerType === "summary"
    );
    setSummaryContent(existingSummary?.content || "");
  }, [slide.id, slide.annotations]);

  const handleTextMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !textRef.current) return;

    // Normal annotation requires a selected range, but split mode accepts a click (collapsed selection)
    if (!isSplitMode && selection.isCollapsed) return;

    // In split mode, we only care if they clicked or selected something
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();

    // Calculate character indices in the slide's text
    // Walk through the text container's child nodes to find offset
    const container = textRef.current;
    let startIndex = -1;
    let endIndex = -1;

    // Use a TreeWalker to count text positions
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );
    let charCount = 0;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      if (node === range.startContainer) {
        startIndex = charCount + range.startOffset;
      }
      if (node === range.endContainer) {
        endIndex = charCount + range.endOffset;
      }
      charCount += textNode.length;
    }

    if (startIndex < 0 || endIndex < 0) return;

    // Handle split mode
    if (isSplitMode) {
      setSplitCharIndex(startIndex);
      selection.removeAllRanges();
      return;
    }

    if (startIndex >= endIndex || !selectedText.trim()) return;

    // Mode: retarget existing annotation
    if (retargetingId) {
      onUpdateSlide({
        ...slide,
        annotations: slide.annotations.map((a) =>
          a.id === retargetingId
            ? { ...a, startIndex, endIndex, targetText: selectedText }
            : a
        ),
      });
      setRetargetingId(null);
      selection.removeAllRanges();
      return;
    }

    // Mode: paste clipboard annotation at new target
    if (clipboardAnnotation) {
      onPasteAnnotation(startIndex, endIndex, selectedText);
      selection.removeAllRanges();
      return;
    }

    // Mode: add unmatched annotation at selected target
    if (pendingUnmatched) {
      onAddUnmatched(startIndex, endIndex, selectedText);
      selection.removeAllRanges();
      return;
    }

    // Default: show annotation creation popup
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setPopup({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.bottom - containerRect.top + 8,
      startIndex,
      endIndex,
      selectedText,
    });
    setPopupContent("");
    setPopupMarkerType("underline");
  }, [isSplitMode, retargetingId, clipboardAnnotation, pendingUnmatched, slide, onUpdateSlide, onPasteAnnotation, onAddUnmatched]);

  const handleAddAnnotation = useCallback(() => {
    if (!popup || !popupContent.trim()) return;

    const nextOrder =
      slide.annotations.length > 0
        ? Math.max(...slide.annotations.map((a) => a.order)) + 1
        : 1;

    const newAnnotation: Annotation = {
      id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
      startIndex: popup.startIndex,
      endIndex: popup.endIndex,
      targetText: popup.selectedText,
      content: popupContent.trim(),
      markerType: popupMarkerType,
      order: nextOrder,
      color: popupColor,
    };

    onUpdateSlide({
      ...slide,
      annotations: [...slide.annotations, newAnnotation],
    });

    setPopup(null);
    setPopupContent("");
  }, [popup, popupContent, popupMarkerType, popupColor, slide, onUpdateSlide]);

  const handleDeleteAnnotation = useCallback(
    (annotationId: string) => {
      onUpdateSlide({
        ...slide,
        annotations: slide.annotations.filter((a) => a.id !== annotationId),
      });
    },
    [slide, onUpdateSlide]
  );

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

  const changeMarkerType = useCallback(
    (id: string, newType: MarkerType) => {
      onUpdateSlide({
        ...slide,
        annotations: slide.annotations.map((a) =>
          a.id === id ? { ...a, markerType: newType } : a
        ),
      });
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
    },
    [slide, onUpdateSlide]
  );

  const handleMoveAnnotation = useCallback(
    (annotationId: string, direction: "up" | "down") => {
      const sorted = [...slide.annotations].sort(
        (a, b) => a.order - b.order
      );
      const idx = sorted.findIndex((a) => a.id === annotationId);
      if (idx < 0) return;
      if (direction === "up" && idx === 0) return;
      if (direction === "down" && idx === sorted.length - 1) return;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      const tempOrder = sorted[idx].order;
      sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
      sorted[swapIdx] = { ...sorted[swapIdx], order: tempOrder };

      onUpdateSlide({
        ...slide,
        annotations: sorted,
      });
    },
    [slide, onUpdateSlide]
  );

  const handleDragStart = useCallback((e: React.DragEvent<HTMLLIElement>, id: string) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
    // Use a small timeout to allow the drag image to be generated before setting opacity
    setTimeout(() => {
      e.target.dispatchEvent(new CustomEvent("dragstarted"));
    }, 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLIElement>, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) {
      e.dataTransfer.dropEffect = "move";
      setDragOverId(id);
    }
  }, [draggedId]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLIElement>, id: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === id) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const sorted = [...slide.annotations].sort((a, b) => a.order - b.order);
    const fromIdx = sorted.findIndex((a) => a.id === draggedId);
    const toIdx = sorted.findIndex((a) => a.id === id);

    if (fromIdx >= 0 && toIdx >= 0) {
      const draggedItem = sorted[fromIdx];
      sorted.splice(fromIdx, 1);
      sorted.splice(toIdx, 0, draggedItem);
      
      // Update order values based on array position
      const reordered = sorted.map((ann, idx) => ({ ...ann, order: idx + 1 }));
      
      onUpdateSlide({
        ...slide,
        annotations: reordered,
      });
    }

    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, slide, onUpdateSlide]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const handleBatchUpdate = useCallback((updatedAnnotations: Annotation[]) => {
    // Merge updated annotations with the rest that weren't selected
    const updatedMap = new Map(updatedAnnotations.map(a => [a.id, a]));
    const nextList = slide.annotations
      .map(oldAnn => updatedMap.get(oldAnn.id) || oldAnn)
      .filter(ann => {
        // If it was in the slide but not in updatedMap AND it was deleted, it would be missing.
        // BatchEditPanel passes *all* remaining annotations when a delete happens.
        return true; 
      });

    // Actually, BatchEditPanel returns the *filtered/updated list of just the selected + remaining target ones*.
    // Wait, BatchEditPanel receives all annotations, and returns the full list of ALL annotations after modifications or deletions.
    onUpdateSlide({
      ...slide,
      annotations: updatedAnnotations,
    });
  }, [slide, onUpdateSlide]);

  const handleStartTextEdit = useCallback(() => {
    setEditingText(slide.text);
    setIsTextEditMode(true);
  }, [slide.text]);

  const handleConfirmTextEdit = useCallback(() => {
    if (editingText !== slide.text) {
      // Remove annotations whose indices now exceed the new text length
      const validAnnotations = slide.annotations.filter(
        (a) => a.startIndex < editingText.length && a.endIndex <= editingText.length
      );
      onUpdateSlide({ ...slide, text: editingText, annotations: validAnnotations });
    }
    setIsTextEditMode(false);
  }, [editingText, slide, onUpdateSlide]);

  const handleCancelTextEdit = useCallback(() => {
    setIsTextEditMode(false);
  }, []);

  const handleStartSplitMode = useCallback(() => {
    setIsSplitMode(true);
    setSplitCharIndex(null);
  }, []);

  const handleConfirmSplit = useCallback(() => {
    if (splitCharIndex !== null && splitCharIndex > 0 && splitCharIndex < slide.text.length) {
      onSplitAt(splitCharIndex);
    }
    setIsSplitMode(false);
    setSplitCharIndex(null);
  }, [splitCharIndex, onSplitAt, slide.text.length]);

  const handleCancelSplit = useCallback(() => {
    setIsSplitMode(false);
    setSplitCharIndex(null);
  }, []);

  const handleSaveSummary = useCallback(() => {
    const trimmed = summaryContent.trim();
    const existing = slide.annotations.find((a) => a.markerType === "summary");

    if (!trimmed) {
      // Remove summary if empty
      if (existing) {
        onUpdateSlide({
          ...slide,
          annotations: slide.annotations.filter(
            (a) => a.markerType !== "summary"
          ),
        });
      }
      return;
    }

    if (existing) {
      // Update existing summary
      onUpdateSlide({
        ...slide,
        annotations: slide.annotations.map((a) =>
          a.id === existing.id ? { ...a, content: trimmed } : a
        ),
      });
    } else {
      // Add new summary
      const nextOrder =
        slide.annotations.length > 0
          ? Math.max(...slide.annotations.map((a) => a.order)) + 1
          : 1;
      onUpdateSlide({
        ...slide,
        annotations: [
          ...slide.annotations,
          {
            id: "summary-" + Date.now(),
            startIndex: 0,
            endIndex: slide.text.length,
            targetText: slide.text.slice(0, 30),
            content: trimmed,
            markerType: "summary" as MarkerType,
            order: nextOrder,
            color: DEFAULT_ANNOTATION_COLOR,
          },
        ],
      });
    }
  }, [summaryContent, slide, onUpdateSlide]);

  // Build highlighted text segments
  const renderHighlightedText = useCallback(() => {
    const text = slide.text;
    if (slide.annotations.length === 0) {
      return <span>{text}</span>;
    }

    // Create a character-level marker map
    const charMarkers: (Annotation | null)[] = new Array(text.length).fill(
      null
    );
    // Later annotations overwrite earlier ones for overlapping regions
    const sorted = [...slide.annotations].sort(
      (a, b) => a.order - b.order
    );
    for (const ann of sorted) {
      for (let i = ann.startIndex; i < ann.endIndex && i < text.length; i++) {
        charMarkers[i] = ann;
      }
    }

    // Build segments
    const segments: { text: string; annotation: Annotation | null }[] = [];
    let currentAnn = charMarkers[0];
    let segStart = 0;

    for (let i = 1; i <= text.length; i++) {
      const ann = i < text.length ? charMarkers[i] : null;
      // Force-push at end of text to avoid losing trailing unannotated text
      if (ann !== currentAnn || i === text.length) {
        segments.push({
          text: text.slice(segStart, i),
          annotation: currentAnn,
        });
        currentAnn = ann;
        segStart = i;
      }
    }

    return segments.map((seg, i) => {
      // Calculate start index of this segment
      const segStart = segments.slice(0, i).reduce((acc, s) => acc + s.text.length, 0);
      let segContent: React.ReactNode = seg.text;

      // Inject split marker if needed
      if (isSplitMode && splitCharIndex !== null && splitCharIndex >= segStart && splitCharIndex < segStart + seg.text.length) {
        const localIdx = splitCharIndex - segStart;
        segContent = (
          <>
            {seg.text.slice(0, localIdx)}
            <span className="mx-px inline-block h-5 w-0.5 border-l-2 border-dashed border-red-500 align-middle animate-pulse shadow-[0_0_4px_rgba(239,68,68,0.8)]" title="이 위치에서 분할" />
            {seg.text.slice(localIdx)}
          </>
        );
      }

      if (seg.annotation) {
        const annColor = seg.annotation.color || DEFAULT_ANNOTATION_COLOR;
        return (
          <span
            key={i}
            className="rounded-sm px-0.5"
            style={{ backgroundColor: annColor + "20" }}
            title={`[${seg.annotation.order}] ${seg.annotation.content}`}
          >
            {segContent}
          </span>
        );
      }
      return <span key={i}>{segContent}</span>;
    });
  }, [slide, isSplitMode, splitCharIndex]);

  const sortedAnnotations = [...slide.annotations].sort(
    (a, b) => a.order - b.order
  );

  // summary 제외한 표시용 목록
  const displayAnnotations = sortedAnnotations.filter(
    (a) => a.markerType !== "summary"
  );

  // 카드 열기/닫기 핸들러
  const handleExpandCard = (ann: Annotation) => {
    if (retargetingId) setRetargetingId(null);
    if (expandedAnnotationId === ann.id) {
      setExpandedAnnotationId(null);
    } else {
      setExpandedAnnotationId(ann.id);
      setEditingContent(ann.content);
    }
  };

  return (
    <div className="flex h-full flex-col gap-0 lg:flex-row">
      {/* Text display with annotations */}
      <div className="flex min-h-0 flex-1 flex-col border-r border-[#EEDDD0]/50">
        <div className="border-b border-[#EEDDD0]/50 px-6 py-2">
          {isTextEditMode ? (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-300 px-3 py-1.5 shadow-sm">
              <span className="text-xs font-semibold text-emerald-800">✏ 텍스트 편집 중 — 완료 후 저장됩니다</span>
              <div className="flex gap-2">
                <button onClick={handleCancelTextEdit} className="text-xs text-emerald-600 hover:text-emerald-800">취소</button>
                <button onClick={handleConfirmTextEdit} className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700">완료</button>
              </div>
            </div>
          ) : isSplitMode ? (
            <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-300 px-3 py-1.5 shadow-sm">
              <span className="text-xs font-semibold text-red-800">✂ 텍스트 위치를 클릭하여 분할 기준점을 지정하세요</span>
              <div className="flex gap-2">
                <button onClick={handleCancelSplit} className="text-xs text-red-600 hover:text-red-800">취소</button>
                <button onClick={handleConfirmSplit} disabled={splitCharIndex === null} className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40">확인</button>
              </div>
            </div>
          ) : retargetingId ? (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-300 px-3 py-1.5 shadow-sm">
              <span className="text-xs text-amber-800">🎯 새 타겟 텍스트를 드래그로 선택하세요</span>
              <button onClick={() => setRetargetingId(null)}
                className="text-xs text-amber-600 hover:text-amber-800">취소</button>
            </div>
          ) : clipboardAnnotation ? (
            <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-300 px-3 py-1.5 shadow-sm">
              <span className="text-xs text-blue-800">📋 붙여넣을 위치의 텍스트를 드래그로 선택하세요</span>
              <button onClick={onCancelPaste}
                className="text-xs text-blue-600 hover:text-blue-800">취소</button>
            </div>
          ) : pendingUnmatched ? (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-300 px-3 py-1.5 shadow-sm">
              <span className="truncate text-xs text-amber-800">📎 미매칭 주석 추가: &ldquo;{pendingUnmatched.content.slice(0, 30)}&rdquo;</span>
              <button onClick={onCancelUnmatched}
                className="flex-shrink-0 text-xs text-amber-600 hover:text-amber-800">취소</button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-medium text-[#6B3F26]/60">
                텍스트를 선택하여 주석을 추가하세요
              </span>
              <button
                onClick={handleStartTextEdit}
                className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                ✏ 텍스트 편집
              </button>
            </div>
          )}
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto p-6">
          {isTextEditMode ? (
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              autoFocus
              className="h-full min-h-64 w-full resize-none rounded-lg border border-emerald-300 bg-emerald-50/30 p-3 text-base leading-relaxed text-[#1E2761] focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            />
          ) : (
          <div
            ref={textRef}
            onMouseUp={handleTextMouseUp}
            className={`whitespace-pre-wrap text-base leading-relaxed text-[#1E2761] selection:bg-[#EEDDD0] ${isSplitMode ? "cursor-crosshair selection:bg-transparent" : "cursor-text"}`}
          >
            {renderHighlightedText()}
          </div>
          )}

          {/* Selection popup */}
          {popup && (
            <div
              ref={popupRef}
              className="absolute z-50 w-72 rounded-xl border border-[#EEDDD0] bg-white p-4 shadow-xl"
              style={{
                left: `${Math.max(0, popup.x - 144)}px`,
                top: `${popup.y}px`,
              }}
            >
              <div className="mb-3">
                <span className="text-xs text-[#6B3F26]/50">선택된 텍스트:</span>
                <p className="mt-1 truncate rounded bg-[#EEDDD0]/20 px-2 py-1 text-xs text-[#6B3F26]">
                  {popup.selectedText}
                </p>
              </div>

              {/* Marker type selector */}
              <div className="mb-3">
                <span className="mb-1 block text-xs text-[#6B3F26]/50">
                  표시 유형:
                </span>
                <div className="flex gap-1">
                  {POPUP_MARKER_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setPopupMarkerType(type)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        popupMarkerType === type
                          ? `${MARKER_COLORS[type]} ${MARKER_BORDER_COLORS[type]} border-2 text-[#6B3F26]`
                          : "border-[#EEDDD0] text-[#6B3F26]/50 hover:border-[#6B3F26]/30"
                      }`}
                    >
                      {MARKER_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color palette */}
              <div className="mb-3">
                <span className="mb-1 block text-xs text-[#6B3F26]/50">
                  색상:
                </span>
                <div className="flex gap-1.5">
                  {ANNOTATION_COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPopupColor(c)}
                      className={`h-5 w-5 rounded-full border-2 transition-all ${
                        popupColor === c
                          ? "scale-110 border-gray-800"
                          : "border-transparent hover:border-gray-400"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Annotation content */}
              <div className="mb-3">
                <span className="mb-1 block text-xs text-[#6B3F26]/50">
                  주석 내용:
                </span>
                <textarea
                  value={popupContent}
                  onChange={(e) => setPopupContent(e.target.value)}
                  placeholder="주석을 입력하세요..."
                  className="h-16 w-full resize-none rounded-lg border border-[#EEDDD0] px-2 py-1.5 text-xs text-[#6B3F26] placeholder-[#6B3F26]/50 outline-none focus:border-[#6B3F26]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddAnnotation();
                    }
                  }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPopup(null)}
                  className="flex-1 rounded-lg border border-[#EEDDD0] px-3 py-1.5 text-xs text-[#6B3F26]/60 transition-colors hover:bg-[#EEDDD0]/20"
                >
                  취소
                </button>
                <button
                  onClick={handleAddAnnotation}
                  disabled={!popupContent.trim()}
                  className="flex-1 rounded-lg bg-[#6B3F26] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#6B3F26]/90 disabled:opacity-40"
                >
                  추가
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary input */}
        <div className="flex-shrink-0 border-t border-[#EEDDD0]/50 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#6B3F26]/50">▶ 슬라이드 요약</span>
            {slide.annotations.some((a) => a.markerType === "summary") && (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">저장됨</span>
            )}
          </div>
          <div className="mt-1.5 flex gap-2">
            <input
              type="text"
              value={summaryContent}
              onChange={(e) => setSummaryContent(e.target.value)}
              placeholder="이 슬라이드의 요약을 입력하세요..."
              className="flex-1 rounded-lg border border-[#EEDDD0] px-3 py-1.5 text-xs text-[#6B3F26] placeholder-[#6B3F26]/50 outline-none focus:border-[#6B3F26]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveSummary();
              }}
            />
            <button
              onClick={handleSaveSummary}
              className="rounded-lg bg-[#6B3F26] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#6B3F26]/90"
            >
              {slide.annotations.some((a) => a.markerType === "summary") ? "수정" : "추가"}
            </button>
          </div>
        </div>

        {/* Slide controls */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-[#EEDDD0]/50 px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartSplitMode}
              disabled={isSplitMode}
              className="rounded-lg border border-red-300 bg-red-50 text-red-600 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              ✂ 분할선 표시
            </button>
          </div>

          {/* Capacity indicator */}
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isOverflow ? "bg-red-500" : isWarning ? "bg-amber-400" : "bg-[#6B3F26]/40"}`}
                style={{ width: `${Math.min(100, overflowRatio * 100)}%` }}
              />
            </div>
            <span className={`text-xs font-medium tabular-nums ${isOverflow ? "text-red-600" : isWarning ? "text-amber-600" : "text-[#6B3F26]/60"}`}>
              {usedLines}/{maxLines}줄
            </span>
            {isOverflow && (
              <span className="text-xs text-red-500 font-medium">⚠ PPT 잘림 가능</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onMergePrev}
              disabled={isFirstSlide}
              className="rounded-lg border border-[#EEDDD0] bg-white px-3 py-1.5 text-xs text-[#6B3F26] transition-colors hover:bg-[#EEDDD0]/20 disabled:opacity-30"
            >
              ↑ 이전과 병합
            </button>
            <button
              onClick={onMergeNext}
              disabled={isLastSlide}
              className="rounded-lg border border-[#EEDDD0] bg-white px-3 py-1.5 text-xs text-[#6B3F26] transition-colors hover:bg-[#EEDDD0]/20 disabled:opacity-30"
            >
              ↓ 다음과 병합
            </button>
          </div>
        </div>
      </div>

      {/* Resize handle: text area ↔ annotation list */}
      <div
        onMouseDown={startAnnotationPanelDrag}
        className="group relative z-10 hidden lg:flex w-1.5 flex-shrink-0 cursor-col-resize items-center justify-center bg-transparent transition-colors hover:bg-[#6B3F26]/10 active:bg-[#6B3F26]/20"
        title="드래그하여 너비 조절"
      >
        <div className="h-10 w-px rounded-full bg-[#EEDDD0] transition-colors group-hover:bg-[#6B3F26]/40" />
      </div>

      {/* Right panel: annotation list */}
      <div
        className="flex min-h-0 flex-col border-t border-[#EEDDD0]/50 lg:border-t-0 lg:flex-shrink-0"
        style={{ width: annotationPanelWidth }}
      >
        <div className="flex items-center justify-between border-b border-[#EEDDD0]/50 px-4 py-2">
          <span className="text-xs font-semibold text-[#6B3F26]">
            주석 목록 ({slide.annotations.length})
          </span>
          {slide.annotations.length > 0 && (
            <BatchEditPanel annotations={slide.annotations} onBatchUpdate={handleBatchUpdate} />
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
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
              {displayAnnotations.map((ann) => {
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
                        className="mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
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
                        <div className="mb-0.5 flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full border border-white shadow-sm"
                            style={{ backgroundColor: ann.color || DEFAULT_ANNOTATION_COLOR }}
                          />
                          <span
                            className={`flex-shrink-0 rounded border px-1.5 py-0 text-[10px] font-semibold ${MARKER_BORDER_COLORS[ann.markerType]}`}
                            style={{ color: ann.color || DEFAULT_ANNOTATION_COLOR }}
                          >
                            {MARKER_LABELS[ann.markerType]}
                          </span>
                          <span className="truncate text-xs font-medium text-[#374151]">
                            {ann.targetText}
                          </span>
                        </div>
                        <p className="truncate text-xs text-[#6b7280]">{ann.content}</p>
                      </div>

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
        </div>
      </div>
    </div>
  );
}
