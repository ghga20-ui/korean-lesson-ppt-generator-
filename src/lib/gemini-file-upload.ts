const GEMINI_FILE_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";

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

  if (!fileUri) {
    throw new Error("Gemini did not return a file URI.");
  }

  return fileUri;
}
