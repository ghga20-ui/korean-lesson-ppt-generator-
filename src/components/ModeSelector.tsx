"use client";

import type { InputMode } from "@/lib/types";
import { Star } from "lucide-react";

interface ModeSelectorProps {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
  hasApiKey: boolean;
}

// 키가 필요 없는 경로(B)를 첫 번째·추천으로 — 첫 방문자가 키 요구 없이 바로 시작한다.
const MODES: { value: InputMode; label: string; desc: string; recommended?: boolean }[] = [
  { value: "B", label: "직접 입력", desc: "(추천) 본문을 붙여넣어 바로 시작 — 키 불필요", recommended: true },
  { value: "C", label: "텍스트 + PDF 주석", desc: "텍스트 입력 후 PDF에서 주석 가져오기" },
  { value: "A", label: "PDF 전체 추출", desc: "PDF에서 본문과 주석 모두 가져오기" },
];

export default function ModeSelector({ mode, onChange, hasApiKey }: ModeSelectorProps) {
  return (
    <div className="flex gap-1 rounded-xl bg-[#EDEAE3] p-1">
      {MODES.map((m) => {
        const isActive = mode === m.value;
        const needsKey = m.value !== "B" && !hasApiKey;
        return (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            className={`relative flex-1 rounded-lg px-3 py-2 text-center text-sm transition-all ${
              isActive
                ? "bg-[#E8EFF5] font-semibold text-[#16202B] shadow-sm ring-1 ring-[#C9D6E2]"
                : m.recommended
                  ? "border border-[#294C67]/20 text-[#16202B] hover:bg-white/50"
                  : "text-[#5B6470] hover:bg-white/50"
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
                isActive ? "text-[#5B6470]" : "text-[#5B6470]"
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
