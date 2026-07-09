# BYOK 전환 + Vercel 무료 배포 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서버 소유 Gemini 키를 제거하고, 사용자가 자기 키를 브라우저에 저장해 Gemini를 직접 호출하는 BYOK 구조로 전환한 뒤 Vercel Hobby(무료)에 공개 배포한다.

**Architecture:** PDF 추출(Mode A/C)을 서버 API 라우트에서 브라우저 직접 호출로 이동. 키는 localStorage에만 저장. 서버에는 PPTX/HTML 생성 라우트만 남아 Vercel 무료 티어 제한(바디 4.5MB, 실행시간)에 걸리지 않는다.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Gemini REST API (`generativelanguage.googleapis.com`), Vitest(신규, 유닛 테스트), Vercel Hobby.

**Spec:** `docs/superpowers/specs/2026-07-09-byok-deployment-design.md`

## Global Constraints

- 운영자 비용 0원: 서버가 Gemini 키·PDF를 절대 다루지 않는다. `GEMINI_API_KEY` 환경변수는 최종적으로 코드베이스에서 완전 제거.
- 키 저장은 localStorage 전용. UI에 프라이버시 문구 필수: "키는 이 브라우저에만 저장되며 저희 서버로 전송되지 않습니다."
- 모델: 기본 `gemini-flash-latest`(Flash 별칭), 선택 `gemini-3.1-pro-preview`. 상수 한 곳(`src/lib/gemini-models.ts`)에서만 정의.
- 인라인 전송 상한 12MB (`INLINE_MAX_BYTES = 12 * 1024 * 1024`). Gemini 요청 전체 한도가 20MB이고 base64가 원본을 약 1.33배로 부풀리므로(12MB → 16MB) 프롬프트 오버헤드까지 안전 마진을 둔 값. **Task 1 스파이크 결과 File API는 브라우저 CORS 차단 → `FILE_API_SUPPORTED = false`**, 초과 PDF는 처리하지 않고 페이지 범위 축소를 안내한다.
- 기존 추출 품질 로직(2라운드 검증, 타임아웃 110초 + 1회 재시도, 에러 메시지 한국어 매핑)은 동작 변경 없이 승계.
- Mode B(직접 입력)와 PPTX/HTML 생성은 키 없이 완전 동작해야 한다.
- 커밋 메시지는 기존 관례(한국어, `feat:`/`fix:`/`docs:`/`chore:` 접두사)를 따른다.

---

### Task 1: CORS 스파이크 — File API 브라우저 업로드 가능 여부 판정

코드를 쓰기 전에 유일한 기술 리스크를 해소한다. 과거 이 프로젝트가 청크를 서버(`/api/upload-chunk`)로 릴레이했던 정황상, Google File API가 브라우저 CORS를 막을 가능성이 있다.

**Files:**
- Modify: 없음 (판정 결과를 이 계획 문서의 아래 "판정 결과" 칸에 기록)

**Interfaces:**
- Produces: `FILE_API_SUPPORTED` 판정값 (true/false) — Task 4의 전송 분기 코드와 Task 5의 안내 문구가 이 값에 의존

- [ ] **Step 1: Gemini API 키 준비**

