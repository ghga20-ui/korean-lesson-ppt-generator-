import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { size } = (await request.json()) as { size: number };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}&uploadType=resumable`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Type": "application/pdf",
          "X-Goog-Upload-Header-Content-Length": String(size),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: { display_name: "document.pdf" } }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `업로드 세션 생성 실패: ${text}` }, { status: response.status });
    }

    const uploadUrl = response.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) {
      return NextResponse.json({ error: "업로드 URL을 받지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ uploadUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "업로드 세션 생성 중 오류" },
      { status: 500 }
    );
  }
}
