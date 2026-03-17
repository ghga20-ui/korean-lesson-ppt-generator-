"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SlideData, Genre, Annotation, MarkerType } from "@/lib/types";
import { DEFAULT_ANNOTATION_COLOR, ANNOTATION_COLOR_PALETTE } from "@/lib/types";
import { ChevronUp, ChevronDown, Crosshair, Scissors, Trash2 } from "lucide-react";

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
  rectangle: "사각형",
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

  const [popup, setPopup] = useState<SelectionPopup | null>(null);
  const [popupMarkerType, setPopupMarkerType] =
    useState<MarkerType>("underline");
  const [popupContent, setPopupContent] = useState("");
  const [popupColor, setPopupColor] = useState(DEFAULT_ANNOTATION_COLOR);
  const [summaryContent, setSummaryContent] = useState("");
  const [retargetingId, setRetargetingId] = useState<string | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editingMarkerTypeId, setEditingMarkerTypeId] = useState<string | null>(null);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);

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
    const existingSummary = slide.annotations.find(
      (a) => a.markerType === "summary"
    );
    setSummaryContent(existingSummary?.content || "");
  }, [slide.id, slide.annotations]);

  const handleTextMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !textRef.current) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();
    if (!selectedText.trim()) return;

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

    if (startIndex < 0 || endIndex < 0 || startIndex >= endIndex) return;

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
  }, [retargetingId, clipboardAnnotation, pendingUnmatched, slide, onUpdateSlide, onPasteAnnotation, onAddUnmatched]);

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
      if (!editingContent.trim()) { setEditingAnnotationId(null); return; }
      onUpdateSlide({
        ...slide,
        annotations: slide.annotations.map((a) =>
          a.id === id ? { ...a, content: editingContent.trim() } : a
        ),
      });
      setEditingAnnotationId(null);
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
      setEditingMarkerTypeId(null);
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
      setEditingColorId(null);
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

  const handleSplitAtPrompt = useCallback(() => {
    const input = prompt(
      "분할할 문자 위치를 입력하세요 (0부터 시작, 현재 슬라이드 길이: " +
        slide.text.length +
        ")"
    );
    if (input === null) return;
    const charIndex = parseInt(input, 10);
    if (isNaN(charIndex) || charIndex <= 0 || charIndex >= slide.text.length)
      return;
    onSplitAt(charIndex);
  }, [slide.text.length, onSplitAt]);

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
      if (seg.annotation) {
        const annColor = seg.annotation.color || DEFAULT_ANNOTATION_COLOR;
        return (
          <span
            key={i}
            className="rounded-sm px-0.5"
            style={{ backgroundColor: annColor + "20" }}
            title={`[${seg.annotation.order}] ${seg.annotation.content}`}
          >
            {seg.text}
          </span>
        );
      }
      return <span key={i}>{seg.text}</span>;
    });
  }, [slide]);

  const sortedAnnotations = [...slide.annotations].sort(
    (a, b) => a.order - b.order
  );

  return (
    <div className="flex h-full flex-col gap-0 lg:flex-row">
      {/* Text display with annotations */}
      <div className="flex min-h-0 flex-1 flex-col border-r border-[#CADCFC]/50">
        <div className="border-b border-[#CADCFC]/50 px-6 py-2">
          {retargetingId ? (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-300 px-3 py-1.5">
              <span className="text-xs text-amber-800">🎯 새 타겟 텍스트를 드래그로 선택하세요</span>
              <button onClick={() => setRetargetingId(null)}
                className="text-xs text-amber-600 hover:text-amber-800">취소</button>
            </div>
          ) : clipboardAnnotation ? (
            <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-300 px-3 py-1.5">
              <span className="text-xs text-blue-800">📋 붙여넣을 위치의 텍스트를 드래그로 선택하세요</span>
              <button onClick={onCancelPaste}
                className="text-xs text-blue-600 hover:text-blue-800">취소</button>
            </div>
          ) : pendingUnmatched ? (
            <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-300 px-3 py-1.5">
              <span className="truncate text-xs text-amber-800">📎 미매칭 주석 추가: &ldquo;{pendingUnmatched.content.slice(0, 30)}&rdquo;</span>
              <button onClick={onCancelUnmatched}
                className="flex-shrink-0 text-xs text-amber-600 hover:text-amber-800">취소</button>
            </div>
          ) : (
            <span className="text-xs font-medium text-[#1E2761]/60">
              텍스트 영역 -- 텍스트를 선택하여 주석을 추가하세요
            </span>
          )}
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto p-6">
          <div
            ref={textRef}
            onMouseUp={handleTextMouseUp}
            className="whitespace-pre-wrap text-base leading-relaxed text-[#1E2761] selection:bg-[#CADCFC]"
            style={{ cursor: "text" }}
          >
            {renderHighlightedText()}
          </div>

          {/* Selection popup */}
          {popup && (
            <div
              ref={popupRef}
              className="absolute z-50 w-72 rounded-xl border border-[#CADCFC] bg-white p-4 shadow-xl"
              style={{
                left: `${Math.max(0, popup.x - 144)}px`,
                top: `${popup.y}px`,
              }}
            >
              <div className="mb-3">
                <span className="text-xs text-[#1E2761]/50">선택된 텍스트:</span>
                <p className="mt-1 truncate rounded bg-[#CADCFC]/20 px-2 py-1 text-xs text-[#1E2761]">
                  {popup.selectedText}
                </p>
              </div>

              {/* Marker type selector */}
              <div className="mb-3">
                <span className="mb-1 block text-xs text-[#1E2761]/50">
                  표시 유형:
                </span>
                <div className="flex gap-1">
                  {POPUP_MARKER_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setPopupMarkerType(type)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        popupMarkerType === type
                          ? `${MARKER_COLORS[type]} ${MARKER_BORDER_COLORS[type]} border-2 text-[#1E2761]`
                          : "border-[#CADCFC] text-[#1E2761]/50 hover:border-[#1E2761]/30"
                      }`}
                    >
                      {MARKER_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color palette */}
              <div className="mb-3">
                <span className="mb-1 block text-xs text-[#1E2761]/50">
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
                <span className="mb-1 block text-xs text-[#1E2761]/50">
                  주석 내용:
                </span>
                <textarea
                  value={popupContent}
                  onChange={(e) => setPopupContent(e.target.value)}
                  placeholder="주석을 입력하세요..."
                  className="h-16 w-full resize-none rounded-lg border border-[#CADCFC] px-2 py-1.5 text-xs text-[#1E2761] placeholder-[#1E2761]/50 outline-none focus:border-[#1E2761]"
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
                  className="flex-1 rounded-lg border border-[#CADCFC] px-3 py-1.5 text-xs text-[#1E2761]/60 transition-colors hover:bg-[#CADCFC]/20"
                >
                  취소
                </button>
                <button
                  onClick={handleAddAnnotation}
                  disabled={!popupContent.trim()}
                  className="flex-1 rounded-lg bg-[#1E2761] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#1E2761]/90 disabled:opacity-40"
                >
                  추가
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary input */}
        <div className="flex-shrink-0 border-t border-[#CADCFC]/50 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#1E2761]/50">▶ 슬라이드 요약</span>
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
              className="flex-1 rounded-lg border border-[#CADCFC] px-3 py-1.5 text-xs text-[#1E2761] placeholder-[#1E2761]/50 outline-none focus:border-[#1E2761]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveSummary();
              }}
            />
            <button
              onClick={handleSaveSummary}
              className="rounded-lg bg-[#1E2761] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#1E2761]/90"
            >
              {slide.annotations.some((a) => a.markerType === "summary") ? "수정" : "추가"}
            </button>
          </div>
        </div>

        {/* Slide controls */}
        <div className="flex flex-shrink-0 items-center gap-2 border-t border-[#CADCFC]/50 px-6 py-3">
          <button
            onClick={handleSplitAtPrompt}
            className="rounded-lg border border-[#CADCFC] px-3 py-1.5 text-xs text-[#1E2761] transition-colors hover:bg-[#CADCFC]/20"
          >
            이 위치에서 분할
          </button>
          <button
            onClick={onMergeNext}
            disabled={isLastSlide}
            className="rounded-lg border border-[#CADCFC] px-3 py-1.5 text-xs text-[#1E2761] transition-colors hover:bg-[#CADCFC]/20 disabled:opacity-30"
          >
            다음 슬라이드와 합치기
          </button>
        </div>
      </div>

      {/* Right panel: annotation list */}
      <div className="flex w-full min-h-0 flex-col border-t border-[#CADCFC]/50 lg:w-80 lg:border-t-0">
        <div className="border-b border-[#CADCFC]/50 px-4 py-2">
          <span className="text-xs font-semibold text-[#1E2761]">
            주석 목록 ({slide.annotations.length})
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sortedAnnotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="mb-2 text-2xl text-[#1E2761]/20">+</span>
              <p className="text-xs text-[#1E2761]/60">
                텍스트를 선택하여
                <br />
                주석을 추가하세요
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#CADCFC]/30">
              {sortedAnnotations.map((ann, idx) => (
                <li key={ann.id} className="group px-4 py-3">
                  <div className="flex items-start gap-2">
                    {/* Color dot (clickable) + order number */}
                    <div className="mt-0.5 flex flex-shrink-0 flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingColorId(editingColorId === ann.id ? null : ann.id)}
                          className="inline-block h-3.5 w-3.5 rounded-full border border-gray-300 transition-transform hover:scale-125"
                          style={{ backgroundColor: ann.color || DEFAULT_ANNOTATION_COLOR }}
                          title="색상 변경"
                        />
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E2761] text-[10px] font-bold text-white">
                          {ann.order}
                        </span>
                      </div>
                      {editingColorId === ann.id && (
                        <div className="flex flex-wrap gap-1">
                          {ANNOTATION_COLOR_PALETTE.map((c) => (
                            <button
                              key={c}
                              onClick={() => changeAnnotationColor(ann.id, c)}
                              className={`h-4 w-4 rounded-full border transition-transform hover:scale-110 ${
                                (ann.color || DEFAULT_ANNOTATION_COLOR) === c
                                  ? "border-gray-800 scale-110"
                                  : "border-transparent"
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Target text */}
                      <p
                        className={`mb-1 truncate rounded px-1.5 py-0.5 text-xs ${MARKER_COLORS[ann.markerType]}`}
                      >
                        {ann.targetText}
                      </p>
                      {/* Content — click to edit inline */}
                      {editingAnnotationId === ann.id ? (
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          onBlur={() => saveEditContent(ann.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEditContent(ann.id);
                            }
                            if (e.key === "Escape") setEditingAnnotationId(null);
                          }}
                          className="w-full resize-none rounded border border-[#CADCFC] px-1.5 py-1 text-xs text-[#1E2761] outline-none focus:border-[#1E2761]"
                          rows={2}
                          autoFocus
                        />
                      ) : (
                        <p
                          onClick={() => { setEditingAnnotationId(ann.id); setEditingContent(ann.content); }}
                          className="cursor-pointer rounded px-1 text-xs leading-relaxed text-[#1E2761]/70 hover:bg-[#CADCFC]/20"
                          title="클릭하여 내용 수정"
                        >
                          {ann.content}
                        </p>
                      )}
                      {/* Marker type badge — click to change */}
                      <span
                        onClick={() => setEditingMarkerTypeId(editingMarkerTypeId === ann.id ? null : ann.id)}
                        className={`mt-1 inline-block cursor-pointer rounded border px-1.5 py-0.5 text-[10px] ${MARKER_BORDER_COLORS[ann.markerType]} text-[#1E2761]/50 hover:bg-[#CADCFC]/20`}
                        title="클릭하여 마커 타입 변경"
                      >
                        {MARKER_LABELS[ann.markerType]}
                      </span>
                      {editingMarkerTypeId === ann.id && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {POPUP_MARKER_TYPES.map((type) => (
                            <button
                              key={type}
                              onClick={() => changeMarkerType(ann.id, type)}
                              className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                                ann.markerType === type
                                  ? `${MARKER_BORDER_COLORS[type]} font-bold text-[#1E2761]`
                                  : "border-[#CADCFC] text-[#1E2761]/50 hover:border-[#1E2761]/30"
                              }`}
                            >
                              {MARKER_LABELS[type]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Action buttons — always visible */}
                  <div className="mt-1.5 flex items-center gap-0.5 pl-9">
                    <button onClick={() => handleMoveAnnotation(ann.id, "up")}
                      disabled={idx === 0}
                      className="cursor-pointer rounded p-1 text-[#1E2761]/60 hover:bg-[#CADCFC]/30 disabled:opacity-30"
                      title="위로"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleMoveAnnotation(ann.id, "down")}
                      disabled={idx === sortedAnnotations.length - 1}
                      className="cursor-pointer rounded p-1 text-[#1E2761]/60 hover:bg-[#CADCFC]/30 disabled:opacity-30"
                      title="아래로"><ChevronDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setRetargetingId(ann.id)}
                      className="cursor-pointer rounded p-1 text-[#1E2761]/60 hover:bg-[#CADCFC]/30"
                      title="타겟 변경"><Crosshair className="h-3.5 w-3.5" /></button>
                    <button onClick={() => onCutAnnotation(ann)}
                      className="cursor-pointer rounded p-1 text-[#1E2761]/60 hover:bg-[#CADCFC]/30"
                      title="잘라내기"><Scissors className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDeleteAnnotation(ann.id)}
                      className="cursor-pointer rounded p-1 text-red-400 hover:bg-red-50"
                      title="삭제"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