Google AI Studio(https://aistudio.google.com/apikey)에서 무료 키를 발급받는다 (이미 `.env.local`에 있는 키 재사용 가능).

- [ ] **Step 2: 개발 서버 실행 후 브라우저 콘솔에서 ① generateContent 직접 호출 테스트**

`npm run dev` → http://localhost:3000 접속 → 개발자 도구 콘솔에서:

```js
const KEY = "여기에_키";
await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${KEY}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
}).then(r => r.status);
```

Expected: `200` (CORS 오류 없이 응답). 이게 실패하면 설계 전제가 무너지므로 중단하고 보고.

- [ ] **Step 3: ② File API 업로드 세션 생성 + 업로드 URL 헤더 노출 테스트**

```js
await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${KEY}&uploadType=resumable`, {
  method: "POST",
  headers: {
    "X-Goog-Upload-Protocol": "resumable",
    "X-Goog-Upload-Command": "start",
    "X-Goog-Upload-Header-Content-Type": "application/pdf",
    "X-Goog-Upload-Header-Content-Length": "1000",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ file: { display_name: "t.pdf" } }),
}).then(r => [r.status, r.headers.get("X-Goog-Upload-URL")]);
```

Expected(성공 시): `[200, "https://...업로드URL..."]` — status 200이고 **URL이 null이 아니어야** 성공. CORS 차단(콘솔에 CORS 오류) 또는 URL이 null(헤더 미노출)이면 실패.

- [ ] **Step 4: (Step 3 성공 시에만) 업로드 URL로 실제 바이트 전송 테스트**

```js
const url = "Step 3에서 받은 URL";
await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/pdf",
    "X-Goog-Upload-Offset": "0",
    "X-Goog-Upload-Command": "upload, finalize",
  },
  body: new Uint8Array(1000),
}).then(r => r.status);
```

Expected: `200` (더미 바이트라 파일 처리는 FAILED여도 무방 — CORS 통과 여부만 본다).

- [ ] **Step 5: 판정 기록**

- Step 3~4 모두 통과 → **FILE_API_SUPPORTED = true** (Task 4에서 File API 분기 유지)
- 하나라도 실패 → **FILE_API_SUPPORTED = false** (Task 4에서 File API 분기 제거, 15MB 초과 시 사용자에게 페이지 범위 축소 안내)

**판정 결과 (2026-07-09 수행 완료): FILE_API_SUPPORTED = false**

- Step 2 `generateContent` 직접 호출 → **200 OK**. 설계 전제 성립.
- 모델 목록 조회(`/v1beta/models`) → **200 OK**. `models/gemini-flash-latest`, `models/gemini-3.1-pro-preview` 실재 확인 (Task 5 Step 4 선행 완료).
- Step 3 File API 업로드 세션 → **CORS 차단**. 콘솔: `Access to fetch ... blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present`.
- Step 4는 업로드 URL 미획득으로 수행 불가.

결론: File API 분기를 **제거**한다. Task 4는 `FILE_API_SUPPORTED = false`, `uploadPdfToGeminiFile` import 없이 구현하고, Task 7에서 `gemini-file-upload.ts`를 삭제한다. 12MB 초과 PDF는 "페이지 범위를 더 좁게 추출" 안내 메시지로 거부한다.

---

### Task 2: Vitest 테스트 인프라 추가

이 프로젝트에는 테스트가 없다. 이후 태스크의 TDD를 위해 최소 구성만 추가한다.

**Files:**
- Modify: `package.json` (devDependencies, scripts)
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `npm test` 커맨드 (vitest run), `src/**/*.test.ts` 자동 수집, `@/` 경로 별칭

- [ ] **Step 1: vitest 설치**

```bash
npm install -D vitest
```

- [ ] **Step 2: vitest.config.ts 생성**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 3: package.json scripts에 테스트 커맨드 추가**

`"lint": "eslint"` 아래에 추가:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 동작 확인**

Run: `npm test`
Expected: "No test files found" 류의 메시지와 함께 실패가 아닌 정상 종료 (vitest는 파일 0개일 때 기본적으로 통과 처리하지 않으므로 `--passWithNoTests`가 필요하면 scripts를 `"test": "vitest run --passWithNoTests"`로 수정)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: vitest 테스트 인프라 추가"
```

---

### Task 3: api-key-storage — 키/모델 localStorage 유틸 + 키 검증

**Files:**
- Create: `src/lib/gemini-models.ts`
- Create: `src/lib/api-key-storage.ts`
- Test: `src/lib/api-key-storage.test.ts`

