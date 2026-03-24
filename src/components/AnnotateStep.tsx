"use client";

import { useRef } from "react";
import type { SlideData, Genre, Annotation, ExtractedAnnotation } from "@/lib/types";
import AnnotationEditor from "@/components/AnnotationEditor";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePanelResize } from "@/hooks/usePanelResize";

interface AnnotateStepProps {
  genre: Genre;
  slides: SlideData[];
  currentSlideIndex: number;
  onSlideSelect: (index: number) => void;
  isGenerating: boolean;
  clipboardAnnotation: Annotation | null;
  unmatchedAnnotations: ExtractedAnnotation[];
  pendingUnmatched: ExtractedAnnotation | null;
  onSetPendingUnmatched: (ann: ExtractedAnnotation | null) => void;
  onUpdateSlide: (slide: SlideData) => void;
  onSplitAt: (charIndex: number) => void;
  onMergeNext: () => void;
  onMergePrev: () => void;
  onCutAnnotation: (annotation: Annotation) => void;
  onPasteAnnotation: (start: number, end: number, text: string) => void;
  onCancelPaste: () => void;
  onAddUnmatched: (start: number, end: number, text: string) => void;
  onCancelUnmatched: () => void;
  onGenerate: () => Promise<void>;
  onResetToInput: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  exportProject: () => void;
  importProject: (file: File) => Promise<void>;
}

