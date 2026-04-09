"use client";

import { useCallback, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FileUp, Scissors, Check, X } from "lucide-react";

interface PdfUploaderProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const MAX_RAW_SIZE = 200 * 1024 * 1024; // 200MB for raw upload (before extraction)

export default function PdfUploader({ file, onFileChange }: PdfUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  // Raw PDF state (before page extraction)
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pageRange, setPageRange] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState("");

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  /** Parse page range string like "15-18" or "3,5,7-10" into 0-based page indices */
  function parsePageRange(input: string, max: number): number[] | null {
    const pages = new Set<number>();
    const parts = input.split(",").map((s) => s.trim()).filter(Boolean);

    for (const part of parts) {
      const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (start < 1 || end > max || start > end) return null;
        for (let i = start; i <= end; i++) pages.add(i - 1); // 0-based
      } else {
        const num = parseInt(part, 10);
        if (isNaN(num) || num < 1 || num > max) return null;
        pages.add(num - 1);
      }
    }

    return pages.size > 0 ? [...pages].sort((a, b) => a - b) : null;
  }

  const handleRawFile = useCallback(async (f: File) => {
    setError("");
    setExtractedInfo("");
    onFileChange(null);

    if (f.type !== "application/pdf") {
      setError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (f.size > MAX_RAW_SIZE) {
      setError("파일 크기가 200MB를 초과합니다.");
      return;
    }

    try {
      const arrayBuffer = await f.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const count = pdf.getPageCount();
      setRawFile(f);
      setTotalPages(count);
      setPageRange("");
    } catch {
      setError("PDF 파일을 읽을 수 없습니다.");
    }
  }, [onFileChange]);

  const handleExtractPages = useCallback(async () => {
    if (!rawFile || !pageRange.trim()) return;

    const indices = parsePageRange(pageRange, totalPages);
    if (!indices) {
      setError(`유효하지 않은 페이지 범위입니다. (1~${totalPages})`);
      return;
    }

    setIsExtracting(true);
    setError("");

    try {
      const arrayBuffer = await rawFile.arrayBuffer();
      const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcPdf, indices);
      copiedPages.forEach((page) => newPdf.addPage(page));
      const pdfBytes = await newPdf.save();

      const extractedFile = new File(
        [new Uint8Array(pdfBytes) as BlobPart],
        rawFile.name.replace(".pdf", `_p${pageRange.replace(/\s/g, "")}.pdf`),
        { type: "application/pdf" }
      );

      setExtractedInfo(`${indices.length}페이지 추출 완료 (${formatSize(pdfBytes.length)})`);
      onFileChange(extractedFile);
    } catch {
      setError("페이지 추출에 실패했습니다.");
    } finally {
      setIsExtracting(false);
    }
  }, [rawFile, pageRange, totalPages, onFileChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleRawFile(f);
    },
    [handleRawFile]
  );

  const handleReset = useCallback(() => {
    setRawFile(null);
    setTotalPages(0);
    setPageRange("");
    setExtractedInfo("");
    setError("");
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [onFileChange]);

  // Step 2: Raw file uploaded, show page extraction UI
  if (rawFile) {
    return (
      <div className="rounded-xl border-2 border-[#EEDDD0] bg-[#EEDDD0]/5 p-4">
        {/* File info */}
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#6B3F26]/10 text-xs font-bold text-[#6B3F26]">
            PDF
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#6B3F26]">{rawFile.name}</p>
            <p className="text-xs text-[#6B3F26]/50">
              {formatSize(rawFile.size)} · {totalPages}페이지
            </p>
          </div>
          <button
            onClick={handleReset}
            className="rounded-lg p-1 text-[#6B3F26]/50 hover:bg-red-50 hover:text-red-500"
            title="삭제"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Page range input */}
        <p className="mb-2 text-xs text-[#6B3F26]/60">
          작품 본문이 수록된 페이지 번호를 정확히 입력하세요. 해당 페이지만 추출하여 주석을 인식합니다.
        </p>
        <div className="flex items-center gap-2">
          <label className="flex-shrink-0 text-xs font-medium text-[#6B3F26]">
            페이지 범위
          </label>
          <input
            type="text"
            value={pageRange}
            onChange={(e) => { setPageRange(e.target.value); setError(""); setExtractedInfo(""); }}
            placeholder={`예: 15-18 (1-${totalPages})`}
            className="min-w-0 flex-1 rounded-lg border border-[#EEDDD0] px-3 py-1.5 text-xs text-[#6B3F26] placeholder-[#6B3F26]/40 outline-none focus:border-[#6B3F26]"
            onKeyDown={(e) => { if (e.key === "Enter") handleExtractPages(); }}
          />
          <button
            onClick={handleExtractPages}
            disabled={!pageRange.trim() || isExtracting}
            className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-[#6B3F26] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#6B3F26]/90 disabled:opacity-40"
          >
            <Scissors className="h-3 w-3" />
            {isExtracting ? "추출 중..." : "추출"}
          </button>
        </div>

        {/* Status */}
        {extractedInfo && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
            <Check className="h-3.5 w-3.5" />
            {extractedInfo}
          </div>
        )}
        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }

  // Step 1: No file yet, show upload area
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
          isDragging
            ? "border-[#6B3F26] bg-[#EEDDD0]/20"
            : "border-[#EEDDD0] hover:border-[#6B3F26]/50 hover:bg-[#EEDDD0]/10"
        }`}
      >
        <FileUp className="h-6 w-6 text-[#6B3F26]/40" />
        <p className="text-sm text-[#6B3F26]/60">
          교과서 PDF를 드래그하거나 클릭하여 업로드
        </p>
        <p className="text-xs text-[#6B3F26]/40">업로드 후 필요한 페이지만 추출합니다</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRawFile(f); }}
        className="hidden"
      />
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
