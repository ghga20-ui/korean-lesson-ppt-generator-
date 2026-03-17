import Link from "next/link";
import { AlignLeft, FileText, Sparkles } from "lucide-react";

const modes = [
  {
    key: "poetry",
    label: "운문 / 짧은 텍스트",
    subtitle: "시, 시조, 가사, 짧은 지문 등",
    icon: AlignLeft,
    description: "연·행 단위로 슬라이드를 분할합니다. 빈 줄로 연을 구분합니다.",
    href: "/editor?genre=poetry",
  },
  {
    key: "novel",
    label: "산문 / 긴 텍스트",
    subtitle: "소설, 수필, 비문학 지문 등",
    icon: FileText,
    description: "적정 분량으로 자동 분할합니다. 문장 경계에서 자연스럽게 나눕니다.",
    href: "/editor?genre=novel",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-[#CADCFC]/20 px-4">
      <div className="w-full max-w-3xl text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-[#1E2761]" />
          <h1 className="text-4xl font-bold tracking-tight text-[#1E2761]">
            국어 수업 PPT 생성기
          </h1>
        </div>
        <p className="mb-4 text-base text-[#1E2761]/70">
          교과서 PDF에서 주석을 추출하여 수업용 PPT를 자동 생성합니다
        </p>
        <div className="mb-12 flex flex-wrap items-center justify-center gap-2 text-xs text-[#1E2761]/50">
          <span className="rounded-full bg-[#CADCFC]/40 px-3 py-1">PDF OCR 추출</span>
          <span className="rounded-full bg-[#CADCFC]/40 px-3 py-1">클릭 애니메이션</span>
          <span className="rounded-full bg-[#CADCFC]/40 px-3 py-1">주석 자동 배치</span>
          <span className="rounded-full bg-[#CADCFC]/40 px-3 py-1">BYOK 지원</span>
        </div>

        <p className="mb-6 text-sm font-medium text-[#1E2761]/60">
          텍스트 유형을 선택하세요
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link
                key={mode.key}
                href={mode.href}
                className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-[#CADCFC] bg-white px-8 py-10 shadow-sm transition-all hover:border-[#1E2761] hover:shadow-lg"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#CADCFC]/50 transition-colors group-hover:bg-[#1E2761]">
                  <Icon className="h-7 w-7 text-[#1E2761] transition-colors group-hover:text-white" />
                </span>
                <h2 className="text-xl font-semibold text-[#1E2761]">
                  {mode.label}
                </h2>
                <p className="text-xs font-medium text-[#1E2761]/50">
                  {mode.subtitle}
                </p>
                <p className="text-sm leading-relaxed text-[#1E2761]/70">
                  {mode.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
