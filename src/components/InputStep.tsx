"use client";

import type { Genre, InputMode, ExtractedAnnotation, PptSettings } from "@/lib/types";
import ModeSelector from "@/components/ModeSelector";
import PdfUploader from "@/components/PdfUploader";

interface InputStepProps {
  genre: Genre;
  inputMode: InputMode;
  onInputModeChange: (mode: InputMode) => void;
  fullText: string;
  onFullTextChange: (text: string) => void;
  pdfFile: File | null;
  onPdfFileChange: (file: File | null) => void;
  isExtracting: boolean;
  extractionProgress: string;
  unmatchedAnnotations: ExtractedAnnotation[];
  onDismissUnmatched: () => void;
  onSplit: () => void;
  onExtractAnnotations: () => Promise<void>;
  onExtractAll: () => Promise<void>;
}

export default function InputStep({
  genre,
  inputMode,
  onInputModeChange,
  fullText,
  onFullTextChange,
  pdfFile,
  onPdfFileChange,
  isExtracting,
  extractionProgress,
  unmatchedAnnotations,
  onDismissUnmatched,
  onSplit,
  onExtractAnnotations,
  onExtractAll,
}: InputStepProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <div>
          <h2 className="mb-2 text-2xl font-bold text-[#6B3F26]">
            텍스트 입력
          </h2>
          <p className="text-sm text-[#6B3F26]/60">
            {genre === "poetry"
              ? "텍스트를 입력하세요. 연/단락 사이는 빈 줄로 구분합니다."
              : "텍스트를 입력하세요. 적정 분량으로 자동 분할됩니다."}
          </p>
        </div>

        {/* Mode Selector */}
        <ModeSelector
          mode={inputMode}
          onChange={onInputModeChange}
          hasApiKey={true}
        />

        {/* Mode B: Text only */}
        {inputMode === "B" && (
          <>
            <textarea
              value={fullText}
              onChange={(e) => onFullTextChange(e.target.value)}
              placeholder={
                genre === "poetry"
                  ? "교과서 본문을 붙여넣으세요...\n\n연/단락 사이에 빈 줄을 넣어주세요."
                  : "교과서 본문을 붙여넣으세요..."
              }
              className="min-h-[400px] w-full flex-1 resize-y rounded-xl border border-[#EEDDD0]/60 bg-white p-5 text-base leading-relaxed text-[#6B3F26] placeholder-[#6B3F26]/50 outline-none shadow-inner transition-all hover:border-[#EEDDD0] focus:border-[#6B3F26] focus:ring-1 focus:ring-[#6B3F26]"
            />

            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6B3F26]/60">
                {fullText.length > 0
                  ? `${fullText.length}자 / ${fullText.split("\n").length}줄`
                  : ""}
              </span>
              <button
                onClick={onSplit}
                disabled={!fullText.trim()}
                className="rounded-xl bg-[#6B3F26] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#6B3F26]/95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
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
              onChange={(e) => onFullTextChange(e.target.value)}
              placeholder={
                genre === "poetry"
                  ? "교과서 본문을 붙여넣으세요...\n\n연/단락 사이에 빈 줄을 넣어주세요."
                  : "교과서 본문을 붙여넣으세요..."
              }
              className="min-h-[300px] w-full resize-y rounded-xl border border-[#EEDDD0]/60 bg-white p-5 text-base leading-relaxed text-[#6B3F26] placeholder-[#6B3F26]/50 outline-none shadow-inner transition-all hover:border-[#EEDDD0] focus:border-[#6B3F26] focus:ring-1 focus:ring-[#6B3F26]"
            />

            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-[#6B3F26]">
                교사용 교과서 PDF 업로드
              </label>
              <PdfUploader file={pdfFile} onFileChange={onPdfFileChange} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6B3F26]/60">
                {fullText.length > 0
                  ? `${fullText.length}자 / ${fullText.split("\n").length}줄`
                  : ""}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={onSplit}
                  disabled={!fullText.trim()}
                  className="rounded-xl border border-[#6B3F26]/40 px-6 py-3 text-base font-semibold text-[#6B3F26] transition-all hover:-translate-y-0.5 hover:border-[#6B3F26] hover:bg-[#6B3F26]/5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  주석 없이 분할
                </button>
                <button
                  onClick={onExtractAnnotations}
                  disabled={!fullText.trim() || !pdfFile || isExtracting}
                  className="rounded-xl bg-[#6B3F26] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#6B3F26]/95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
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
              <label className="text-sm font-medium text-[#6B3F26]">
                교사용 교과서 PDF 업로드
              </label>
              <PdfUploader file={pdfFile} onFileChange={onPdfFileChange} />
            </div>

            {fullText && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#6B3F26]">
                    추출된 텍스트 (확인/수정 후 분할하세요)
                  </label>
                  <textarea
                    value={fullText}
                    onChange={(e) => onFullTextChange(e.target.value)}
                    className="min-h-[300px] w-full resize-y rounded-xl border border-[#EEDDD0]/60 bg-white p-5 text-base leading-relaxed text-[#6B3F26] outline-none shadow-inner transition-all hover:border-[#EEDDD0] focus:border-[#6B3F26] focus:ring-1 focus:ring-[#6B3F26]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B3F26]/60">
                    {`${fullText.length}자 / ${fullText.split("\n").length}줄`}
                  </span>
                  <button
                    onClick={onSplit}
                    disabled={!fullText.trim()}
                    className="rounded-xl bg-[#6B3F26] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#6B3F26]/95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    슬라이드 분할
                  </button>
                </div>
              </>
            )}

            {!fullText && (
              <div className="flex justify-end">
                <button
                  onClick={onExtractAll}
                  disabled={!pdfFile || isExtracting}
                  className="rounded-xl bg-[#6B3F26] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#6B3F26]/95 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
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
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#EEDDD0] border-t-[#6B3F26]" />
              <p className="text-sm font-medium text-[#6B3F26]">
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
              onClick={onDismissUnmatched}
              className="mt-3 text-xs text-amber-600 hover:text-amber-800"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
