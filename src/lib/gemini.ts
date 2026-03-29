import type { Genre, ExtractedAnnotation } from "./types";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-3.1-pro-preview";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message: string; code: number };
}

interface ExtractionResult {
  text: string;
  annotations: ExtractedAnnotation[];
}

const ANNOTATION_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    text: {
      type: "STRING" as const,
      description: "작품의 원문 텍스트 (Mode A에서만 사용)",
    },
    annotations: {
      type: "ARRAY" as const,
      items: {
        type: "OBJECT" as const,
        properties: {
          targetText: {
            type: "STRING" as const,
            description: "주석이 달린 원문의 정확한 문자열",
          },
          content: {
            type: "STRING" as const,
            description: "주석/해설 내용",
          },
          markerType: {
            type: "STRING" as const,
            enum: ["underline", "circle", "rectangle", "triangle", "bracket", "summary"],
            description: "마커 유형: 밑줄→underline, 원/동그라미→circle, 네모/사각형→rectangle, 세모/삼각형→triangle, 꺾쇠괄호「」→bracket, 단락요약▶→summary",
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
// Prompt builders
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

   a) 파란색 밑줄 + 해설 텍스트: 본문 아래에 밑줄이 그어지고
      해설이 적힌 부분 → "underline"

   b) 「 」 꺾쇠괄호 + ": 설명" 형식: 구절을 「 」로 감싸고
      콜론 뒤에 설명이 이어지는 형식 → "bracket"
      - targetText는 「 」 안의 원문 구절만 (괄호 제외)
      - content는 콜론 뒤의 설명 내용

   c) 동그라미/원 표시: 핵심 시어/단어에 동그라미 → "circle"

   d) 네모/사각형 표시: 핵심 구절/문장에 네모 박스 → "rectangle"

   e) ▶ 단락/연 요약 → "summary"
      - targetText는 해당 단락/연의 **마지막 문장의 마지막 5~10자**
      - content는 ▶ 뒤의 요약 내용

   f) → 화살표 연결 (기법 → 효과): "표현기법 → 효과" 형식
      → "bracket" 또는 "underline"으로 처리
      - targetText는 기법이 적용된 원문 구절
      - content는 "기법명 → 효과 설명" 전체

   g) 판단이 어려우면 "underline"으로 기본 설정

   **markerType 판단 우선순위:**
   - 확실한 시각적 표시가 있을 때만 해당 타입을 사용하세요.
   - 「 」 기호가 명확히 보이지 않으면 "bracket"을 사용하지 마세요.
   - 동그라미/네모가 명확히 보이지 않으면 "circle"/"rectangle"을 사용하지 마세요.
   - 판단이 모호하면 "underline"으로 분류하세요.

   **summary 타입 필수 규칙:**
   - targetText는 반드시 해당 단락/연의 **맨 마지막 문장에서 마지막 5~10글자**를 사용하세요.
   - 단락의 앞부분이나 중간 구절을 targetText로 사용하면 안 됩니다.
   - 예시: 단락이 "...하늘을 바라보며 긴 한숨을 내쉬었다."로 끝나면 → targetText: "긴 한숨을 내쉬었다."

5. PDF에서 찾을 수 있는 모든 주석을 빠짐없이 추출하세요.

6. 제외 대상:
   - 어휘 풀이 (단어의 사전적 뜻풀이)
   - 학습 활동 질문 ("생각해 보기", "활동" 등)
   - 단원 목표나 성취 기준 설명

7. **중요 검증 단계:**
   - 각 targetText를 생성한 후, 원문에서 정확히 그 문자열이 존재하는지 다시 확인하세요.
   - 원문의 글자를 그대로 복사하세요. OCR 과정에서 발생하는 미세한 차이(띄어쓰기, 따옴표 종류 등)에 주의하세요.

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

