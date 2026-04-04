import { NextRequest, NextResponse } from "next/server";

// Node.js runtime 사용 (Edge runtime은 binary 업로드 hang 문제 있음)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const uploadUrl = formData.get("uploadUrl") as string | null;
    const offset = parseInt(formData.get("offset") as string ?? "0", 10);
    const chunk = formData.get("chunk") as Blob | null;
    const isLast = formData.get("isLast") === "true";

    if (!uploadUrl || !chunk) {
      return NextResponse.json({ error: "uploadUrl, chunk는 필수입니다." }, { status: 400 });
    }

    const chunkBuffer = await chunk.arrayBuffer();
    const command = isLast ? "upload, finalize" : "upload";

    console.log(`[upload-chunk] offset=${offset}, size=${chunkBuffer.byteLength}, isLast=${isLast}`);

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(chunkBuffer.byteLength),
        "X-Goog-Upload-Command": command,
        "X-Goog-Upload-Offset": String(offset),
      },
      body: chunkBuffer,
    });

    // 308 Resume Incomplete = 중간 청크 정상 수신
    if (!response.ok && response.status !== 308) {
      const text = await response.text().catch(() => "");
      console.error(`[upload-chunk] 실패 (${response.status}):`, text.slice(0, 300));
      return NextResponse.json(
        { error: `청크 업로드 실패 (${response.status}): ${text.slice(0, 200)}` },
        { status: response.status }
      );
    }

    if (isLast) {
      const data = await response.json();
      const fileUri = data.file?.uri;
      console.log(`[upload-chunk] 완료, fileUri=${fileUri}`);
      if (!fileUri) return NextResponse.json({ error: "파일 URI를 받지 못했습니다." }, { status: 500 });
      return NextResponse.json({ fileUri });
    }

    return NextResponse.json({ ok: true, nextOffset: offset + chunkBuffer.byteLength });
  } catch (error) {
    console.error("[upload-chunk] 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "청크 업로드 오류" },
      { status: 500 }
    );
  }
}
