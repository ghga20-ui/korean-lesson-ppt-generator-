import { describe, it, expect, vi } from "vitest";
import {
  getApiKey, setApiKey, clearApiKey,
  getModelId, setModelId, validateApiKey,
} from "./api-key-storage";
import { DEFAULT_MODEL_ID } from "./gemini-models";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("api-key-storage", () => {
  it("키 저장 전에는 빈 문자열", () => {
    expect(getApiKey(fakeStorage())).toBe("");
  });

  it("키 저장/조회/삭제 (공백 트림)", () => {
    const s = fakeStorage();
    setApiKey("  AIza-test  ", s);
    expect(getApiKey(s)).toBe("AIza-test");
    clearApiKey(s);
    expect(getApiKey(s)).toBe("");
  });

  it("모델 미설정 시 기본 모델", () => {
    expect(getModelId(fakeStorage())).toBe(DEFAULT_MODEL_ID);
  });

  it("모델 저장/조회", () => {
    const s = fakeStorage();
    setModelId("gemini-3.1-pro-preview", s);
    expect(getModelId(s)).toBe("gemini-3.1-pro-preview");
  });

  it("validateApiKey: 200이면 true", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    expect(await validateApiKey("k", fetchImpl)).toBe(true);
  });

  it("validateApiKey: 400이면 false", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await validateApiKey("bad", fetchImpl)).toBe(false);
  });

  it("validateApiKey: 네트워크 오류면 false", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("net")) as unknown as typeof fetch;
    expect(await validateApiKey("k", fetchImpl)).toBe(false);
  });
});