3. 교사용 교과서의 주석 패턴과 markerType 결정 기준:

   a) 파란색 밑줄 + 해설 텍스트: 본문 아래에 밑줄이 그어지고
      해설이 적힌 부분 → "underline"

   b) 「 」 꺾쇠괄호 + ": 설명" 형식: 구절을 「 」로 감싸고
      콜론 뒤에 설명이 이어지는 형식 → "bracket"
      - targetText는 「 」 안의 원문 구절만 (괄호 제외)
      - content는 콜론 뒤의 설명 내용

   c) 동그라미/원 표시: 핵심 시어/단어에 동그라미 → "circle"

   d) 네모/사각형 표시: 핵심 구절/문장에 네모 박스 → "rectangle"

   e) ▶ 단락/연 요약 → "summary"
      - targetText는 해당 단락/연의 **마지막 문장의 마지막 5~10자**
      - content는 ▶ 뒤의 요약 내용

   f) → 화살표 연결 (기법 → 효과): "표현기법 → 효과" 형식
      → "bracket" 또는 "underline"으로 처리
      - targetText는 기법이 적용된 원문 구절
      - content는 "기법명 → 효과 설명" 전체

   g) 판단이 어려우면 "underline"으로 기본 설정

   **markerType 판단 우선순위:**
   - 확실한 시각적 표시가 있을 때만 해당 타입을 사용하세요.
   - 「 」 기호가 명확히 보이지 않으면 "bracket"을 사용하지 마세요.
   - 동그라미/네모가 명확히 보이지 않으면 "circle"/"rectangle"을 사용하지 마세요.
   - 판단이 모호하면 "underline"으로 분류하세요.

   **summary 타입 필수 규칙:**
   - targetText는 반드시 해당 단락/연의 **맨 마지막 문장에서 마지막 5~10글자**를 사용하세요.
   - 단락의 앞부분이나 중간 구절을 targetText로 사용하면 안 됩니다.
   - 예시: 단락이 "...하늘을 바라보며 긴 한숨을 내쉬었다."로 끝나면 → targetText: "긴 한숨을 내쉬었다."

4. PDF에서 찾을 수 있는 모든 주석을 빠짐없이 추출하세요.

5. 제외 대상:
   - 어휘 풀이 (단어의 사전적 뜻풀이)
   - 학습 활동 질문 ("생각해 보기", "활동" 등)
   - 단원 목표나 성취 기준 설명

6. **중요 검증 단계:**
   - 각 targetText를 생성한 후, 추출한 원문에서 정확히 그 문자열이 존재하는지 다시 확인하세요.
   - 원문의 글자를 그대로 복사하세요. OCR 과정에서 발생하는 미세한 차이(띄어쓰기, 따옴표 종류 등)에 주의하세요.

text 필드에 추출한 원문 텍스트를 넣으세요.`;
}

/**
 * Round 2 prompt: given Round 1 results + verification feedback,
 * ask Gemini to fix unmatched annotations and find missing ones.
 */
function buildRound2Prompt(
  sourceText: string,
  genre: Genre,
  round1Annotations: ExtractedAnnotation[],
  unmatchedAnnotations: ExtractedAnnotation[],
): string {
  const round1Json = JSON.stringify(round1Annotations, null, 2);
  const unmatchedList = unmatchedAnnotations
    .map((a, i) => `  ${i + 1}. targetText: "${a.targetText}" → content: "${a.content}" (${a.markerType})`)
    .join("\n");

  const hasUnmatched = unmatchedAnnotations.length > 0;

  const verificationSection = hasUnmatched
    ? `검증 결과:
- 매칭 성공: ${round1Annotations.length - unmatchedAnnotations.length}개
- 매칭 실패 (targetText가 원문에 없음): ${unmatchedAnnotations.length}개
${unmatchedList}`
    : `검증 결과:
- 모든 주석의 targetText가 원문에 매칭되었습니다 (${round1Annotations.length}개).`;

  const instructions = hasUnmatched
    ? `수정 요청:
1. 매칭 실패한 주석들의 targetText를 위 원문에 **정확히 존재하는 문자열**로 수정하세요.
   - 원문에서 해당 내용과 가장 가까운 구절을 찾아 정확히 복사하세요.
   - 띄어쓰기, 따옴표, 조사 등이 정확히 일치해야 합니다.
2. PDF를 다시 확인하여 빠진 주석이 있으면 추가하세요.
3. 이전에 매칭 성공한 주석들도 모두 포함하세요 (수정 없이 그대로).
4. markerType이 잘못된 것이 있으면 수정하세요.
5. 어휘 풀이, 학습 활동 질문, 단원 목표는 제외하세요.`
    : `확인 요청:
1. PDF를 다시 확인하여 빠진 주석이 있으면 추가하세요.
2. 이전 추출 결과를 모두 포함하세요 (수정 없이 그대로).
3. markerType이 잘못된 것이 있으면 수정하세요.
4. 어휘 풀이, 학습 활동 질문, 단원 목표는 제외하세요.`;

  return `당신은 한국 고등학교 문학 교사용 교과서 PDF를 분석하는 전문가입니다.

이전 추출 결과를 검증했습니다. 아래의 원문 텍스트와 이전 결과를 참고하여 보완해주세요.

