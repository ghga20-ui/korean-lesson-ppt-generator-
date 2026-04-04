import { NextRequest, NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

export async function POST(request: NextRequest) {
  try {
    // pathname을 서버에서 결정 (클라이언트 제공 파일명은 sanitize 불필요)
    const body = await request.json().catch(() => ({}));
    const ext = String(body.ext || "pdf").replace(/[^a-z0-9]/gi, "");
    const pathname = `lit-ppt-${Date.now()}.${ext || "pdf"}`;

    // onUploadCompleted 없음 → Vercel CDN이 서버로 콜백하지 않음 → hang 없음
    // 기본 validUntil은 30초 — 업로드 시작 전에 만료되므로 명시적으로 10분으로 설정
    const token = await generateClientTokenFromReadWriteToken({
      pathname,
      addRandomSuffix: false,
      maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
      validUntil: Date.now() + 10 * 60 * 1000, // 10분
    });

    return NextResponse.json({ token, pathname });
  } catch (error) {
    console.error("[blob-token] 토큰 생성 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "토큰 생성 실패" },
      { status: 500 },
    );
  }
}
