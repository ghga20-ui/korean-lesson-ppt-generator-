import { describe, it, expect, vi } from "vitest";
import { extractFromPdfClient, INLINE_MAX_BYTES } from "./gemini-client";

/** Gemini generateContent 성공 응답 목 생성 */
function geminiOk(payload: object) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  };
}

function smallPdf(): File {
  return new File([new Uint8Array(100)], "t.pdf", { type: "application/pdf" });
}

const OPTS = {
  mode: "C" as const,
  genre: "poetry" as const,
  userText: "나 보기가 역겨워 가실 때에는",
  apiKey: "test-key",
  model: "gemini-flash-latest",
};

describe("extractFromPdfClient", () => {
  it("전부 매칭되면 fetch 1회로 끝나고 주석 반환", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk({
      text: "",
      annotations: [
        { targetText: "역겨워", content: "화자의 반어적 표현", markerType: "underline" },
      ],
    })) as unknown as typeof fetch;

    const result = await extractFromPdfClient(smallPdf(), OPTS, undefined, fetchImpl);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].targetText).toBe("역겨워");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // 인라인 경로: 요청 URL에 모델명이 들어가야 한다
    const url = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("gemini-flash-latest:generateContent");
    expect(url).toContain("key=test-key");
  });

  it("미매칭 주석이 있으면 2라운드 호출", async () => {
    const round1 = geminiOk({
      text: "",
      annotations: [{ targetText: "원문에없는말", content: "c", markerType: "circle" }],
    });
    const round2 = geminiOk({
      text: "",
      annotations: [{ targetText: "역겨워", content: "c", markerType: "circle" }],
    });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(round1)
      .mockResolvedValueOnce(round2) as unknown as typeof fetch;

    const result = await extractFromPdfClient(smallPdf(), OPTS, undefined, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.annotations[0].targetText).toBe("역겨워");
  });

  it("잘못된 markerType은 underline으로 보정", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk({
      text: "",
      annotations: [{ targetText: "역겨워", content: "c", markerType: "invalid-type" }],
    })) as unknown as typeof fetch;

    const result = await extractFromPdfClient(smallPdf(), OPTS, undefined, fetchImpl);
    expect(result.annotations[0].markerType).toBe("underline");
  });

  it("401이면 키 오류 메시지", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false, status: 401, text: async () => "unauthorized",
    }) as unknown as typeof fetch;

    await expect(extractFromPdfClient(smallPdf(), OPTS, undefined, fetchImpl))
      .rejects.toThrow("API 키가 유효하지 않습니다.");
  });

  it("429면 한도 초과 메시지", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false, status: 429, text: async () => "quota",
    }) as unknown as typeof fetch;

    await expect(extractFromPdfClient(smallPdf(), OPTS, undefined, fetchImpl))
      .rejects.toThrow(/한도 초과/);
  });

  it("onProgress 콜백이 진행 단계를 알린다", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk({ text: "", annotations: [] })) as unknown as typeof fetch;
    const messages: string[] = [];
    await extractFromPdfClient(smallPdf(), OPTS, (m) => messages.push(m), fetchImpl);
    expect(messages.length).toBeGreaterThan(0);
  });

  it("INLINE_MAX_BYTES는 12MB", () => {
    expect(INLINE_MAX_BYTES).toBe(12 * 1024 * 1024);
  });

  it("상한 초과 PDF는 호출 없이 안내 메시지로 거부", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const bigPdf = new File([new Uint8Array(1)], "big.pdf", { type: "application/pdf" });
    // 실제로 13MB 버퍼를 만들지 않고 size만 위조한다
    Object.defineProperty(bigPdf, "size", { value: INLINE_MAX_BYTES + 1 });

    await expect(extractFromPdfClient(bigPdf, OPTS, undefined, fetchImpl))
      .rejects.toThrow(/페이지 범위/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