**Interfaces:**
- Produces (Task 4, 5, 6이 사용):
  - `GEMINI_MODELS: { id: string; label: string }[]`, `DEFAULT_MODEL_ID: string` (gemini-models.ts)
  - `getApiKey(): string` — 없으면 `""`
  - `setApiKey(key: string): void`, `clearApiKey(): void`
  - `getModelId(): string` — 없으면 `DEFAULT_MODEL_ID`
  - `setModelId(id: string): void`
  - `validateApiKey(apiKey: string, fetchImpl?: typeof fetch): Promise<boolean>`
  - 모든 storage 함수는 테스트용 `storage?: StorageLike` 마지막 인자를 받음 (기본값 브라우저 localStorage)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/api-key-storage.test.ts`:

```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './api-key-storage'`

- [ ] **Step 3: 구현**

`src/lib/gemini-models.ts`:

```ts
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
```

`src/lib/api-key-storage.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini-models.ts src/lib/api-key-storage.ts src/lib/api-key-storage.test.ts
git commit -m "feat: BYOK 키/모델 localStorage 유틸 및 키 검증 추가"
```

---

### Task 4: gemini-client — 추출 로직을 브라우저로 이동

`gemini-server.ts`의 로직을 클라이언트용으로 이식한다. 프롬프트·2라운드 검증·타임아웃·에러 매핑은 동작 그대로, 다음만 변경: ① 키/모델을 인자로 받음 ② `Buffer` 대신 브라우저 호환 base64 ③ 12MB 초과 시 거부 ④ 테스트를 위한 `fetchImpl` 주입.

**Files:**
- Create: `src/lib/gemini-client.ts`
- Test: `src/lib/gemini-client.test.ts`
- 참조(복사 원본, 이 태스크에서는 수정하지 않음): `src/lib/gemini-server.ts`

**Interfaces:**
- Consumes: 없음 (Task 1 판정으로 File API 경로 제거 — `gemini-file-upload.ts`를 import하지 않는다)
- Produces (Task 6이 사용):
  - `extractFromPdfClient(pdf: File, options: { mode: "A" | "C"; genre: Genre; userText?: string; apiKey: string; model: string }, onProgress?: (msg: string) => void, fetchImpl?: typeof fetch): Promise<ExtractionResult>`
  - `ExtractionResult = { text: string; annotations: ExtractedAnnotation[] }`
  - `INLINE_MAX_BYTES = 12 * 1024 * 1024`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/gemini-client.test.ts`:

```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './gemini-client'`

- [ ] **Step 3: gemini-client.ts 구현**

새 파일 `src/lib/gemini-client.ts`. 아래 뼈대를 만들고, `[복사]` 표시 블록은 `src/lib/gemini-server.ts`에서 **함수 본문 그대로** 복사한다:

