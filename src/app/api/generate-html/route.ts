import { NextRequest, NextResponse } from "next/server";
import { SlideData, Genre, PptSettings, DEFAULT_POETRY_SETTINGS, DEFAULT_NOVEL_SETTINGS } from "@/lib/types";
import { generateHtmlPresentation } from "@/lib/html-generator";

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
    const html = generateHtmlPresentation(slides, genre, resolvedSettings);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("HTML 생성 오류:", error);
    return NextResponse.json(
      { error: "HTML 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
