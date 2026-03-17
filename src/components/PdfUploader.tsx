"use client";

import { useCallback, useRef, useState } from "react";

interface PdfUploaderProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const MAX_SIZE = 30 * 1024 * 1024; // 30MB

export default function PdfUploader({ file, onFileChange }: PdfUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback(
    (f: File) => {
      setError("");
      if (f.type !== "application/pdf") {
        setError("PDF 파일만 업로드할 수 있습니다.");
        return;
      }
      if (f.size > MAX_SIZE) {
        setError("파일 크기가 30MB를 초과합니다.");
        return;
      }
      onFileChange(f);
    },
    [onFileChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-[#CADCFC] bg-[#CADCFC]/10 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E2761]/10 text-[#1E2761]">
          PDF
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-[#1E2761]">{file.name}</p>
          <p className="text-xs text-[#1E2761]/50">{formatSize(file.size)}</p>
        </div>
        <button
          onClick={() => {
            onFileChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="rounded-lg px-3 py-1 text-xs text-red-500 transition-colors hover:bg-red-50"
        >
          삭제
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
          isDragging
            ? "border-[#1E2761] bg-[#CADCFC]/20"
            : "border-[#CADCFC] hover:border-[#1E2761]/50 hover:bg-[#CADCFC]/10"
        }`}
      >
        <div className="text-2xl text-[#1E2761]/40">+</div>
        <p className="text-sm text-[#1E2761]/60">
          PDF 파일을 드래그하거나 클릭하여 업로드
        </p>
        <p className="text-xs text-[#1E2761]/40">최대 30MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleInputChange}
        className="hidden"
      />
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
