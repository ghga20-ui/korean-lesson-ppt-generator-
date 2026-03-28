import { NextRequest, NextResponse } from "next/server";
import type { Genre } from "@/lib/types";
import { extractFromPdfServer } from "@/lib/gemini-server";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileUri = formData.get("fileUri") as string | null;
    const mode = formData.get("mode") as "A" | "C";
    const genre = formData.get("genre") as Genre;
    const userText = formData.get("userText") as string | null;

    if (!fileUri || !mode || !genre) {
      return NextResponse.json(
        { error: "fileUri, mode, genre는 필수입니다." },
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

    const result = await extractFromPdfServer(
      fileUri,
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
