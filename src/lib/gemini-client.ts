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

// [복사] gemini-server.ts에서 그대로 가져옴 (내용 무변경): ANNOTATION_SCHEMA
const ANNOTATION_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    text: { type: "STRING" as const, description: "작품의 원문 텍스트 (Mode A에서만 사용)" },
    annotations: {
      type: "ARRAY" as const,
      items: {
        type: "OBJECT" as const,
        properties: {
          targetText: { type: "STRING" as const, description: "주석이 달린 원문의 정확한 문자열" },
          content: { type: "STRING" as const, description: "주석/해설 내용" },
          markerType: {
            type: "STRING" as const,
            enum: ["underline", "circle", "rectangle", "triangle", "bracket", "summary"],
            description: "마커 유형",
          },
        },
        required: ["targetText", "content", "markerType"],
      },
    },
  },
  required: ["annotations"],
};

// [복사] gemini-server.ts에서 그대로 가져옴 (내용 무변경): VALID_MARKER_TYPES
const VALID_MARKER_TYPES = ["underline", "circle", "rectangle", "triangle", "bracket", "summary"];

// ---------------------------------------------------------------------------
// Prompts (same as client gemini.ts)
// ---------------------------------------------------------------------------

// [복사] gemini-server.ts에서 그대로 가져옴 (내용 무변경): buildModeCPrompt
function buildModeCPrompt(userText: string, genre: Genre): string {
  return `당신은 한국 고등학교 문학 교사용 교과서 PDF를 분석하는 전문가입니다.

다음은 사용자가 입력한 ${genre === "poetry" ? "시" : "소설"} 원본 텍스트입니다:

"""
${userText}
"""

PDF에서 이 텍스트에 대한 교사용 교과서의 주석/해설을 추출하세요.

규칙:
1. targetText는 반드시 위 원본 텍스트에 존재하는 **정확한 문자열**이어야 합니다.
2. 원본 텍스트에 없는 문자열을 targetText로 사용하지 마세요.
3. content는 해당 부분에 대한 교사용 교과서의 해설/주석 내용입니다.

4. 교사용 교과서의 주석 패턴과 markerType 결정 기준:
   a) 파란색 밑줄 + 해설 텍스트 → "underline"
   b) 「 」 꺾쇠괄호 + ": 설명" 형식 → "bracket" (targetText는 괄호 안 원문만)
   c) 동그라미/원 표시 → "circle"
   d) 네모/사각형 표시 → "rectangle"
   e) ▶ 단락/연 요약 → "summary" (targetText는 해당 단락 마지막 5~10자)
   f) → 화살표 연결 → "bracket" 또는 "underline"
   g) 판단이 어려우면 "underline"

   **markerType 판단 우선순위:**
   - 확실한 시각적 표시가 있을 때만 해당 타입을 사용하세요.
   - 판단이 모호하면 "underline"으로 분류하세요.

5. PDF에서 찾을 수 있는 모든 주석을 빠짐없이 추출하세요.
6. 제외: 어휘 풀이, 학습 활동 질문, 단원 목표
7. 각 targetText가 원문에 정확히 존재하는지 반드시 확인하세요.

text 필드는 빈 문자열("")로 설정하세요.`;
}

// [복사] gemini-server.ts에서 그대로 가져옴 (내용 무변경): buildModeAPrompt
function buildModeAPrompt(genre: Genre): string {
  return `당신은 한국 고등학교 문학 교사용 교과서 PDF를 분석하는 전문가입니다.

PDF에서 ${genre === "poetry" ? "시" : "소설"} 작품의 원문 텍스트와 주석을 모두 추출하세요.

텍스트 추출 규칙:
${genre === "poetry"
    ? `- 시의 연 구분(빈 줄)을 정확하게 유지하세요.
- 각 행의 줄바꿈(\\n)을 정확하게 유지하세요.
- 연과 연 사이는 빈 줄(\\n\\n)로 구분하세요.
- 제목, 작가 이름 등 부가 정보는 제외하고 시 본문만 추출하세요.`
    : `- 불필요한 줄바꿈은 제거하세요.
- 문단 구분은 줄바꿈(\\n)으로 유지하세요.
- 제목, 작가 이름 등 부가 정보는 제외하고 소설 본문만 추출하세요.`
  }

주석 추출 규칙:
1. targetText는 추출한 원문 텍스트에 존재하는 **정확한 문자열**이어야 합니다.
2. content는 해당 부분에 대한 교사용 교과서의 해설/주석 내용입니다.
3. markerType: underline/circle/rectangle/bracket/summary. 모호하면 underline.
4. 모든 주석을 빠짐없이 추출. 어휘 풀이, 학습 활동 질문 제외.
5. 각 targetText가 추출한 원문에 정확히 존재하는지 반드시 확인하세요.

text 필드에 추출한 원문 텍스트를 넣으세요.`;
}

