import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import type { Genre } from "@/lib/types";
import { extractFromPdfServer } from "@/lib/gemini-server";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 GEMINI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let blobUrl: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileUri = formData.get("fileUri") as string | null;
    blobUrl = formData.get("blobUrl") as string | null;
    const mode = formData.get("mode") as "A" | "C";
    const genre = formData.get("genre") as Genre;
    const userText = formData.get("userText") as string | null;

    if (!mode || !genre) {
      return NextResponse.json({ error: "mode, genre는 필수입니다." }, { status: 400 });
    }

    let pdfInput: File | string;

    if (file && file.size > 0) {
      // 소용량 PDF: 직접 FormData로 전송
      pdfInput = file;
    } else if (blobUrl) {
      // 대용량 PDF: Vercel Blob에서 서버 fetch → File 객체 생성
      console.log(`[extract] Vercel Blob에서 PDF fetch: ${blobUrl}`);
      const res = await fetch(blobUrl);
      if (!res.ok) throw new Error(`Blob fetch 실패 (${res.status})`);
      const buffer = await res.arrayBuffer();
      console.log(`[extract] PDF fetch 완료, 크기=${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
      pdfInput = new File([buffer], "document.pdf", { type: "application/pdf" });
    } else if (fileUri) {
      pdfInput = fileUri;
    } else {
      return NextResponse.json({ error: "file, blobUrl, fileUri 중 하나가 필요합니다." }, { status: 400 });
    }

    const result = await extractFromPdfServer(
      pdfInput,
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
  } finally {
    // 완료 후 Blob 정리
    if (blobUrl) {
      del(blobUrl).catch((e) => console.warn("[extract] Blob 삭제 실패:", e));
    }
  }
}
