"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Genre, SlideData, InputMode, ExtractedAnnotation, Annotation, PptSettings } from "@/lib/types";
import { DEFAULT_POETRY_SETTINGS, DEFAULT_NOVEL_SETTINGS } from "@/lib/types";
import { SUPPORTED_FONTS } from "@/lib/font-metrics";
import { splitText, splitSlideAt, mergeSlides } from "@/lib/slide-splitter";
import { matchAnnotationsToText, distributeAnnotationsToSlides } from "@/lib/annotation-matcher";
import AnnotationEditor from "@/components/AnnotationEditor";
import ModeSelector from "@/components/ModeSelector";
import PdfUploader from "@/components/PdfUploader";

const GENRE_LABELS: Record<Genre, string> = {
  poetry: "운문 / 짧은 텍스트",
  novel: "산문 / 긴 텍스트",
};

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const genreParam = searchParams.get("genre");

  // Redirect if no valid genre
  if (genreParam !== "poetry" && genreParam !== "novel") {
    router.replace("/");
    return null;
  }

  const genre: Genre = genreParam;

  return <EditorInner genre={genre} />;
}

function EditorInner({ genre }: { genre: Genre }) {
  const router = useRouter();

  const [step, setStep] = useState<"input" | "annotate">("input");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);
  const [fullText, setFullText] = useState("");
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [clipboardAnnotation, setClipboardAnnotation] = useState<Annotation | null>(null);
  const [pptSettings, setPptSettings] = useState<PptSettings>(
    genre === "poetry" ? { ...DEFAULT_POETRY_SETTINGS } : { ...DEFAULT_NOVEL_SETTINGS }
  );

  // Mode A/B/C state
  const [inputMode, setInputMode] = useState<InputMode>("C");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState("");
  const [unmatchedAnnotations, setUnmatchedAnnotations] = useState<ExtractedAnnotation[]>([]);
  const [pendingUnmatched, setPendingUnmatched] = useState<ExtractedAnnotation | null>(null);

  const handleSplit = useCallback(() => {
    if (!fullText.trim()) return;
    const result = splitText(fullText, genre, pptSettings);
    setSlides(result);
    setCurrentSlideIndex(0);
    setStep("annotate");
  }, [fullText, genre]);

  // Mode C: Extract annotations from PDF via server API
  const handleExtractAnnotations = useCallback(async () => {
    if (!pdfFile || !fullText.trim()) return;
    setIsExtracting(true);
    setExtractionProgress("추출 중...");
    setUnmatchedAnnotations([]);

    try {
      const formData = new FormData();
      formData.append("pdf", pdfFile);
      formData.append("mode", "C");
      formData.append("genre", genre);
      formData.append("userText", fullText);

      const response = await fetch("/api/extract", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "추출 실패" }));
        throw new Error(err.error);
      }
      const result = await response.json();

      // Match extracted annotations to full text
      const { matched, unmatched } = matchAnnotationsToText(fullText, result.annotations);

      if (unmatched.length > 0) {
        setUnmatchedAnnotations(unmatched);
      }

      // Compute forced break points for summary annotations (paragraph boundaries)
      const summaryBreaks = matched
        .filter(a => a.markerType === "summary")
        .map(a => {
          const nextNl = fullText.indexOf("\n", a.endIndex);
          return nextNl !== -1 ? nextNl + 1 : fullText.length;
        });

      // Split text into slides (with summary-aware paragraph breaks)
      const splitSlides = splitText(fullText, genre, pptSettings, summaryBreaks);

      // Distribute matched annotations to slides
      const slidesWithAnnotations = distributeAnnotationsToSlides(fullText, splitSlides, matched);

      setSlides(slidesWithAnnotations);
      setCurrentSlideIndex(0);
      setStep("annotate");
    } catch (error) {
      alert(error instanceof Error ? error.message : "주석 추출 중 오류가 발생했습니다");
    } finally {
      setIsExtracting(false);
      setExtractionProgress("");
    }
  }, [pdfFile, fullText, genre, pptSettings]);

  // Mode A: Extract both text and annotations from PDF via server API
  const handleExtractAll = useCallback(async () => {
    if (!pdfFile) return;
    setIsExtracting(true);
    setExtractionProgress("추출 중...");
    setUnmatchedAnnotations([]);

    try {
      const formData = new FormData();
      formData.append("pdf", pdfFile);
      formData.append("mode", "A");
      formData.append("genre", genre);

      const response = await fetch("/api/extract", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "추출 실패" }));
        throw new Error(err.error);
      }
      const result = await response.json();

      setFullText(result.text);

      // Store extracted annotations temporarily — user reviews text first, then splits
      if (result.annotations.length > 0) {
        // Auto-proceed: match, split, distribute
        const { matched, unmatched } = matchAnnotationsToText(result.text, result.annotations);
        if (unmatched.length > 0) {
          setUnmatchedAnnotations(unmatched);
        }

        // Compute forced break points for summary annotations
        const summaryBreaks = matched
          .filter(a => a.markerType === "summary")
          .map(a => {
            const nextNl = result.text.indexOf("\n", a.endIndex);
            return nextNl !== -1 ? nextNl + 1 : result.text.length;
          });

        const splitSlides = splitText(result.text, genre, pptSettings, summaryBreaks);
        const slidesWithAnnotations = distributeAnnotationsToSlides(result.text, splitSlides, matched);

        setSlides(slidesWithAnnotations);
        setCurrentSlideIndex(0);
        setStep("annotate");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "PDF 추출 중 오류가 발생했습니다");
    } finally {
      setIsExtracting(false);
      setExtractionProgress("");
    }
  }, [pdfFile, genre, pptSettings]);

  const handleUpdateSlide = useCallback(
    (updatedSlide: SlideData) => {
      setSlides((prev) =>
        prev.map((s) => (s.id === updatedSlide.id ? updatedSlide : s))
      );
    },
    []
  );

  const handleSplitAt = useCallback(
    (charIndex: number) => {
      setSlides((prev) => {
        const newSlides = splitSlideAt(prev, currentSlideIndex, charIndex);
        return newSlides;
      });
    },
    [currentSlideIndex]
  );

  const handleMergeNext = useCallback(() => {
    setSlides((prev) => {
      const merged = mergeSlides(prev, currentSlideIndex);
      return merged;
    });
  }, [currentSlideIndex]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, fullText, slides, settings: pptSettings }),
      });

      if (!response.ok) {
        throw new Error("PPT 생성에 실패했습니다");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `수업자료_${genre === "poetry" ? "운문" : "산문"}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("PPT 파일이 다운로드되었습니다");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "PPT 생성 중 오류가 발생했습니다"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [genre, fullText, slides]);

  const handleCutAnnotation = useCallback((annotation: Annotation) => {
    setClipboardAnnotation(annotation);
    setSlides((prev) =>
      prev.map((s) =>
        s.id === slides[currentSlideIndex]?.id
          ? { ...s, annotations: s.annotations.filter((a) => a.id !== annotation.id) }
          : s
      )
    );
  }, [slides, currentSlideIndex]);

  const handlePasteAnnotation = useCallback(
    (startIndex: number, endIndex: number, targetText: string) => {
      if (!clipboardAnnotation) return;
      const cs = slides[currentSlideIndex];
      if (!cs) return;

      const nextOrder = cs.annotations.length > 0
        ? Math.max(...cs.annotations.map((a) => a.order)) + 1
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
          s.id === cs.id
            ? { ...s, annotations: [...s.annotations, newAnn] }
            : s
        )
      );
      setClipboardAnnotation(null);
    },
    [clipboardAnnotation, slides, currentSlideIndex]
  );

  const handleCancelPaste = useCallback(() => {
    setClipboardAnnotation(null);
  }, []);

  const handleAddUnmatched = useCallback(
    (startIndex: number, endIndex: number, targetText: string) => {
      if (!pendingUnmatched) return;
      const cs = slides[currentSlideIndex];
      if (!cs) return;

      const nextOrder = cs.annotations.length > 0
        ? Math.max(...cs.annotations.map((a) => a.order)) + 1
        : 1;

      const newAnn: Annotation = {
        id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
        startIndex,
        endIndex,
        targetText,
        content: pendingUnmatched.content,
        markerType: pendingUnmatched.markerType,
        order: nextOrder,
        color: "#294C67",
      };

      setSlides((prev) =>
        prev.map((s) =>
          s.id === cs.id
            ? { ...s, annotations: [...s.annotations, newAnn] }
            : s
        )
      );
      // Remove from unmatched list
      setUnmatchedAnnotations((prev) =>
        prev.filter((ua) => ua !== pendingUnmatched)
      );
      setPendingUnmatched(null);
    },
    [pendingUnmatched, slides, currentSlideIndex]
  );

  const handleCancelUnmatched = useCallback(() => {
    setPendingUnmatched(null);
  }, []);

  const currentSlide = slides[currentSlideIndex];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#CADCFC] bg-[#1E2761] px-6 py-3">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-[#CADCFC] transition-colors hover:text-white"
        >
          &larr; 처음으로
        </button>
        <h1 className="text-lg font-semibold text-white">
          국어 수업 PPT 생성기
        </h1>
        <span className="rounded-full bg-[#CADCFC]/20 px-3 py-1 text-sm text-[#CADCFC]">
          {GENRE_LABELS[genre]}
        </span>
      </header>

      {/* Step: Input */}
      {step === "input" && (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
            <div>
              <h2 className="mb-2 text-2xl font-bold text-[#1E2761]">
                텍스트 입력
              </h2>
              <p className="text-sm text-[#1E2761]/60">
                {genre === "poetry"
                  ? "텍스트를 입력하세요. 연/단락 사이는 빈 줄로 구분합니다."
                  : "텍스트를 입력하세요. 적정 분량으로 자동 분할됩니다."}
              </p>
            </div>

            {/* Mode Selector */}
            <ModeSelector
              mode={inputMode}
              onChange={setInputMode}
              hasApiKey={true}
            />

            {/* Mode B: Text only */}
            {inputMode === "B" && (
              <>
                <textarea
                  value={fullText}
                  onChange={(e) => setFullText(e.target.value)}
                  placeholder={
                    genre === "poetry"
                      ? "교과서 본문을 붙여넣으세요...\n\n연/단락 사이에 빈 줄을 넣어주세요."
                      : "교과서 본문을 붙여넣으세요..."
                  }
                  className="min-h-[400px] w-full flex-1 resize-y rounded-xl border border-[#CADCFC]/60 bg-white p-5 text-base leading-relaxed text-[#1E2761] placeholder-[#1E2761]/50 outline-none shadow-inner transition-all hover:border-[#CADCFC] focus:border-[#1E2761] focus:ring-1 focus:ring-[#1E2761]"
                />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#1E2761]/60">
                    {fullText.length > 0
                      ? `${fullText.length}자 / ${fullText.split("\n").length}줄`
                      : ""}
                  </span>
                  <button
                    onClick={handleSplit}
                    disabled={!fullText.trim()}
                    className="rounded-xl bg-[#1E2761] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1E2761]/95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    슬라이드 분할
                  </button>
                </div>
              </>
            )}

            {/* Mode C: Text + PDF annotations */}
            {inputMode === "C" && (
              <>
                <textarea
                  value={fullText}
                  onChange={(e) => setFullText(e.target.value)}
                  placeholder={
                    genre === "poetry"
                      ? "교과서 본문을 붙여넣으세요...\n\n연/단락 사이에 빈 줄을 넣어주세요."
                      : "교과서 본문을 붙여넣으세요..."
                  }
                  className="min-h-[300px] w-full resize-y rounded-xl border border-[#CADCFC]/60 bg-white p-5 text-base leading-relaxed text-[#1E2761] placeholder-[#1E2761]/50 outline-none shadow-inner transition-all hover:border-[#CADCFC] focus:border-[#1E2761] focus:ring-1 focus:ring-[#1E2761]"
                />

                <div className="flex flex-col gap-3">
                  <label className="text-sm font-medium text-[#1E2761]">
                    교사용 교과서 PDF 업로드
                  </label>
                  <PdfUploader file={pdfFile} onFileChange={setPdfFile} />
                </div>


                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#1E2761]/60">
                    {fullText.length > 0
                      ? `${fullText.length}자 / ${fullText.split("\n").length}줄`
                      : ""}
                  </span>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSplit}
                      disabled={!fullText.trim()}
                      className="rounded-xl border border-[#1E2761]/40 px-6 py-3 text-base font-semibold text-[#1E2761] transition-all hover:-translate-y-0.5 hover:border-[#1E2761] hover:bg-[#1E2761]/5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      주석 없이 분할
                    </button>
                    <button
                      onClick={handleExtractAnnotations}
                      disabled={!fullText.trim() || !pdfFile || isExtracting}
                      className="rounded-xl bg-[#1E2761] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1E2761]/95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isExtracting ? "추출 중..." : "주석 추출 + 분할"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Mode A: Full PDF extraction */}
            {inputMode === "A" && (
              <>
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-medium text-[#1E2761]">
                    교사용 교과서 PDF 업로드
                  </label>
                  <PdfUploader file={pdfFile} onFileChange={setPdfFile} />
                </div>


                {fullText && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#1E2761]">
                        추출된 텍스트 (확인/수정 후 분할하세요)
                      </label>
                      <textarea
                        value={fullText}
                        onChange={(e) => setFullText(e.target.value)}
                        className="min-h-[300px] w-full resize-y rounded-xl border border-[#CADCFC]/60 bg-white p-5 text-base leading-relaxed text-[#1E2761] outline-none shadow-inner transition-all hover:border-[#CADCFC] focus:border-[#1E2761] focus:ring-1 focus:ring-[#1E2761]"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#1E2761]/60">
                        {`${fullText.length}자 / ${fullText.split("\n").length}줄`}
                      </span>
                      <button
                        onClick={handleSplit}
                        disabled={!fullText.trim()}
                        className="rounded-xl bg-[#1E2761] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1E2761]/95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        슬라이드 분할
                      </button>
                    </div>
                  </>
                )}

                {!fullText && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleExtractAll}
                      disabled={!pdfFile || isExtracting}
                      className="rounded-xl bg-[#1E2761] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1E2761]/95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isExtracting ? "추출 중..." : "텍스트 & 주석 추출"}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Extraction progress overlay */}
            {isExtracting && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-10 py-8 shadow-xl">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#CADCFC] border-t-[#1E2761]" />
                  <p className="text-sm font-medium text-[#1E2761]">
                    {extractionProgress || "처리 중..."}
                  </p>
                </div>
              </div>
            )}

            {/* Unmatched annotations warning */}
            {unmatchedAnnotations.length > 0 && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                <p className="mb-2 text-sm font-semibold text-amber-800">
                  매칭되지 않은 주석 {unmatchedAnnotations.length}개
                </p>
                <p className="mb-3 text-xs text-amber-700">
                  원문에서 해당 텍스트를 찾지 못했습니다. 슬라이드 편집에서 수동으로 추가해주세요.
                </p>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {unmatchedAnnotations.map((ua, i) => (
                    <div key={i} className="rounded bg-white px-3 py-2 text-xs text-amber-900">
                      <span className="font-medium">&ldquo;{ua.targetText}&rdquo;</span>
                      <span className="text-amber-600"> → {ua.content}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setUnmatchedAnnotations([])}
                  className="mt-3 text-xs text-amber-600 hover:text-amber-800"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step: Annotate */}
      {step === "annotate" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar: slide list */}
          <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[#CADCFC] bg-[#CADCFC]/10">
            <div className="border-b border-[#CADCFC] px-4 py-3">
              <h3 className="text-sm font-semibold text-[#1E2761]">
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
                    onClick={() => setCurrentSlideIndex(index)}
                    className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left mb-1 transition-all ${isActive
                      ? "bg-white text-[#1E2761] shadow-sm ring-1 ring-[#CADCFC]/60 border-l-4 border-l-[#1E2761]"
                      : "text-[#1E2761] hover:bg-[#CADCFC]/30"
                      }`}
                  >
                    <span className="text-xs font-semibold">
                      슬라이드 {index + 1}
                    </span>
                    <span
                      className={`truncate text-xs ${isActive ? "text-[#1E2761]/70" : "text-[#1E2761]/50"
                        }`}
                    >
                      {firstLine}
                      {firstLine.length >= 30 ? "..." : ""}
                    </span>
                    {slide.annotations.length > 0 && (
                      <span
                        className={`text-xs ${isActive ? "font-medium text-[#1E2761]" : "text-[#1E2761]/60"
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
                        onClick={() => setPendingUnmatched(ua)}
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
            <div className="border-t border-[#CADCFC] p-4">
              <button
                onClick={() => {
                  setStep("input");
                  setSlides([]);
                  setCurrentSlideIndex(0);
                  setUnmatchedAnnotations([]);
                }}
                className="mb-2 w-full rounded-lg border border-[#CADCFC] px-3 py-2 text-xs text-[#1E2761] transition-colors hover:bg-[#CADCFC]/20"
              >
                텍스트 다시 입력
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mb-2 w-full rounded-lg bg-[#1E2761] px-3 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1E2761]/95 hover:shadow-md disabled:opacity-40"
              >
                {isGenerating ? "생성 중..." : "PPT 생성"}
              </button>
            </div>
          </aside>

          {/* Main content: annotation editor */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {currentSlide ? (
              <>
                {/* Slide navigation */}
                <div className="flex items-center justify-between border-b border-[#CADCFC] bg-white px-6 py-3">
                  <button
                    onClick={() =>
                      setCurrentSlideIndex((prev) => Math.max(0, prev - 1))
                    }
                    disabled={currentSlideIndex === 0}
                    className="rounded-lg px-3 py-1 text-sm text-[#1E2761] transition-colors hover:bg-[#CADCFC]/30 disabled:opacity-30"
                  >
                    &larr; 이전
                  </button>
                  <span className="text-sm font-medium text-[#1E2761]">
                    슬라이드 {currentSlideIndex + 1} / {slides.length}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentSlideIndex((prev) =>
                        Math.min(slides.length - 1, prev + 1)
                      )
                    }
                    disabled={currentSlideIndex === slides.length - 1}
                    className="rounded-lg px-3 py-1 text-sm text-[#1E2761] transition-colors hover:bg-[#CADCFC]/30 disabled:opacity-30"
                  >
                    다음 &rarr;
                  </button>
                </div>

                {/* Font/size/spacing settings */}
                <div className="flex items-center gap-4 border-b border-[#CADCFC]/50 bg-[#CADCFC]/5 px-6 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#1E2761]/50">폰트</span>
                    <select
                      value={pptSettings.fontFamily}
                      onChange={(e) => setPptSettings((s) => ({ ...s, fontFamily: e.target.value }))}
                      className="rounded border border-[#CADCFC] px-2 py-0.5 text-xs text-[#1E2761] outline-none"
                    >
                      {SUPPORTED_FONTS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#1E2761]/50">크기</span>
                    <button
                      onClick={() => setPptSettings((s) => ({ ...s, fontSize: Math.max(16, s.fontSize - 2) }))}
                      className="rounded border border-[#CADCFC] px-1.5 py-0.5 text-xs text-[#1E2761] hover:bg-[#CADCFC]/20"
                    >-</button>
                    <span className="min-w-[32px] text-center text-xs font-medium text-[#1E2761]">{pptSettings.fontSize}pt</span>
                    <button
                      onClick={() => setPptSettings((s) => ({ ...s, fontSize: Math.min(48, s.fontSize + 2) }))}
                      className="rounded border border-[#CADCFC] px-1.5 py-0.5 text-xs text-[#1E2761] hover:bg-[#CADCFC]/20"
                    >+</button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#1E2761]/50">줄간격</span>
                    <button
                      onClick={() => setPptSettings((s) => ({ ...s, lineSpacing: Math.max(1.2, Math.round((s.lineSpacing - 0.1) * 10) / 10) }))}
                      className="rounded border border-[#CADCFC] px-1.5 py-0.5 text-xs text-[#1E2761] hover:bg-[#CADCFC]/20"
                    >-</button>
                    <span className="min-w-[28px] text-center text-xs font-medium text-[#1E2761]">{pptSettings.lineSpacing}</span>
                    <button
                      onClick={() => setPptSettings((s) => ({ ...s, lineSpacing: Math.min(3.0, Math.round((s.lineSpacing + 0.1) * 10) / 10) }))}
                      className="rounded border border-[#CADCFC] px-1.5 py-0.5 text-xs text-[#1E2761] hover:bg-[#CADCFC]/20"
                    >+</button>
                  </div>
                </div>

                {/* Annotation editor */}
                <div className="min-h-0 flex-1">
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
                    onCancelPaste={handleCancelPaste}
                    pendingUnmatched={pendingUnmatched}
                    onAddUnmatched={handleAddUnmatched}
                    onCancelUnmatched={handleCancelUnmatched}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-[#1E2761]/60">
                슬라이드가 없습니다
              </div>
            )}
          </main>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#1E2761] px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all">
          {toast}
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
          <span className="text-[#1E2761]/60">로딩 중...</span>
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
