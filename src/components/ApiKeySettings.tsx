"use client";

import { useEffect, useState } from "react";
import { X, KeyRound, ExternalLink, Check, Trash2 } from "lucide-react";
import {
  getApiKey, setApiKey, clearApiKey,
  getModelId, setModelId, validateApiKey,
} from "@/lib/api-key-storage";
import { GEMINI_MODELS } from "@/lib/gemini-models";

interface ApiKeySettingsProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ApiKeySettings({ open, onClose, onSaved }: ApiKeySettingsProps) {
  const [keyInput, setKeyInput] = useState("");
  const [modelId, setModel] = useState(GEMINI_MODELS[0].id);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe read of localStorage must happen post-mount to avoid hydration mismatch
      setKeyInput(getApiKey());
      setModel(getModelId());
      setError("");
      setSaved(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    const key = keyInput.trim();
    if (!key) { setError("API 키를 입력해주세요."); return; }
    setIsValidating(true);
    setError("");
    const ok = await validateApiKey(key);
    setIsValidating(false);
    if (!ok) {
      setError("키가 유효하지 않습니다. Google AI Studio에서 발급한 키인지 확인해주세요.");
      return;
    }
    setApiKey(key);
    setModelId(modelId);
    setSaved(true);
    onSaved();
    setTimeout(onClose, 600);
  };

  const handleClear = () => {
    clearApiKey();
    setKeyInput("");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-[440px] max-w-[92vw] flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#6B3F26]">
            <KeyRound className="h-5 w-5" /> Gemini API 키 설정
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-[#6B3F26]/50 hover:bg-[#EEDDD0]/30">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 발급 가이드 */}
        <div className="rounded-xl bg-[#EEDDD0]/20 p-3 text-xs leading-relaxed text-[#6B3F26]/80">
          <p className="mb-1 font-semibold text-[#6B3F26]">무료 키 발급 방법 (1분)</p>
          <ol className="list-inside list-decimal space-y-0.5">
            <li>Google AI Studio에 구글 계정으로 로그인</li>
            <li>&ldquo;API 키 만들기&rdquo; 클릭</li>
            <li>생성된 키를 복사해 아래에 붙여넣기</li>
          </ol>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-medium text-[#6B3F26] underline"
          >
            Google AI Studio 열기 <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* 키 입력 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#6B3F26]">API 키</label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => { setKeyInput(e.target.value); setError(""); }}
            placeholder="AIza..."
            className="w-full rounded-lg border border-[#EEDDD0] px-3 py-2 text-sm text-[#6B3F26] outline-none focus:border-[#6B3F26]"
          />
        </div>

        {/* 모델 선택 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#6B3F26]">모델</label>
          <select
            value={modelId}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-[#EEDDD0] px-3 py-2 text-sm text-[#6B3F26] outline-none focus:border-[#6B3F26]"
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <p className="text-[11px] leading-relaxed text-[#6B3F26]/50">
          키는 이 브라우저에만 저장되며 저희 서버로 전송되지 않습니다.
          PDF와 키는 브라우저에서 Google로 직접 전송됩니다.
        </p>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex items-center justify-between">
          <button
            onClick={handleClear}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[#6B3F26]/50 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" /> 키 삭제
          </button>
          <button
            onClick={handleSave}
            disabled={isValidating}
            className="flex items-center gap-1.5 rounded-xl bg-[#6B3F26] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#6B3F26]/90 disabled:opacity-40"
          >
            {saved ? <><Check className="h-4 w-4" /> 저장됨</> : isValidating ? "키 확인 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
