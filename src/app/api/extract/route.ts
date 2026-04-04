import { NextRequest, NextResponse } from "next/server";
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

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileUri = formData.get("fileUri") as string | null;
    const mode = formData.get("mode") as "A" | "C";
    const genre = formData.get("genre") as Genre;
    const userText = formData.get("userText") as string | null;

    if (!mode || !genre) {
      return NextResponse.json({ error: "mode, genre는 필수입니다." }, { status: 400 });
    }

    let pdfInput: File | string;

    if (file && file.size > 0) {
      pdfInput = file;
    } else if (fileUri) {
      pdfInput = fileUri;
    } else {
      return NextResponse.json({ error: "file 또는 fileUri가 필요합니다." }, { status: 400 });
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
  }
}
