/**
 * Server-side Gemini extraction module.
 * Uses process.env.GEMINI_API_KEY — never exposed to the client.
 */
import type { Genre, ExtractedAnnotation } from "./types";
import { waitForFileActiveByUri } from "./gemini-file-upload";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-3.1-pro-preview";

interface ExtractionResult {
  text: string;
  annotations: ExtractedAnnotation[];
}

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

const VALID_MARKER_TYPES = ["underline", "circle", "rectangle", "triangle", "bracket", "summary"];

// ---------------------------------------------------------------------------
// Prompts (same as client gemini.ts)
// ---------------------------------------------------------------------------

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

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message: string; code: number };
}

async function callGeminiApi(
  pdfData: { base64: string } | { fileUri: string }, prompt: string, apiKey: string,
  round: number = 1,
): Promise<{ text?: string; annotations?: Array<{ targetText: string; content: string; markerType: string }> }> {
  const pdfPart = "fileUri" in pdfData
    ? { fileData: { mimeType: "application/pdf", fileUri: pdfData.fileUri } }
    : { inlineData: { mimeType: "application/pdf", data: pdfData.base64 } };

  const url = `${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`;

  // 서버 측 타임아웃: Vercel Function 제한(300s)보다 충분히 짧게 설정
  const TIMEOUT_MS = 110_000; // 110초
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const startTime = Date.now();
  console.log(`[Gemini] Round ${round} 시작`);

  let response: Response;
  try {
    response = await fetch(url, {
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
    if (status === 429) throw new Error("요청 한도 초과. 잠시 후 다시 시도하세요.");
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
  pdfData: { base64: string } | { fileUri: string },
  prompt: string,
  apiKey: string,
  round: number = 1,
): Promise<{ text?: string; annotations?: Array<{ targetText: string; content: string; markerType: string }> }> {
  try {
    return await callGeminiApi(pdfData, prompt, apiKey, round);
  } catch (err) {
    const msg = (err as Error).message ?? "";
    // elapsed time in timeout message is 110+ seconds → matches /(\d{3,}\.\d/
    const isTimeout = /\(\d{3,}\.\d/.test(msg);
    if (isTimeout) {
      console.log(`[Gemini] Round ${round} 타임아웃 — 3초 후 재시도`);
      await new Promise(r => setTimeout(r, 3_000));
      return callGeminiApi(pdfData, prompt, apiKey, round);
    }
    throw err;
  }
}

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

function quickMatch(sourceText: string, annotations: ExtractedAnnotation[]) {
  const matched: ExtractedAnnotation[] = [];
  const unmatched: ExtractedAnnotation[] = [];
  const normalize = (s: string) =>
    s.replace(/[\u2018\u2019\u201C\u201D]/g, (c) => c === "\u2018" || c === "\u2019" ? "'" : '"')
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
// Public: server-side extraction
// ---------------------------------------------------------------------------

export async function extractFromPdfServer(
  pdf: File | string, // File 또는 fileUri 문자열
  apiKey: string,
  options: { mode: "A" | "C"; genre: Genre; userText?: string },
): Promise<ExtractionResult> {
  // File이면 inline base64, 문자열이면 fileUri (File API)
  let pdfData: { base64: string } | { fileUri: string };
  if (typeof pdf === "string") {
    await waitForFileActiveByUri(pdf, apiKey);
    pdfData = { fileUri: pdf };
  } else {
    const buffer = await pdf.arrayBuffer();
    pdfData = { base64: Buffer.from(buffer).toString("base64") };
  }

  // Round 1
  const prompt = options.mode === "C"
    ? buildModeCPrompt(options.userText || "", options.genre)
    : buildModeAPrompt(options.genre);

  const round1Raw = await callGeminiApiWithRetry(pdfData, prompt, apiKey);
  const round1Annotations = parseAnnotations(round1Raw);
  const extractedText = round1Raw.text || "";
  const sourceText = options.mode === "C" ? (options.userText || "") : extractedText;

  // Verification
  const { matched, unmatched } = quickMatch(sourceText, round1Annotations);

  // Round 2 — 미매칭 주석이 있을 때만 실행 (타임아웃 방지)
  if (sourceText.length > 0 && unmatched.length > 0) {
    const round2Prompt = buildRound2Prompt(sourceText, options.genre, round1Annotations, unmatched);
    const round2Raw = await callGeminiApiWithRetry(pdfData, round2Prompt, apiKey, 2);
    const round2Annotations = parseAnnotations(round2Raw);
    return { text: extractedText, annotations: round2Annotations };
  }

  return { text: extractedText, annotations: matched.length > 0 ? matched : round1Annotations };
}