```ts
/**
 * 브라우저에서 사용자 BYOK 키로 Gemini를 직접 호출하는 추출 모듈.
 * 키와 PDF는 브라우저 ↔ Google 사이에서만 이동하며 우리 서버를 거치지 않는다.
 */
import type { Genre, ExtractedAnnotation } from "./types";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * 인라인 base64 전송 상한.
 * Gemini 요청 전체 한도가 20MB이고 base64는 원본을 약 1.33배로 부풀린다(12MB → 16MB).
 * File API는 브라우저 CORS로 막혀 있어 이 값이 곧 앱의 하드 리밋이다.
 */
export const INLINE_MAX_BYTES = 12 * 1024 * 1024;

export interface ExtractionResult {
  text: string;
  annotations: ExtractedAnnotation[];
}

// [복사] gemini-server.ts에서 다음 항목을 그대로 가져온다 (내용 무변경):
//   - ANNOTATION_SCHEMA (16-38행)
//   - VALID_MARKER_TYPES (40행)
//   - buildModeCPrompt / buildModeAPrompt / buildRound2Prompt (46-146행)
//   - GeminiResponse 인터페이스 (152-155행)
//   - parseAnnotations (246-256행)
//   - quickMatch (258-273행)

/** File → base64. FileReader 없이 동작해 브라우저·테스트(Node) 양쪽에서 사용 가능. */
async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function callGeminiApi(
  pdfData: { base64: string },
  prompt: string,
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch,
  round: number = 1,
): Promise<{ text?: string; annotations?: Array<{ targetText: string; content: string; markerType: string }> }> {
  const pdfPart = { inlineData: { mimeType: "application/pdf", data: pdfData.base64 } };

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  // 대형 PDF 분석은 오래 걸릴 수 있다 — 110초에서 중단하고 1회 재시도(아래 withRetry)
  const TIMEOUT_MS = 110_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const startTime = Date.now();
  console.log(`[Gemini] Round ${round} 시작`);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [pdfPart, { text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: ANNOTATION_SCHEMA,
          temperature: 0.1,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if ((err as Error).name === "AbortError") {
      console.error(`[Gemini] Round ${round} 타임아웃 (${elapsed}s)`);
      throw new Error(`Gemini 응답 시간 초과 (${elapsed}초). PDF가 너무 크거나 서버가 바쁩니다. 잠시 후 다시 시도하세요.`);
    }
    console.error(`[Gemini] Round ${round} 네트워크 오류 (${elapsed}s):`, err);
    throw new Error(`Gemini 연결 오류: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Gemini] Round ${round} 응답 수신 (${elapsed}s) status=${response.status}`);

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) throw new Error("API 키가 유효하지 않습니다.");
    if (status === 429) throw new Error("요청 한도 초과. 무료 키는 분당 요청 수 제한이 있습니다 — 잠시 후 다시 시도하거나 Flash 모델을 사용하세요.");
    const errorText = await response.text().catch(() => "");
    console.error(`[Gemini] Round ${round} API 오류 (${status}):`, errorText);
    throw new Error(`Gemini API 오류 (${status}): ${errorText.slice(0, 500) || "알 수 없는 오류"}`);
  }

  const data: GeminiResponse = await response.json();
  if (data.error) {
    console.error(`[Gemini] Round ${round} 응답 내 오류:`, data.error);
    throw new Error(`Gemini 오류: ${data.error.message}`);
  }
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) throw new Error("유효한 응답을 받지 못했습니다.");
  try { return JSON.parse(textContent); }
  catch { throw new Error("응답 형식 오류입니다."); }
}

async function callGeminiApiWithRetry(
  pdfData: { base64: string },
  prompt: string,
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch,
  round: number = 1,
): Promise<{ text?: string; annotations?: Array<{ targetText: string; content: string; markerType: string }> }> {
  try {
    return await callGeminiApi(pdfData, prompt, apiKey, model, fetchImpl, round);
  } catch (err) {
    const msg = (err as Error).message ?? "";
    // 타임아웃 메시지의 경과 시간은 110초 이상 → /\(\d{3,}\.\d/ 에 매칭
    const isTimeout = /\(\d{3,}\.\d/.test(msg);
    if (isTimeout) {
      console.log(`[Gemini] Round ${round} 타임아웃 — 3초 후 재시도`);
      await new Promise(r => setTimeout(r, 3_000));
      return callGeminiApi(pdfData, prompt, apiKey, model, fetchImpl, round);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public: 브라우저 직접 추출
// ---------------------------------------------------------------------------

export async function extractFromPdfClient(
  pdf: File,
  options: { mode: "A" | "C"; genre: Genre; userText?: string; apiKey: string; model: string },
  onProgress?: (message: string) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractionResult> {
  const { apiKey, model } = options;

  if (pdf.size > INLINE_MAX_BYTES) {
    throw new Error("PDF가 12MB를 초과합니다. 페이지 범위를 더 좁게 추출한 뒤 다시 시도해주세요.");
  }
  onProgress?.("PDF 인코딩 중...");
  const pdfData = { base64: await fileToBase64(pdf) };

  // Round 1
  const prompt = options.mode === "C"
    ? buildModeCPrompt(options.userText || "", options.genre)
    : buildModeAPrompt(options.genre);

  onProgress?.("AI가 주석을 분석 중... (최대 2분 소요)");
  const round1Raw = await callGeminiApiWithRetry(pdfData, prompt, apiKey, model, fetchImpl);
  const round1Annotations = parseAnnotations(round1Raw);
  const extractedText = round1Raw.text || "";
  const sourceText = options.mode === "C" ? (options.userText || "") : extractedText;

  // Verification
  const { matched, unmatched } = quickMatch(sourceText, round1Annotations);

  // Round 2 — 미매칭 주석이 있을 때만 실행
  if (sourceText.length > 0 && unmatched.length > 0) {
    onProgress?.("누락 주석 재확인 중... (2차 분석)");
    const round2Prompt = buildRound2Prompt(sourceText, options.genre, round1Annotations, unmatched);
    const round2Raw = await callGeminiApiWithRetry(pdfData, round2Prompt, apiKey, model, fetchImpl, 2);
    const round2Annotations = parseAnnotations(round2Raw);
    return { text: extractedText, annotations: round2Annotations };
  }

  return { text: extractedText, annotations: matched.length > 0 ? matched : round1Annotations };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (api-key-storage 7 + gemini-client 8)

- [ ] **Step 5: lint/타입 확인**

Run: `npx tsc --noEmit; npm run lint`
Expected: `test/gemini-file-upload.test.ts(4,39): error TS5097` **한 줄만** 출력된다. 이것은 Task 7에서 해당 파일을 삭제하며 사라지는 기존 오류다. 새 파일(`src/lib/gemini-client.ts`, `src/lib/gemini-client.test.ts`)에서 오류가 나면 고칠 것. lint는 오류 없음.

- [ ] **Step 6: Commit**

```bash
git add src/lib/gemini-client.ts src/lib/gemini-client.test.ts
git commit -m "feat: Gemini 추출 로직을 브라우저 직접 호출로 이식 (BYOK)"
```

---

### Task 5: ApiKeySettings 모달 + InputStep 연결

**Files:**
- Create: `src/components/ApiKeySettings.tsx`
- Modify: `src/components/InputStep.tsx` (키 배너/버튼/모달 연결, `ModeSelector`의 `hasApiKey={true}` 하드코딩 교체)

**Interfaces:**
- Consumes: `getApiKey/setApiKey/clearApiKey/getModelId/setModelId/validateApiKey` (Task 3), `GEMINI_MODELS` (Task 3)
- Produces: `<ApiKeySettings open onClose onSaved />` — Task 6은 UI를 바꾸지 않고 이 컴포넌트가 이미 연결돼 있다고 가정

- [ ] **Step 1: ApiKeySettings 컴포넌트 작성**

`src/components/ApiKeySettings.tsx`:

```tsx
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
```

- [ ] **Step 2: InputStep에 키 상태/배너/모달 연결**

`src/components/InputStep.tsx` 수정:

상단 import에 추가:

```tsx
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import ApiKeySettings from "@/components/ApiKeySettings";
import { getApiKey } from "@/lib/api-key-storage";
```

컴포넌트 본문 시작부(`return` 앞)에 추가:

```tsx
const [hasApiKey, setHasApiKey] = useState(false);
const [isKeySettingsOpen, setIsKeySettingsOpen] = useState(false);

