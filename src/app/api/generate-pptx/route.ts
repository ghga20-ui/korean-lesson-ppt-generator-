import { NextRequest, NextResponse } from "next/server";
import { SlideData, Genre, PptSettings, DEFAULT_POETRY_SETTINGS, DEFAULT_NOVEL_SETTINGS } from "@/lib/types";
import { generatePptxBuffer } from "@/lib/pptx-generator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slides, genre, settings } = body as {
      slides: SlideData[];
      genre: Genre;
      settings?: PptSettings;
    };

    if (!slides || !genre) {
      return NextResponse.json(
        { error: "slides와 genre는 필수입니다." },
        { status: 400 }
      );
    }

    if (slides.length === 0) {
      return NextResponse.json(
        { error: "슬라이드가 비어 있습니다." },
        { status: 400 }
      );
    }

    const resolvedSettings = settings ?? (genre === "poetry" ? DEFAULT_POETRY_SETTINGS : DEFAULT_NOVEL_SETTINGS);

    const buffer = await generatePptxBuffer(slides, genre, resolvedSettings);

    // 직접 내비게이션·확장프로그램 경로에서도 파일명이 보존되도록 이중 안전벨트.
    // ASCII 폴백(filename)과 UTF-8 인코딩된 한글 파일명(filename*)을 함께 제공한다.
    const koreanFilename = `수업자료_${genre === "poetry" ? "운문" : "산문"}.pptx`;
    const contentDisposition =
      `attachment; filename="lesson.pptx"; filename*=UTF-8''${encodeURIComponent(koreanFilename)}`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (error) {
    console.error("PPT 생성 오류:", error);
    return NextResponse.json(
      { error: "PPT 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
