"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import type { Genre, InputMode, ExtractedAnnotation, PptSettings } from "@/lib/types";
import ModeSelector from "@/components/ModeSelector";
import PdfUploader from "@/components/PdfUploader";
import ApiKeySettings from "@/components/ApiKeySettings";
import { getApiKey } from "@/lib/api-key-storage";

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
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isKeySettingsOpen, setIsKeySettingsOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe read of localStorage must happen post-mount to avoid hydration mismatch
    setHasApiKey(!!getApiKey());
  }, []);

  // 첫 진입 기본 모드를 키가 필요 없는 "직접 입력"(B)으로 재배치.
  // 초기값 "C"는 useEditorState(수정 범위 밖)에서 내려오므로, 본문·PDF가 전혀 없는
  // 최초 상태에서만 마운트 시 1회 보정한다 — 이미 작업 중인 상태는 건드리지 않는다.
  useEffect(() => {
    if (!fullText && !pdfFile) {
      onInputModeChange("B");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만 기본 모드 보정
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <div>
          <h2 className="mb-2 text-2xl font-bold text-[#16202B]">
            텍스트 입력
          </h2>
          <p className="text-sm text-[#5B6470]">
            {genre === "poetry"
              ? "텍스트를 입력하세요. 연/단락 사이는 빈 줄로 구분합니다."
              : "텍스트를 입력하세요. 적정 분량으로 자동 분할됩니다."}
          </p>
        </div>

        {/* Mode Selector */}
        <ModeSelector
          mode={inputMode}
          onChange={onInputModeChange}
          hasApiKey={hasApiKey}
        />

        {inputMode !== "B" && !hasApiKey && (
          <div className="flex items-center justify-between rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">
              PDF에서 주석을 가져오려면 본인의 Gemini 키가 필요합니다. 발급은 무료이고 1분이면 됩니다.
            </p>
            <button
              onClick={() => setIsKeySettingsOpen(true)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900"
            >
              <KeyRound className="h-3.5 w-3.5" /> 키 설정
            </button>
          </div>
        )}
        {inputMode !== "B" && hasApiKey && (
          <div className="flex justify-end">
            <button
              onClick={() => setIsKeySettingsOpen(true)}
              className="flex items-center gap-1 text-xs text-[#5B6470] hover:text-[#16202B]"
            >
              <KeyRound className="h-3 w-3" /> API 키 설정
            </button>
          </div>
        )}

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
              className="kor-text min-h-[400px] w-full flex-1 resize-y rounded-xl border border-[#E4E1DA]/60 bg-white p-5 text-base leading-relaxed text-[#16202B] placeholder-[#7C8492] outline-none shadow-inner transition-all hover:border-[#E4E1DA] focus:border-[#294C67] focus:ring-1 focus:ring-[#294C67]"
            />

            <div className="flex items-center justify-between">
              <span className="text-sm text-[#5B6470]">
                {fullText.length > 0
                  ? `${fullText.length}자 / ${fullText.split("\n").length}줄`
                  : ""}
              </span>
              <button
                onClick={onSplit}
                disabled={!fullText.trim()}
                className="rounded-xl bg-[#294C67] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#21405A] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
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
              className="kor-text min-h-[300px] w-full resize-y rounded-xl border border-[#E4E1DA]/60 bg-white p-5 text-base leading-relaxed text-[#16202B] placeholder-[#7C8492] outline-none shadow-inner transition-all hover:border-[#E4E1DA] focus:border-[#294C67] focus:ring-1 focus:ring-[#294C67]"
            />

            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-[#16202B]">
                교사용 교과서 PDF 업로드
              </label>
              <PdfUploader file={pdfFile} onFileChange={onPdfFileChange} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[#5B6470]">
                {fullText.length > 0
                  ? `${fullText.length}자 / ${fullText.split("\n").length}줄`
                  : ""}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={onSplit}
                  disabled={!fullText.trim()}
                  className="rounded-xl border border-[#294C67]/40 px-6 py-3 text-base font-semibold text-[#16202B] transition-all hover:-translate-y-0.5 hover:border-[#294C67] hover:bg-[#294C67]/5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  주석 없이 나누기
                </button>
                <button
                  onClick={onExtractAnnotations}
                  disabled={!fullText.trim() || !pdfFile || isExtracting || !hasApiKey}
                  className="rounded-xl bg-[#294C67] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#21405A] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isExtracting ? "추출 중..." : "PDF에서 주석 가져오기"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Mode A: Full PDF extraction */}
        {inputMode === "A" && (
          <>
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-[#16202B]">
                교사용 교과서 PDF 업로드
              </label>
              <PdfUploader file={pdfFile} onFileChange={onPdfFileChange} />
            </div>

            {fullText && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#16202B]">
                    추출된 텍스트 (확인/수정 후 분할하세요)
                  </label>
                  <textarea
                    value={fullText}
                    onChange={(e) => onFullTextChange(e.target.value)}
                    className="kor-text min-h-[300px] w-full resize-y rounded-xl border border-[#E4E1DA]/60 bg-white p-5 text-base leading-relaxed text-[#16202B] outline-none shadow-inner transition-all hover:border-[#E4E1DA] focus:border-[#294C67] focus:ring-1 focus:ring-[#294C67]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#5B6470]">
                    {`${fullText.length}자 / ${fullText.split("\n").length}줄`}
                  </span>
                  <button
                    onClick={onSplit}
                    disabled={!fullText.trim()}
                    className="rounded-xl bg-[#294C67] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#21405A] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    슬라이드로 나누기
                  </button>
                </div>
              </>
            )}

            {!fullText && (
              <div className="flex justify-end">
                <button
                  onClick={onExtractAll}
                  disabled={!pdfFile || isExtracting || !hasApiKey}
                  className="rounded-xl bg-[#294C67] px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#21405A] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isExtracting ? "추출 중..." : "PDF에서 본문·주석 가져오기"}
                </button>
              </div>
            )}
          </>
        )}

        {/* Extraction progress overlay */}
        {isExtracting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex w-72 flex-col items-center gap-5 rounded-2xl bg-white px-8 py-8 shadow-2xl">
              {/* Spinner */}
              <div className="relative flex h-14 w-14 items-center justify-center">
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-[#E4E1DA] border-t-[#294C67]" />
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="22" height="22" fill="#294C67" aria-hidden="true">
                  <path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/>
                </svg>
              </div>
              {/* Message */}
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-sm font-semibold text-[#16202B]">
                  {extractionProgress || "처리 중..."}
                </p>
                <p className="text-xs text-[#5B6470]">잠시만 기다려 주세요</p>
              </div>
              {/* Progress bar (indeterminate) */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#E4E1DA]">
                <div className="h-full w-1/3 animate-[progressSlide_1.4s_ease-in-out_infinite] rounded-full bg-[#294C67]" />
              </div>
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

      <ApiKeySettings
        open={isKeySettingsOpen}
        onClose={() => setIsKeySettingsOpen(false)}
        onSaved={() => setHasApiKey(!!getApiKey())}
      />
    </div>
  );
}
