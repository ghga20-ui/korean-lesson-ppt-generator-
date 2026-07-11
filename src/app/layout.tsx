import type { Metadata } from "next";
import { Geist_Mono, Nanum_Myeongjo } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 홈 헤드라인·단계 번호용 명조 — next/font가 한국어 글리프를 unicode-range
// 슬라이스로 자동 분할·셀프호스팅하므로 모든 방문자에게 동일하게 보인다.
const nanumMyeongjo = Nanum_Myeongjo({
  weight: ["700", "800"],
  subsets: ["latin"],
  variable: "--font-nanum-myeongjo",
  display: "swap",
});

// 옛한글(아래아 포함 조합 음절) 지원 — OpenType 고자모 조합 테이블 포함
const nanumYetHangul = localFont({
  src: "../../NanumBarunGothicYetHangul/NanumBarunGothic-YetHangul.otf",
  variable: "--font-nanum-yet-hangul",
  display: "swap",
});

export const metadata: Metadata = {
  title: "밑줄쫙 — 국어 수업 슬라이드 제작 도구",
  description:
    "교과서 본문을 붙여넣고 주석을 달면, 클릭마다 하나씩 나타나는 수업용 PPT가 됩니다",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* 본문 UI 폰트 — Pretendard 동적 서브셋(jsdelivr). 차단 환경에서는 맑은 고딕으로 폴백 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body
        className={`${geistMono.variable} ${nanumMyeongjo.variable} ${nanumYetHangul.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
