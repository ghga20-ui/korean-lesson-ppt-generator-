const GEMINI_FILE_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_FILE_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function uploadPdfToGeminiFile(
  pdf: File,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const startResponse = await fetchImpl(
    `${GEMINI_FILE_UPLOAD_URL}?key=${apiKey}&uploadType=resumable`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Type": pdf.type || "application/pdf",
        "X-Goog-Upload-Header-Content-Length": String(pdf.size),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: {
          display_name: pdf.name || "document.pdf",
        },
      }),
    },
  );

  if (!startResponse.ok) {
    const text = await startResponse.text().catch(() => "");
    throw new Error(`Gemini file upload session failed (${startResponse.status}): ${text.slice(0, 300)}`);
  }

  const uploadUrl = startResponse.headers.get("X-Goog-Upload-URL");

  if (!uploadUrl) {
    throw new Error("Gemini did not return an upload URL.");
  }

  const pdfBuffer = await pdf.arrayBuffer();
  const uploadResponse = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": pdf.type || "application/pdf",
      "Content-Length": String(pdfBuffer.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: pdfBuffer,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => "");
    throw new Error(`Gemini file upload failed (${uploadResponse.status}): ${text.slice(0, 300)}`);
  }

  const data = await uploadResponse.json();
  const fileUri = data.file?.uri;
  const fileName = data.file?.name; // e.g. "files/abc123"

  if (!fileUri || !fileName) {
    throw new Error("Gemini did not return a file URI.");
  }

  // 파일이 ACTIVE 상태가 될 때까지 폴링
  await waitForFileActive(fileName, apiKey, fetchImpl);

  return fileUri;
}

/**
 * Gemini File API: 파일이 PROCESSING → ACTIVE 상태가 될 때까지 폴링.
 * fileName = "files/abc123" 형식
 */
async function waitForFileActive(
  fileName: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  maxWaitMs = 60_000,
  intervalMs = 3_000,
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const res = await fetchImpl(
      `${GEMINI_FILE_API_BASE}/${fileName}?key=${apiKey}`,
      { method: "GET" },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`파일 상태 확인 실패 (${res.status}): ${text.slice(0, 200)}`);
    }

    const fileInfo = await res.json();
    const state: string = fileInfo.state ?? "PROCESSING";

    console.log(`[Gemini File] state=${state}, name=${fileName}`);

    if (state === "ACTIVE") return;
    if (state === "FAILED") throw new Error("Gemini 파일 처리에 실패했습니다. 다시 시도해주세요.");

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Gemini 파일 처리 시간 초과 (60초). 다시 시도해주세요.");
}

/**
 * fileUri("https://generativelanguage.googleapis.com/v1beta/files/abc123")로
 * 파일이 ACTIVE 상태가 될 때까지 폴링. 청크 업로드 완료 후 서버에서 호출.
 */
export async function waitForFileActiveByUri(
  fileUri: string,
  apiKey: string,
): Promise<void> {
  // URI에서 "files/abc123" 부분 추출
  const match = fileUri.match(/(files\/[^?/]+)/);
  if (!match) {
    console.warn(`[Gemini File] URI에서 파일명 추출 불가: ${fileUri} — 폴링 건너뜀`);
    return;
  }
  await waitForFileActive(match[1], apiKey);
}
