import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import type { Genre } from "@/lib/types";
import { extractFromPdfServer } from "@/lib/gemini-server";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let blobUrl: string | null = null;
  try {
    const formData = await request.formData();
    blobUrl = formData.get("blobUrl") as string | null;
    const mode = formData.get("mode") as "A" | "C";
    const genre = formData.get("genre") as Genre;
    const userText = formData.get("userText") as string | null;

    if (!blobUrl || !mode || !genre) {
      return NextResponse.json(
        { error: "blobUrl, mode, genre는 필수입니다." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "서버에 GEMINI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // Vercel Blob에서 PDF 가져오기
    const pdfResponse = await fetch(blobUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: "PDF 파일을 가져오지 못했습니다." },
        { status: 400 }
      );
    }
    const pdfBlob = await pdfResponse.blob();
    const pdfFile = new File([pdfBlob], "document.pdf", { type: "application/pdf" });

    const result = await extractFromPdfServer(
      pdfFile,
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
    // 처리 완료 후 blob 삭제
    if (blobUrl) {
      await del(blobUrl).catch(() => {});
    }
  }
}
