"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Genre } from "@/lib/types";
import { useEditorState } from "@/hooks/useEditorState";
import InputStep from "@/components/InputStep";
import AnnotateStep from "@/components/AnnotateStep";

const GENRE_LABELS: Record<Genre, string> = {
  poetry: "운문 / 짧은 텍스트",
  novel: "산문 / 긴 텍스트",
};

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const genreParam = searchParams.get("genre");

  if (genreParam !== "poetry" && genreParam !== "novel") {
    router.replace("/");
    return null;
  }

  return <EditorInner genre={genreParam} />;
}

function EditorInner({ genre }: { genre: Genre }) {
  const router = useRouter();
  const editor = useEditorState(genre);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#E4E1DA] bg-[#294C67] px-6 py-3">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-[#D9E2EA] transition-colors hover:text-white"
        >
          &larr; 처음으로
        </button>
        <h1 className="text-lg font-semibold text-white">
          국어 수업 슬라이드 제작 도구
        </h1>
        <span className="rounded-full bg-white/15 px-3 py-1 text-sm text-[#D9E2EA]">
          {GENRE_LABELS[genre]}
        </span>
      </header>

      {/* Step: Input */}
      {editor.step === "input" && (
        <InputStep
          genre={genre}
          inputMode={editor.inputMode}
          onInputModeChange={editor.setInputMode}
          fullText={editor.fullText}
          onFullTextChange={editor.setFullText}
          pdfFile={editor.pdfFile}
          onPdfFileChange={editor.setPdfFile}
          isExtracting={editor.isExtracting}
          extractionProgress={editor.extractionProgress}
          unmatchedAnnotations={editor.unmatchedAnnotations}
          onDismissUnmatched={() => editor.setUnmatchedAnnotations([])}
          onSplit={editor.handleSplit}
          onExtractAnnotations={editor.handleExtractAnnotations}
          onExtractAll={editor.handleExtractAll}
        />
      )}

      {/* Step: Annotate */}
      {editor.step === "annotate" && (
        <AnnotateStep
          genre={genre}
          slides={editor.slides}
          currentSlideIndex={editor.currentSlideIndex}
          onSlideSelect={editor.setCurrentSlideIndex}
          isGenerating={editor.isGenerating}
          clipboardAnnotation={editor.clipboardAnnotation}
          unmatchedAnnotations={editor.unmatchedAnnotations}
          pendingUnmatched={editor.pendingUnmatched}
          onSetPendingUnmatched={editor.setPendingUnmatched}
          onUpdateSlide={editor.handleUpdateSlide}
          onSplitAt={editor.handleSplitAt}
          onMergeNext={editor.handleMergeNext}
          onMergePrev={editor.handleMergePrev}
          onCutAnnotation={editor.handleCutAnnotation}
          onPasteAnnotation={editor.handlePasteAnnotation}
          onCancelPaste={editor.handleCancelPaste}
          onAddUnmatched={editor.handleAddUnmatched}
          onCancelUnmatched={editor.handleCancelUnmatched}
          onGenerate={editor.handleGenerate}
          onResetToInput={editor.resetToInput}
          pptSettings={editor.pptSettings}
          onChangeSettings={editor.setPptSettings}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          undo={editor.undo}
          redo={editor.redo}
          exportProject={editor.exportProject}
          importProject={editor.importProject}
        />
      )}

      {/* Toast notification */}
      {editor.toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#16202B] px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all">
          {editor.toast}
        </div>
      )}
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <span className="text-[#5B6470]">로딩 중...</span>
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