// [복사] gemini-server.ts에서 그대로 가져옴 (내용 무변경): buildRound2Prompt
function buildRound2Prompt(
  sourceText: string, genre: Genre,
  round1Annotations: ExtractedAnnotation[], unmatchedAnnotations: ExtractedAnnotation[],
): string {
  const round1Json = JSON.stringify(round1Annotations, null, 2);
  const hasUnmatched = unmatchedAnnotations.length > 0;
  const unmatchedList = unmatchedAnnotations
    .map((a, i) => `  ${i + 1}. "${a.targetText}" → ${a.content} (${a.markerType})`)
    .join("\n");

  const verification = hasUnmatched
    ? `매칭 실패 ${unmatchedAnnotations.length}개:\n${unmatchedList}`
    : `모든 주석 매칭 성공 (${round1Annotations.length}개).`;

  const instructions = hasUnmatched
    ? `1. 매칭 실패한 targetText를 원문에 정확히 존재하는 문자열로 수정하세요.
2. PDF를 다시 확인하여 빠진 주석이 있으면 추가하세요.
3. 매칭 성공한 주석들도 모두 포함하세요.
4. markerType이 잘못된 것이 있으면 수정하세요.`
    : `1. PDF를 다시 확인하여 빠진 주석이 있으면 추가하세요.
2. 이전 결과를 모두 포함하세요.
3. markerType이 잘못된 것이 있으면 수정하세요.`;

  return `이전 추출 결과를 검증했습니다. 보완해주세요.

${genre === "poetry" ? "시" : "소설"} 원문:
"""
${sourceText}
"""

이전 결과 (${round1Annotations.length}개):
${round1Json}

${verification}

${instructions}

어휘 풀이, 학습 활동 질문 제외. text 필드는 ""로 설정.`;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

// [복사] gemini-server.ts에서 그대로 가져옴 (내용 무변경): GeminiResponse
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message: string; code: number };
}

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

// [복사] gemini-server.ts에서 그대로 가져옴 (내용 무변경): parseAnnotations
function parseAnnotations(
  raw: { annotations?: Array<{ targetText: string; content: string; markerType: string }> },
): ExtractedAnnotation[] {
  return (raw.annotations || []).map((a) => ({
    targetText: a.targetText,
    content: a.content,
    markerType: VALID_MARKER_TYPES.includes(a.markerType)
      ? (a.markerType as ExtractedAnnotation["markerType"])
      : "underline",
  }));
}

// [복사] gemini-server.ts에서 그대로 가져옴 (내용 무변경): quickMatch
function quickMatch(sourceText: string, annotations: ExtractedAnnotation[]) {
  const matched: ExtractedAnnotation[] = [];
  const unmatched: ExtractedAnnotation[] = [];
  const normalize = (s: string) =>
    s.replace(/[‘’“”]/g, (c) => c === "‘" || c === "’" ? "'" : '"')
      .replace(/\s+/g, " ").trim();
  const normSrc = normalize(sourceText);
  for (const ann of annotations) {
    if (sourceText.includes(ann.targetText) || normSrc.includes(normalize(ann.targetText))) {
      matched.push(ann);
    } else {
      unmatched.push(ann);
    }
  }
  return { matched, unmatched };
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