useEffect(() => {
  setHasApiKey(!!getApiKey());
}, []);
```

`<ModeSelector ... hasApiKey={true} />` 를 다음으로 교체:

```tsx
<ModeSelector
  mode={inputMode}
  onChange={onInputModeChange}
  hasApiKey={hasApiKey}
/>
```

ModeSelector 바로 아래에 키 안내 배너 추가 (Mode A/C이고 키가 없을 때만):

```tsx
{inputMode !== "B" && !hasApiKey && (
  <div className="flex items-center justify-between rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
    <p className="text-sm text-amber-800">
      PDF 주석 추출에는 본인의 Gemini API 키(무료 발급)가 필요합니다.
    </p>
    <button
      onClick={() => setIsKeySettingsOpen(true)}
      className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
    >
      <KeyRound className="h-3.5 w-3.5" /> 키 설정
    </button>
  </div>
)}
{inputMode !== "B" && hasApiKey && (
  <div className="flex justify-end">
    <button
      onClick={() => setIsKeySettingsOpen(true)}
      className="flex items-center gap-1 text-xs text-[#6B3F26]/50 hover:text-[#6B3F26]"
    >
      <KeyRound className="h-3 w-3" /> API 키 설정
    </button>
  </div>
)}
```

참고: 스펙의 "401 오류 시 설정 열기 버튼" 요구는 위의 상시 노출 "API 키 설정" 링크가 담당한다 — 추출 중 401 에러 alert을 본 사용자가 같은 화면에서 바로 키를 교체할 수 있다.

추출 버튼 2곳의 `disabled` 조건에 `|| !hasApiKey` 추가:
- Mode C "주석 추출 + 분할" 버튼: `disabled={!fullText.trim() || !pdfFile || isExtracting || !hasApiKey}`
- Mode A "텍스트 & 주석 추출" 버튼: `disabled={!pdfFile || isExtracting || !hasApiKey}`

컴포넌트 최하단(닫는 `</div>` 직전)에 모달 렌더:

```tsx
<ApiKeySettings
  open={isKeySettingsOpen}
  onClose={() => setIsKeySettingsOpen(false)}
  onSaved={() => setHasApiKey(!!getApiKey())}
