"use client";

import type { InputMode } from "@/lib/types";
import { Star } from "lucide-react";

interface ModeSelectorProps {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
  hasApiKey: boolean;
}

const MODES: { value: InputMode; label: string; desc: string; recommended?: boolean }[] = [
  { value: "C", label: "텍스트 + PDF 주석", desc: "텍스트 입력 후 PDF에서 주석 추출", recommended: true },
  { value: "A", label: "PDF 전체 추출", desc: "PDF에서 텍스트와 주석 모두 추출" },
  { value: "B", label: "직접 입력", desc: "텍스트와 주석을 수동으로 입력" },
];

export default function ModeSelector({ mode, onChange, hasApiKey }: ModeSelectorProps) {
  return (
    <div className="flex gap-1 rounded-xl bg-[#CADCFC]/30 p-1">
      {MODES.map((m) => {
        const isActive = mode === m.value;
        const needsKey = m.value !== "B" && !hasApiKey;
        return (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            className={`relative flex-1 rounded-lg px-3 py-2 text-center text-sm transition-all ${
              isActive
                ? "bg-white font-semibold text-[#1E2761] shadow-sm ring-1 ring-[#CADCFC]/50"
                : m.recommended
                  ? "border border-[#1E2761]/20 bg-white text-[#1E2761] hover:bg-[#CADCFC]/40"
                  : "text-[#1E2761]/70 hover:bg-[#CADCFC]/40"
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              {m.recommended && (
                <Star className={`h-3 w-3 ${isActive ? "text-amber-300" : "text-amber-500"}`} fill="currentColor" />
              )}
              {m.label}
            </div>
            <div
              className={`text-xs ${
                isActive ? "text-[#1E2761]/60" : "text-[#1E2761]/50"
              }`}
            >
              {m.desc}
            </div>
            {needsKey && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400" title="API 키 필요" />
            )}
          </button>
        );
      })}
    </div>
  );
}
