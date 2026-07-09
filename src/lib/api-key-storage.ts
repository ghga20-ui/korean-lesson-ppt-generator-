/**
 * BYOK 키/모델 보관 유틸.
 * 키는 이 브라우저의 localStorage에만 저장되며 서버로 전송되지 않는다.
 */
import { DEFAULT_MODEL_ID } from "./gemini-models";

const KEY_STORAGE = "lit-ppt-gemini-key";
const MODEL_STORAGE = "lit-ppt-gemini-model";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getApiKey(storage: StorageLike | null = defaultStorage()): string {
  try { return storage?.getItem(KEY_STORAGE)?.trim() ?? ""; } catch { return ""; }
}

export function setApiKey(key: string, storage: StorageLike | null = defaultStorage()): void {
  try { storage?.setItem(KEY_STORAGE, key.trim()); } catch { /* storage full — ignore */ }
}

export function clearApiKey(storage: StorageLike | null = defaultStorage()): void {
  try { storage?.removeItem(KEY_STORAGE); } catch { /* ignore */ }
}

export function getModelId(storage: StorageLike | null = defaultStorage()): string {
  try { return storage?.getItem(MODEL_STORAGE) ?? DEFAULT_MODEL_ID; } catch { return DEFAULT_MODEL_ID; }
}

export function setModelId(id: string, storage: StorageLike | null = defaultStorage()): void {
  try { storage?.setItem(MODEL_STORAGE, id); } catch { /* ignore */ }
}

/** 가벼운 모델 목록 조회로 키 유효성을 검사한다. */
export async function validateApiKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1`,
    );
    return res.ok;
  } catch {
    return false;
  }
}
