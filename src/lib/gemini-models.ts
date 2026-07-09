/** Gemini 모델 선택지 — 여기 한 곳에서만 정의한다. */
export interface GeminiModelOption {
  id: string;
  label: string;
}

export const GEMINI_MODELS: GeminiModelOption[] = [
  { id: "gemini-flash-latest", label: "빠름 · 무료 키 권장 (Flash)" },
  { id: "gemini-3.1-pro-preview", label: "정밀 · 유료 키 권장 (Pro)" },
];

export const DEFAULT_MODEL_ID = GEMINI_MODELS[0].id;