/>
```

- [ ] **Step 3: 수동 검증 (dev 서버)**

Run: `npm run dev` → 에디터 페이지 진입 후 확인:
1. Mode C에서 키 미설정 시 amber 배너 + 추출 버튼 비활성
2. "키 설정" → 모달 → 잘못된 키 저장 시 인라인 에러
3. 유효한 키 저장 → 배너 사라지고 버튼 활성화, ModeSelector 경고 점 사라짐
4. Mode B는 키와 무관하게 정상 동작
5. 새로고침 후에도 키 유지 (localStorage)

- [x] **Step 4: 모델 상수 실물 확인** — Task 1 스파이크에서 선행 완료. `/v1beta/models` 응답에 `models/gemini-flash-latest`와 `models/gemini-3.1-pro-preview`가 모두 존재함을 확인했다. `gemini-models.ts`의 두 id를 그대로 사용한다.

- [ ] **Step 5: Commit**

```bash
git add src/components/ApiKeySettings.tsx src/components/InputStep.tsx
git commit -m "feat: BYOK API 키 설정 모달 및 입력 화면 연결"
```

---

### Task 6: useEditorState 추출 경로 전환 + E2E 검증

**Files:**
- Modify: `src/hooks/useEditorState.ts:214-321` (`handleExtractAnnotations`, `handleExtractAll`)

**Interfaces:**
- Consumes: `extractFromPdfClient` (Task 4), `getApiKey/getModelId` (Task 3)
- Produces: 기존 `EditorActions` 시그니처 불변 — InputStep 등 호출부는 수정 불필요

- [ ] **Step 1: handleExtractAnnotations를 클라이언트 직접 호출로 교체**

상단 import 추가:

```ts
import { extractFromPdfClient } from "@/lib/gemini-client";
import { getApiKey, getModelId } from "@/lib/api-key-storage";
```

`handleExtractAnnotations`의 try 블록 앞부분(FormData 생성 ~ response.json())을 다음으로 교체:

```ts
const handleExtractAnnotations = useCallback(async () => {
  if (!pdfFile || !fullText.trim()) return;
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Gemini API 키를 먼저 설정해주세요. (입력 화면의 '키 설정' 버튼)");
    return;
  }
  setIsExtracting(true);
  setExtractionProgress("PDF 준비 중...");
  setUnmatchedAnnotations([]);

  try {
    const result = await extractFromPdfClient(
      pdfFile,
      { mode: "C", genre, userText: fullText, apiKey, model: getModelId() },
      setExtractionProgress,
    );
    setExtractionProgress("본문과 주석 매칭 중...");
    const { matched, unmatched } = matchAnnotationsToText(fullText, result.annotations);
    // ... 이하 기존 코드 그대로 (summaryBreaks 계산부터 setStep("annotate")까지 무변경)
```

catch/finally 블록은 기존 그대로 유지.

- [ ] **Step 2: handleExtractAll도 동일 패턴으로 교체**

```ts
const handleExtractAll = useCallback(async () => {
  if (!pdfFile) return;
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Gemini API 키를 먼저 설정해주세요. (입력 화면의 '키 설정' 버튼)");
    return;
  }
  setIsExtracting(true);
  setExtractionProgress("PDF 준비 중...");
  setUnmatchedAnnotations([]);

  try {
    const result = await extractFromPdfClient(
      pdfFile,
      { mode: "A", genre, apiKey, model: getModelId() },
      setExtractionProgress,
    );
    setFullText(result.text);
    // ... 이하 기존 코드 그대로 (result.annotations 처리 무변경)
```

기존의 `fetch("/api/extract")`, AbortController(4분), FormData, HTTP 에러 파싱 코드는 두 함수 모두에서 제거한다 (타임아웃은 gemini-client 내부 110초 × 재시도가 담당).

- [ ] **Step 3: 타입/테스트/린트 확인**

Run: `npx tsc --noEmit; npm test; npm run lint`
Expected: tsc는 `test/gemini-file-upload.test.ts(4,39): error TS5097` 한 줄만 (Task 7에서 제거될 기존 오류). 테스트·lint는 전부 통과.

- [ ] **Step 4: E2E 수동 검증 (실제 키 + 실제 PDF)**

테스트용 실물 교과서 PDF가 저장소에 있다: `test/미래엔_문학_교사용교과서_2_문학의 수용과 생산_11-14.pdf` (2.1MB, 4페이지). 인라인 경로(12MB 이하)를 그대로 태운다.

`npm run dev`에서:
1. Mode C: 본문 붙여넣기 + 위 PDF → "주석 추출 + 분할" → 주석 달린 슬라이드 생성 확인. 개발자 도구 Network 탭에서 요청이 `generativelanguage.googleapis.com`으로만 나가고 `/api/extract` 호출이 **없는지** 확인
2. Mode A: PDF만으로 텍스트+주석 추출 확인
3. PPTX 생성까지 완주 (`.pptx` 다운로드 및 PowerPoint에서 열기)
4. 12MB 초과 PDF 선택 시 "페이지 범위를 더 좁게 추출" 안내 메시지가 뜨고 네트워크 요청이 나가지 않는지 확인
5. 키를 지운 상태에서 Mode B → 슬라이드 분할 → PPTX 생성이 키 없이 완주되는지 확인

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEditorState.ts
git commit -m "feat: PDF 추출을 서버 경유에서 브라우저 직접 호출로 전환"
```

---

### Task 7: 서버 잔재 제거

**Files:**
- Delete: `src/app/api/extract/route.ts`
- Delete: `src/app/api/start-file-upload/route.ts`
- Delete: `src/app/api/upload-chunk/route.ts`
- Delete: `src/app/api/upload-pdf/route.ts`
- Delete: `src/lib/gemini-server.ts`
- Delete: `src/lib/gemini-file-upload.ts` (Task 1 판정으로 File API 경로 폐기 — 파일 전체 삭제)
- Delete: `test/gemini-file-upload.test.ts` (삭제되는 모듈의 Node test-runner 테스트. 이 파일이 유일한 기존 `npx tsc --noEmit` 오류원 TS5097이기도 하다)
- Modify: `package.json` (`@vercel/blob` 제거)

**Interfaces:**
- Consumes: Task 6 완료 상태 (클라이언트가 더 이상 위 라우트를 호출하지 않음)
- Produces: `GEMINI_API_KEY` 없이 빌드·구동되는 코드베이스

- [ ] **Step 1: 삭제 전 참조 확인**

Run: `grep -rn "api/extract\|start-file-upload\|upload-chunk\|upload-pdf\|gemini-server\|vercel/blob\|waitForFileActiveByUri" src/`
Expected: 삭제 대상 파일 자기 자신 외의 참조 0건. 참조가 남아 있으면 먼저 제거.

- [ ] **Step 2: 파일 삭제 및 의존성 제거**

```bash
git rm src/app/api/extract/route.ts src/app/api/start-file-upload/route.ts src/app/api/upload-chunk/route.ts src/app/api/upload-pdf/route.ts src/lib/gemini-server.ts src/lib/gemini-file-upload.ts test/gemini-file-upload.test.ts
npm uninstall @vercel/blob
```

이 삭제로 기존 `npx tsc --noEmit` 오류(TS5097)가 함께 사라진다. Step 4에서 tsc가 완전히 깨끗해지는지 확인한다.

- [ ] **Step 3: GEMINI_API_KEY 잔재 확인**

Run: `grep -rn "GEMINI_API_KEY" src/ next.config* 2>/dev/null`
Expected: 0건 (README/docs는 Task 8에서 처리)

- [ ] **Step 4: 빌드 및 테스트**

Run: `npm run build && npm test`
Expected: 빌드 성공, 테스트 통과. 빌드 출력의 라우트 목록에 `/api/generate-pptx`, `/api/generate-html`만 남았는지 확인.

- [ ] **Step 5: 빌드 산출물로 최종 스모크**

Run: `npm run start` → Mode B로 슬라이드 분할 → PPTX 생성 1회 완주.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: 서버 Gemini 라우트·키·@vercel/blob 제거 (BYOK 전환 완료)"
```

---

### Task 8: 문서 정리

**Files:**
- Modify: `README.md`
- Delete: `docs/cloud-run-cli.md`, `scripts/deploy-cloud-run.ps1`(존재 시 scripts/ 내 배포 스크립트 전부), `.gcloudignore`

**Interfaces:**
- Consumes: 없음
- Produces: 공개 사용자용 온보딩 문서

- [ ] **Step 1: README 수정**

- 기술 스택에서 `Gemini API — PDF 주석 OCR 추출 (서버 사이드)` → `Gemini API — PDF 주석 추출 (브라우저에서 본인 키로 직접 호출, BYOK)`, `@vercel/blob` 줄 삭제, `Railway — 배포` → `Vercel — 배포`
- "설치 및 실행" 섹션의 `.env.local` / `GEMINI_API_KEY` 안내 삭제, 대신:

```markdown
## API 키 (PDF 주석 추출용)

PDF 주석 추출(Mode A/C)은 본인의 Gemini API 키가 필요합니다 — 서버에 키를 두지 않는 BYOK 방식입니다.

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 무료 키 발급
2. 앱 입력 화면의 **키 설정** 버튼에 붙여넣기
3. 키는 브라우저(localStorage)에만 저장되며 서버로 전송되지 않습니다

> 직접 입력(Mode B)과 PPT 생성은 키 없이 사용할 수 있습니다.
```

- 프로젝트 구조에서 삭제된 라우트(`extract/`, `upload-pdf/`)와 `gemini-server.ts` 제거, `gemini-client.ts`·`api-key-storage.ts`·`gemini-models.ts`·`ApiKeySettings.tsx` 반영

- [ ] **Step 2: legacy 배포 문서/스크립트 삭제**

```bash
git rm docs/cloud-run-cli.md .gcloudignore
git rm -r scripts/
```

(scripts/에 배포 외 파일이 있으면 배포 스크립트만 삭제)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: BYOK 사용법으로 README 갱신, Cloud Run 배포 문서 제거"
```

---

### Task 9: Vercel 배포 + 프로덕션 검증

**Files:** 없음 (인프라 작업)

**Interfaces:**
- Consumes: Task 7 완료된 main 브랜치 (환경변수 불필요 상태)
- Produces: 공개 URL (`https://<project>.vercel.app`)

- [ ] **Step 1: main 푸시**

```bash
git push origin main
```

- [ ] **Step 2: Vercel 프로젝트 생성 (사용자 작업)**

두 방법 중 하나:
- **대시보드**: https://vercel.com/new → GitHub 로그인 → `ghga20-ui/korean-lesson-ppt-generator-` Import → 프레임워크 Next.js 자동 감지 → 환경변수 **아무것도 넣지 않고** Deploy
- **CLI**: 터미널에서 `! npx vercel login` 후 `! npx vercel --prod` (프롬프트 기본값 수락)

- [ ] **Step 3: 프로덕션 E2E 검증**

배포 URL에서 Task 6 Step 4의 체크리스트(1~5) 재실행. 특히:
- HTTPS 프로덕션 오리진에서 Gemini CORS 호출 정상 여부
- PPTX 다운로드 정상 여부 (`/api/generate-pptx` Vercel 함수)
- 시크릿 창(키 없음)에서 Mode B 완주

- [ ] **Step 4: README에 배포 URL 추가 후 커밋·푸시**

```bash
git add README.md
git commit -m "docs: 배포 URL 추가"
git push origin main
```

---

## 참고: 삭제되는 것 / 남는 것 요약

| 구분 | 항목 |
|------|------|
| 삭제 | `/api/extract`, `/api/start-file-upload`, `/api/upload-chunk`, `/api/upload-pdf`, `gemini-server.ts`, `gemini-file-upload.ts`, `@vercel/blob`, `GEMINI_API_KEY`, Cloud Run 문서/스크립트 |
| 신규 | `gemini-client.ts`, `gemini-models.ts`, `api-key-storage.ts`, `ApiKeySettings.tsx`, vitest |
| 유지 | `/api/generate-pptx`, `/api/generate-html`, pptx 생성 계열, `annotation-matcher`, `slide-splitter` |
