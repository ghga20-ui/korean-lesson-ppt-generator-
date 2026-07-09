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
      <aside className="flex flex-shrink-0 flex-col border-r border-[#E4E1DA] bg-[#F3F1EC]" style={{ width: sidebarWidth }}>
        <div className="border-b border-[#E4E1DA] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#16202B]">
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
                  ? "bg-[#E8EFF5] text-[#16202B] shadow-sm ring-1 ring-[#C9D6E2] border-l-4 border-l-[#294C67]"
                  : "text-[#16202B] hover:bg-[#EDEAE3]"
                  }`}
              >
                <span className="text-xs font-semibold">
                  슬라이드 {index + 1}
                </span>
                <span
                  className={`kor-text truncate text-xs ${isActive ? "text-[#5B6470]" : "text-[#5B6470]"
                    }`}
                >
                  {firstLine}
                  {firstLine.length >= 30 ? "..." : ""}
                </span>
                {slide.annotations.length > 0 && (
                  <span
                    className={`text-xs ${isActive ? "font-medium text-[#16202B]" : "text-[#5B6470]"
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
        <div className="border-t border-[#E4E1DA] p-4">
          <div className="mb-4 space-y-2">
            <div className="flex gap-2">
              <button onClick={undo} disabled={!canUndo}
                className="flex-1 rounded border border-[#E4E1DA] py-1 text-xs text-[#16202B] hover:bg-[#F3F1EC] disabled:opacity-30">
                실행 취소
              </button>
              <button onClick={redo} disabled={!canRedo}
                className="flex-1 rounded border border-[#E4E1DA] py-1 text-xs text-[#16202B] hover:bg-[#F3F1EC] disabled:opacity-30">
                다시 실행
              </button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={exportProject}
                className="flex-1 rounded border border-[#E4E1DA] py-1 text-xs text-[#16202B] hover:bg-[#F3F1EC]">
                저장 (JSON)
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded border border-[#E4E1DA] py-1 text-xs text-[#16202B] hover:bg-[#F3F1EC]">
                불러오기
              </button>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </div>
          </div>

          <button
            onClick={onResetToInput}
            className="mb-2 w-full rounded-lg border border-[#E4E1DA] px-3 py-2 text-xs text-[#16202B] transition-colors hover:bg-[#F3F1EC]"
          >
            텍스트 다시 입력
          </button>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="w-full rounded-lg bg-[#294C67] px-3 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#21405A] hover:shadow-md disabled:opacity-40"
          >
            {isGenerating ? "내보내는 중..." : "PPT 내보내기"}
          </button>
          
          <div className="mt-3 text-center text-[10px] text-[#5B6470]">
            단축키: Ctrl+S (저장), Ctrl+Enter (내보내기)
          </div>
          <div className="mt-2 text-center text-[10px] leading-relaxed text-[#6E7683]">
            생성 파일은 초안입니다.<br />PowerPoint에서 검토 후 사용하세요.
          </div>
        </div>
      </aside>

      {/* Resize handle: slide list ↔ main */}
      <div
        onMouseDown={startSidebarDrag}
        className="group relative z-10 flex w-1.5 flex-shrink-0 cursor-col-resize items-center justify-center bg-transparent transition-colors hover:bg-[#294C67]/10 active:bg-[#294C67]/20"
        title="드래그하여 너비 조절"
      >
        <div className="h-10 w-px rounded-full bg-[#E4E1DA] transition-colors group-hover:bg-[#294C67]/40" />
      </div>

      {/* Main content: annotation editor */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {currentSlide ? (
          <>
            {/* Slide navigation */}
            <div className="flex items-center justify-between border-b border-[#E4E1DA] bg-white px-6 py-3">
              <button
                onClick={() =>
                  onSlideSelect(Math.max(0, currentSlideIndex - 1))
                }
                disabled={currentSlideIndex === 0}
                className="rounded-lg px-3 py-1 text-sm text-[#16202B] transition-colors hover:bg-[#EDEAE3] disabled:opacity-30"
              >
                &larr; 이전
              </button>
              <span className="text-sm font-medium text-[#16202B]">
                슬라이드 {currentSlideIndex + 1} / {slides.length}
              </span>
              <button
                onClick={() =>
                  onSlideSelect(Math.min(slides.length - 1, currentSlideIndex + 1))
                }
                disabled={currentSlideIndex === slides.length - 1}
                className="rounded-lg px-3 py-1 text-sm text-[#16202B] transition-colors hover:bg-[#EDEAE3] disabled:opacity-30"
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
          <div className="flex flex-1 items-center justify-center text-[#5B6470]">
            슬라이드가 없습니다. 텍스트 다시 입력으로 돌아가 본문을 넣어 주세요.
          </div>
        )}
      </main>
    </div>
  );
}
