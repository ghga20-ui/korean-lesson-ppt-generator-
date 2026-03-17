"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "gemini-api-key";

interface ApiKeyInputProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function ApiKeyInput({ apiKey, onApiKeyChange }: ApiKeyInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleSave = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      onApiKeyChange(trimmed);
    }
    setIsEditing(false);
    setInputValue("");
  }, [inputValue, onApiKeyChange]);

  const handleClear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    onApiKeyChange("");
    setIsEditing(false);
    setInputValue("");
  }, [onApiKeyChange]);

  if (apiKey && !isEditing) {
    return (
      <div className="flex items-center gap-2 rounded-xl border-2 border-[#CADCFC] bg-[#CADCFC]/10 px-4 py-2.5">
        <span className="text-sm text-[#1E2761]/60">Gemini API 키:</span>
        <span className="flex-1 text-sm font-mono text-[#1E2761]">
          {showKey ? apiKey : "●".repeat(Math.min(apiKey.length, 12))}
        </span>
        <button
          onClick={() => setShowKey(!showKey)}
          className="rounded px-2 py-0.5 text-xs text-[#1E2761]/50 transition-colors hover:bg-[#CADCFC]/30"
        >
          {showKey ? "숨김" : "보기"}
        </button>
        <button
          onClick={() => {
            setIsEditing(true);
            setInputValue(apiKey);
          }}
          className="rounded px-2 py-0.5 text-xs text-[#1E2761] transition-colors hover:bg-[#CADCFC]/30"
        >
          변경
        </button>
        <button
          onClick={handleClear}
          className="rounded px-2 py-0.5 text-xs text-red-500 transition-colors hover:bg-red-50"
        >
          삭제
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        type={showKey ? "text" : "password"}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
        }}
        placeholder="Gemini API 키를 입력하세요"
        className="flex-1 rounded-xl border-2 border-[#CADCFC] bg-white px-4 py-2.5 text-sm text-[#1E2761] placeholder-[#1E2761]/30 outline-none transition-colors focus:border-[#1E2761]"
      />
      <button
        onClick={() => setShowKey(!showKey)}
        className="rounded-lg px-3 py-2 text-xs text-[#1E2761]/50 transition-colors hover:bg-[#CADCFC]/20"
      >
        {showKey ? "숨김" : "보기"}
      </button>
      <button
        onClick={handleSave}
        disabled={!inputValue.trim()}
        className="rounded-xl bg-[#1E2761] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#1E2761]/90 disabled:opacity-40"
      >
        저장
      </button>
      {apiKey && (
        <button
          onClick={() => {
            setIsEditing(false);
            setInputValue("");
          }}
          className="rounded-lg px-3 py-2 text-xs text-[#1E2761]/50 transition-colors hover:bg-[#CADCFC]/20"
        >
          취소
        </button>
      )}
    </div>
  );
}
