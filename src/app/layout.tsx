import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 옛한글(아래아 등) 렌더링을 위한 폰트 — 직접 입력은 HWP 복붙으로 처리
const notoSerifKR = Noto_Serif_KR({
  variable: "--font-noto-serif-kr",
  weight: ["400", "500"],
  preload: false,
});

export const metadata: Metadata = {
  title: "국어 수업 슬라이드 제작 도구",
  description: "국어 수업 PPT를 자동으로 생성합니다",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerifKR.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