${genre === "poetry" ? "시" : "소설"} 원문 텍스트:
"""
${sourceText}
"""

이전 추출 결과 (총 ${round1Annotations.length}개):
${round1Json}

${verificationSection}

${instructions}

text 필드는 빈 문자열("")로 설정하세요.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Call Gemini API with PDF + text prompt. Returns raw parsed JSON.
 */
async function callGeminiApi(
  base64Data: string,
  prompt: string,
  apiKey: string,
): Promise<{ text?: string; annotations?: Array<{ targetText: string; content: string; markerType: string }> }> {
  const requestBody = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "application/pdf", data: base64Data } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ANNOTATION_SCHEMA,
      temperature: 0.1,
    },
  };

  const url = `${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error("API 키가 유효하지 않습니다. 키를 확인해주세요.");
    }
    if (status === 429) {
      throw new Error("요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.");
    }
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gemini API 오류 (${status}): ${errorText || "알 수 없는 오류"}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(`Gemini 오류: ${data.error.message}`);
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error("Gemini에서 유효한 응답을 받지 못했습니다. 다시 시도하세요.");
  }

  try {
    return JSON.parse(textContent);
  } catch {
    throw new Error("응답 형식 오류입니다. 다시 시도하세요.");
  }
}

/**
 * Parse raw API response annotations into typed ExtractedAnnotation[].
 */
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

/**
 * Quick text matching: check which annotations' targetText exists in the source text.
 * Uses exact match then normalized (whitespace/quote) fallback.
 */
function quickMatch(
  sourceText: string,
  annotations: ExtractedAnnotation[],
): { matched: ExtractedAnnotation[]; unmatched: ExtractedAnnotation[] } {
  const matched: ExtractedAnnotation[] = [];
  const unmatched: ExtractedAnnotation[] = [];

  const normalize = (s: string) =>
    s.replace(/[\u2018\u2019\u201C\u201D]/g, (ch) =>
      ch === "\u2018" || ch === "\u2019" ? "'" : '"'
    ).replace(/\s+/g, " ").trim();

  const normSource = normalize(sourceText);

  for (const ann of annotations) {
    if (sourceText.includes(ann.targetText)) {
      matched.push(ann);
    } else if (normSource.includes(normalize(ann.targetText))) {
      matched.push(ann);
    } else {
      unmatched.push(ann);
    }
  }

  return { matched, unmatched };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function extractFromPdf(
  pdfFile: File,
  apiKey: string,
  options: { mode: "A" | "C"; genre: Genre; userText?: string },
  onProgress?: (msg: string) => void
): Promise<ExtractionResult> {
  onProgress?.("PDF를 변환하는 중...");
  const base64Data = await fileToBase64(pdfFile);

  // ---- Round 1 ----
  onProgress?.("1차 추출 중...");

  const prompt = options.mode === "C"
    ? buildModeCPrompt(options.userText || "", options.genre)
    : buildModeAPrompt(options.genre);

  const round1Raw = await callGeminiApi(base64Data, prompt, apiKey);
  const round1Annotations = parseAnnotations(round1Raw);
  const extractedText = round1Raw.text || "";

  // Source text for verification
  const sourceText = options.mode === "C" ? (options.userText || "") : extractedText;

  // ---- Verification ----
  const { matched, unmatched } = quickMatch(sourceText, round1Annotations);

  onProgress?.(
    `검증 완료: ${matched.length}개 매칭 성공, ${unmatched.length}개 실패 (총 ${round1Annotations.length}개)`
  );

  // ---- Round 2 (항상 실행) ----
  if (sourceText.length > 0) {
    const hasUnmatched = unmatched.length > 0;
    onProgress?.(
      hasUnmatched
        ? "2차 추출 중 (매칭 실패 수정 + 누락 보충)..."
        : "2차 추출 중 (누락 확인)..."
    );

    const round2Prompt = buildRound2Prompt(
      sourceText, options.genre, round1Annotations, unmatched,
    );
    const round2Raw = await callGeminiApi(base64Data, round2Prompt, apiKey);
    const round2Annotations = parseAnnotations(round2Raw);

    // Verify Round 2
    const round2Check = quickMatch(sourceText, round2Annotations);

    onProgress?.(
      `2차 완료: ${round2Check.matched.length}개 매칭 성공 (총 ${round2Annotations.length}개)`
    );

    return {
      text: extractedText,
      annotations: round2Annotations,
    };
  }

  onProgress?.(`완료! 총 ${round1Annotations.length}개 주석`);

  return {
    text: extractedText,
    annotations: round1Annotations,
  };
}