export default function AnnotateStep({
  genre,
  slides,
  currentSlideIndex,
  onSlideSelect,
  isGenerating,
  clipboardAnnotation,
  unmatchedAnnotations,
  pendingUnmatched,
  onSetPendingUnmatched,
  onUpdateSlide,
  onSplitAt,
  onMergeNext,
  onMergePrev,
  onCutAnnotation,
  onPasteAnnotation,
  onCancelPaste,
  onAddUnmatched,
  onCancelUnmatched,
  onGenerate,
  onResetToInput,
  canUndo,
  canRedo,
  undo,
  redo,
  exportProject,
  importProject,
}: AnnotateStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentSlide = slides[currentSlideIndex];
  const { width: sidebarWidth, startDrag: startSidebarDrag } = usePanelResize(256, 160, 400, "right");

  useKeyboardShortcuts({
    onPrevSlide: () => onSlideSelect(Math.max(0, currentSlideIndex - 1)),
    onNextSlide: () => onSlideSelect(Math.min(slides.length - 1, currentSlideIndex + 1)),
    onUndo: undo,
    onRedo: redo,
    onSave: exportProject,
    onGenerate: () => { if (!isGenerating) onGenerate(); },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importProject(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar: slide list */}
      <aside className="flex flex-shrink-0 flex-col border-r border-[#EEDDD0] bg-[#EEDDD0]/10" style={{ width: sidebarWidth }}>
        <div className="border-b border-[#EEDDD0] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#6B3F26]">
            슬라이드 ({slides.length})
          </h3>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {slides.map((slide, index) => {
            const firstLine =
              slide.text.split("\n")[0]?.slice(0, 30) || "";
            const isActive = index === currentSlideIndex;
            return (
              <button
                key={slide.id}
                onClick={() => onSlideSelect(index)}
                className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left mb-1 transition-all ${isActive
                  ? "bg-white text-[#6B3F26] shadow-sm ring-1 ring-[#EEDDD0]/60 border-l-4 border-l-[#6B3F26]"
                  : "text-[#6B3F26] hover:bg-[#EEDDD0]/30"
                  }`}
              >
                <span className="text-xs font-semibold">
                  슬라이드 {index + 1}
                </span>
                <span
                  className={`truncate text-xs ${isActive ? "text-[#6B3F26]/70" : "text-[#6B3F26]/50"
                    }`}
                >
                  {firstLine}
                  {firstLine.length >= 30 ? "..." : ""}
                </span>
                {slide.annotations.length > 0 && (
                  <span
                    className={`text-xs ${isActive ? "font-medium text-[#6B3F26]" : "text-[#6B3F26]/60"
                      }`}
                  >
                    주석 {slide.annotations.length}개
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Unmatched annotations quick-add */}
        {unmatchedAnnotations.length > 0 && (
          <div className="border-t border-amber-300 bg-amber-50/50 p-3">
            <p className="mb-2 text-[10px] font-semibold text-amber-800">
              미매칭 {unmatchedAnnotations.length}개
            </p>
            <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
              {unmatchedAnnotations.map((ua, i) => (
                <div key={i} className="flex items-start gap-1 rounded bg-white px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-medium text-amber-900">
                      &ldquo;{ua.targetText}&rdquo;
                    </p>
                    <p className="truncate text-[10px] text-amber-700">{ua.content}</p>
                  </div>
                  <button
                    onClick={() => onSetPendingUnmatched(ua)}
                    className="flex-shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-300"
                  >
                    추가
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="border-t border-[#EEDDD0] p-4">
          <div className="mb-4 space-y-2">
            <div className="flex gap-2">
              <button onClick={undo} disabled={!canUndo}
                className="flex-1 rounded border border-[#EEDDD0] py-1 text-xs text-[#6B3F26] hover:bg-[#EEDDD0]/20 disabled:opacity-30">
                실행 취소
              </button>
              <button onClick={redo} disabled={!canRedo}
                className="flex-1 rounded border border-[#EEDDD0] py-1 text-xs text-[#6B3F26] hover:bg-[#EEDDD0]/20 disabled:opacity-30">
                다시 실행
              </button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={exportProject}
                className="flex-1 rounded border border-[#EEDDD0] py-1 text-xs text-[#6B3F26] hover:bg-[#EEDDD0]/20">
                저장 (JSON)
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded border border-[#EEDDD0] py-1 text-xs text-[#6B3F26] hover:bg-[#EEDDD0]/20">
                불러오기
              </button>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </div>
          </div>

          <button
            onClick={onResetToInput}
            className="mb-2 w-full rounded-lg border border-[#EEDDD0] px-3 py-2 text-xs text-[#6B3F26] transition-colors hover:bg-[#EEDDD0]/20"
          >
            텍스트 다시 입력
          </button>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="w-full rounded-lg bg-[#6B3F26] px-3 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#6B3F26]/95 hover:shadow-md disabled:opacity-40"
          >
            {isGenerating ? "생성 중..." : "PPT 생성"}
          </button>
          
          <div className="mt-3 text-center text-[10px] text-[#6B3F26]/50">
            단축키: Ctrl+S (저장), Ctrl+Enter (생성)
          </div>
        </div>
      </aside>

      {/* Resize handle: slide list ↔ main */}
      <div
        onMouseDown={startSidebarDrag}
        className="group relative z-10 flex w-1.5 flex-shrink-0 cursor-col-resize items-center justify-center bg-transparent transition-colors hover:bg-[#6B3F26]/10 active:bg-[#6B3F26]/20"
        title="드래그하여 너비 조절"
      >
        <div className="h-10 w-px rounded-full bg-[#EEDDD0] transition-colors group-hover:bg-[#6B3F26]/40" />
      </div>

      {/* Main content: annotation editor */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {currentSlide ? (
          <>
            {/* Slide navigation */}
            <div className="flex items-center justify-between border-b border-[#EEDDD0] bg-white px-6 py-3">
              <button
                onClick={() =>
                  onSlideSelect(Math.max(0, currentSlideIndex - 1))
                }
                disabled={currentSlideIndex === 0}
                className="rounded-lg px-3 py-1 text-sm text-[#6B3F26] transition-colors hover:bg-[#EEDDD0]/30 disabled:opacity-30"
              >
                &larr; 이전
              </button>
              <span className="text-sm font-medium text-[#6B3F26]">
                슬라이드 {currentSlideIndex + 1} / {slides.length}
              </span>
              <button
                onClick={() =>
                  onSlideSelect(Math.min(slides.length - 1, currentSlideIndex + 1))
                }
                disabled={currentSlideIndex === slides.length - 1}
                className="rounded-lg px-3 py-1 text-sm text-[#6B3F26] transition-colors hover:bg-[#EEDDD0]/30 disabled:opacity-30"
              >
                다음 &rarr;
              </button>
            </div>

            {/* Annotation editor */}
            <div className="min-h-0 flex-1">
              <AnnotationEditor
                slide={currentSlide}
                genre={genre}
                onUpdateSlide={onUpdateSlide}
                onSplitAt={onSplitAt}
                onMergeNext={onMergeNext}
                onMergePrev={onMergePrev}
                isFirstSlide={currentSlideIndex === 0}
                isLastSlide={currentSlideIndex === slides.length - 1}
                clipboardAnnotation={clipboardAnnotation}
                onCutAnnotation={onCutAnnotation}
                onPasteAnnotation={onPasteAnnotation}
                onCancelPaste={onCancelPaste}
                pendingUnmatched={pendingUnmatched}
                onAddUnmatched={onAddUnmatched}
                onCancelUnmatched={onCancelUnmatched}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[#6B3F26]/60">
            슬라이드가 없습니다
          </div>
        )}
      </main>
    </div>
  );
}
