import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import type { Genre } from "@/lib/types";
import { extractFromPdfServer } from "@/lib/gemini-server";

export const maxDuration = 120;

async function uploadBlobToGeminiFileApi(blobUrl: string, apiKey: string): Promise<string> {
  // Vercel Blob에서 PDF 다운로드
  const pdfRes = await fetch(blobUrl);
  if (!pdfRes.ok) throw new Error(`Blob 다운로드 실패 (${pdfRes.status})`);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

  // Gemini File API multipart 업로드 (서버 → Google, 용량 제한 없음)
  const boundary = "GeminiUploadBoundary";
  const meta = JSON.stringify({ file: { display_name: "document.pdf" } });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
    pdfBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(`Gemini 업로드 실패 (${uploadRes.status}): ${text.slice(0, 200)}`);
  }
  const data = await uploadRes.json();
  const fileUri = data.file?.uri;
  if (!fileUri) throw new Error("Gemini File URI를 받지 못했습니다.");
  return fileUri;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 GEMINI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const blobUrl = formData.get("blobUrl") as string | null;
    const fileUri = formData.get("fileUri") as string | null;
    const mode = formData.get("mode") as "A" | "C";
    const genre = formData.get("genre") as Genre;
    const userText = formData.get("userText") as string | null;

    if (!mode || !genre) {
      return NextResponse.json({ error: "mode, genre는 필수입니다." }, { status: 400 });
    }

    let geminiFileUri: string;

    if (blobUrl) {
      geminiFileUri = await uploadBlobToGeminiFileApi(blobUrl, apiKey);
      del(blobUrl).catch(() => {});
    } else if (fileUri) {
      geminiFileUri = fileUri;
    } else {
      return NextResponse.json({ error: "blobUrl 또는 fileUri가 필요합니다." }, { status: 400 });
    }

    const result = await extractFromPdfServer(
      geminiFileUri,
      apiKey,
      { mode, genre, userText: userText || undefined },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("추출 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "추출 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
