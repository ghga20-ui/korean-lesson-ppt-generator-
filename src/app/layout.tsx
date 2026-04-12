import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 옛한글(아래아 포함 조합 음절) 지원 — OpenType 고자모 조합 테이블 포함
const nanumYetHangul = localFont({
  src: "../../NanumBarunGothicYetHangul/NanumBarunGothic-YetHangul.otf",
  variable: "--font-nanum-yet-hangul",
  display: "swap",
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
        className={`${geistSans.variable} ${geistMono.variable} ${nanumYetHangul.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
