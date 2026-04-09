import Link from "next/link";
import { Icon } from "@/components/Icon";

type Slide = {
  number: string;
  title: string;
  keyMessage: string | null;
  items: string[];
};

const SLIDES: Slide[] = [
  {
    number: "01",
    title: "표지",
    keyMessage: null,
    items: ["AI로 만드는 문학 수업 PPT", "수업 준비 시간을 절반으로 줄이는 자동화 도구"],
  },
  {
    number: "02",
    title: "공감: 이런 경험 있으신가요?",
    keyMessage: "문학 수업 PPT 만드는 일, 너무 오래 걸린다",
    items: [
      "시 한 편을 슬라이드로 옮기는 데 30분~1시간",
      "연 구분, 글자 크기, 줄 간격, 밑줄·동그라미 주석...",
      "작품이 바뀌면 처음부터 다시",
    ],
  },
  {
    number: "03",
    title: "문제 정의",
    keyMessage: "반복 노동 vs. 수업의 본질",
    items: [
      "교사가 써야 할 시간: 작품 해석, 발문 구성, 학생 피드백",
      "실제로 쓰는 시간: PPT 레이아웃 작업",
      "구조화 가능한 작업은 자동화할 수 있다",
    ],
  },
  {
    number: "04",
    title: "도구 소개",
    keyMessage: "문학 수업 PPT 자동 생성기란?",
    items: [
      "웹 브라우저에서 작품 텍스트를 입력하면",
      "수업에 바로 쓸 수 있는 .pptx 파일을 자동 생성",
      "별도 설치 없음, 인터넷만 있으면 사용 가능",
    ],
  },
  {
    number: "05",
    title: "핵심 기능 ①: 시 슬라이드",
    keyMessage: "시는 연(stanza) 단위로 자동 분할",
    items: [
      "연 구분을 인식해 슬라이드별 4~5행 배치",
      "글자 크기 40pt, 줄 간격 자동 계산 (주석 공간 확보)",
      "한컴산뜻돋움 폰트 고정으로 교과서 느낌 유지",
    ],
  },
  {
    number: "06",
    title: "핵심 기능 ②: 소설 슬라이드",
    keyMessage: "소설은 슬라이드 용량 기준으로 자동 분할",
    items: [
      "문단 단위가 아닌 글자 수·줄 수 계산으로 최적 분할",
      "긴 인용문도 잘림 없이 자연스럽게 넘김",
    ],
  },
  {
    number: "07",
    title: "핵심 기능 ③: 주석 애니메이션",
    keyMessage: "클릭 한 번으로 밑줄·동그라미·강조 박스 등장",
    items: [
      "수업 중 클릭 시 주석이 순서대로 나타남",
      "밑줄 / 원 / 사각형 도형 + 텍스트 상자",
      "학생의 시선을 유도하는 수업 흐름 설계 가능",
    ],
  },
  {
    number: "08",
    title: "사용 흐름 (데모)",
    keyMessage: "입력 → 생성 → 다운로드, 3단계",
    items: [
      "① 작품 제목·본문 텍스트 입력",
      "② 주석 내용 입력 (선택)",
      "③ PPT 파일 즉시 다운로드",
    ],
  },
  {
    number: "09",
    title: "실제 결과물 비교",
    keyMessage: "수동 제작 vs. 자동 생성 결과물",
    items: [
      "좌: 기존 수작업 PPT / 우: 자동 생성 PPT",
      "품질 차이 없음, 제작 시간 대폭 단축",
    ],
  },
  {
    number: "10",
    title: "기술 배경 (간략)",
    keyMessage: "교사가 직접 만든, 교사를 위한 도구",
    items: [
      "Next.js + Vercel (웹 배포)",
      "Gemini AI (텍스트 처리)",
      "pptxgenjs (PPT 생성 엔진)",
      "고교학점제 행정 + 수업 준비를 직접 겪으며 개발",
    ],
  },
  {
    number: "11",
    title: "앞으로의 계획",
    keyMessage: "더 많은 교과, 더 많은 교사에게",
    items: [
      "PDF 교과서에서 작품 자동 추출 기능 (Mode A/C)",
      "문항 출제 도구, 선택과목 상담 AI 챗봇으로 확장 예정",
      "필요하신 분께 사용 링크 공유 가능",
    ],
  },
  {
    number: "12",
    title: "마무리",
    keyMessage: "수업 준비의 반복 노동에서 해방을",
    items: [
      '"교사의 에너지는 학생을 향해야 한다"',
      "질문·사용 문의 환영",
    ],
  },
];

const FEATURES = [
  { icon: "auto_awesome_mosaic" as const, label: "연·문장 단위 자동 분할" },
  { icon: "ink_highlighter" as const, label: "밑줄·원·사각형 주석 도형" },
  { icon: "animation" as const, label: "클릭 애니메이션 자동 적용" },
  { icon: "document_scanner" as const, label: "PDF 주석 OCR 추출" },
];

const STEPS = [
  { label: "텍스트 입력", desc: "시·소설 본문을 붙여넣거나 PDF에서 추출" },
  { label: "주석 달기", desc: "슬라이드별로 밑줄·도형·설명을 추가" },
  { label: "PPT 저장", desc: "클릭 애니메이션이 포함된 .pptx 다운로드" },
];

const MODES = [
  {
    key: "poetry",
    icon: "format_align_left" as const,
    label: "운문 / 짧은 텍스트",
    subtitle: "시 · 시조 · 가사 · 짧은 지문",
    desc: "연·행 단위로 슬라이드를 분할합니다. 빈 줄로 연을 구분합니다.",
    href: "/editor?genre=poetry",
  },
  {
    key: "novel",
    icon: "menu_book" as const,
    label: "산문 / 긴 텍스트",
    subtitle: "소설 · 수필 · 비문학 지문",
    desc: "적정 분량으로 자동 분할합니다. 문장 경계에서 자연스럽게 나눕니다.",
    href: "/editor?genre=novel",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen w-screen overflow-x-hidden bg-gradient-to-br from-white to-[#FFF0E4]">
      {/* Hero section: existing 2-col grid, keeps h-screen */}
      <div
        className="grid h-screen w-full border-b border-[#EEDDD0]"
        style={{ gridTemplateColumns: "2fr 3fr" }}
      >
      {/* LEFT */}
      <div className="flex flex-col justify-center gap-9 border-r border-[#EEDDD0] px-14 py-16">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-[#A07050] p-3 text-white">
            <Icon name="draw" size={28} />
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#6B3F26]">
            국어 수업 슬라이드 제작 도구
          </h1>
        </div>

        {/* Description */}
        <p className="text-lg leading-relaxed text-[#8B6040]">
          교과서 본문 텍스트를 붙여넣고 주석을 달면<br />
          수업용 PPT 초안을 빠르게 만들 수 있습니다.
        </p>

        {/* Features */}
        <ul className="flex flex-col gap-3.5">
          {FEATURES.map((f) => (
            <li key={f.icon} className="flex items-center gap-3 text-base text-[#7A5540]">
              <Icon name={f.icon} size={20} className="shrink-0 text-[#A07050]" />
              {f.label}
            </li>
          ))}
        </ul>

        {/* Steps */}
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#A07050]/60">
            사용 흐름
          </p>
          <ol className="flex flex-col">
            {STEPS.map((step, i) => (
              <li key={i} className="relative flex gap-4">
                {i < STEPS.length - 1 && (
                  <span className="absolute left-[13px] top-7 h-full w-px bg-[#EEDDD0]" />
                )}
                <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#A07050] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="pb-5">
                  <p className="text-base font-semibold text-[#6B3F26]">{step.label}</p>
                  <p className="text-sm leading-relaxed text-[#B09070]">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex flex-col justify-center gap-6 bg-white px-16 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#A07050]/50">
          텍스트 유형 선택
        </p>

        {MODES.map((mode) => (
          <Link
            key={mode.key}
            href={mode.href}
            className="group flex flex-col gap-4 rounded-2xl border border-[#EEDDD0] bg-[#FFFBF8] p-8 transition-all hover:-translate-y-0.5 hover:border-[#A07050]/50 hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <span className="flex shrink-0 items-center justify-center rounded-xl bg-[#F5E8DC] p-3 text-[#A07050] transition-colors group-hover:bg-[#A07050] group-hover:text-white">
                <Icon name={mode.icon} size={28} />
              </span>
              <div>
                <h2 className="text-xl font-bold text-[#6B3F26]">{mode.label}</h2>
                <p className="text-sm text-[#C4A898]">{mode.subtitle}</p>
              </div>
            </div>
            <p className="text-base leading-relaxed text-[#9B7060]">{mode.desc}</p>
            <span className="flex items-center gap-1 self-end text-sm font-medium text-[#A07050] opacity-30 transition-all group-hover:translate-x-1 group-hover:opacity-100">
              시작하기 <Icon name="arrow_forward" size={16} />
            </span>
          </Link>
        ))}

        <p className="text-center text-sm text-[#D4B8A8]">
          유형을 선택하면 편집 화면으로 이동합니다.
        </p>

        <p className="rounded-xl border border-[#EEDDD0] bg-[#FFF8F4] px-5 py-3 text-center text-xs leading-relaxed text-[#B09070]">
          생성된 파일은 <strong className="font-semibold text-[#8B6040]">초안</strong>입니다.
          폰트 설치 여부·레이아웃 세부 조정은 PowerPoint에서 직접 확인 후 사용하세요.
        </p>
      </div>
      </div>
      {/* ── 발표 자료 상세 섹션 ── */}
      <section className="w-full bg-white px-4 py-16 sm:px-8 sm:py-20 lg:px-16">
        {/* 섹션 헤더 */}
        <div className="mb-4 flex items-center gap-2">
          <span className="h-px flex-1 bg-[#EEDDD0]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#A07050]/60">
            발표 자료 구성
          </span>
          <span className="h-px flex-1 bg-[#EEDDD0]" />
        </div>
        <h2 className="mb-3 text-center text-2xl font-extrabold tracking-tight text-[#6B3F26]">
          교사 연수 발표 슬라이드 (12장)
        </h2>
        <p className="mb-12 text-center text-sm leading-relaxed text-[#B09070]">
          대상: 고등학교 국어·문학 교과 교사 · 형식: 15~20분 발표
        </p>

        {/* 슬라이드 카드 그리드 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SLIDES.map((slide) => (
            <div
              key={slide.number}
              className="flex flex-col gap-3 rounded-2xl border border-[#EEDDD0] bg-[#FFFBF8] p-6"
            >
              {/* 번호 + 제목 */}
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#A07050] text-xs font-bold text-white">
                  {slide.number}
                </span>
                <h3 className="pt-0.5 text-base font-bold leading-snug text-[#6B3F26]">
                  {slide.title}
                </h3>
              </div>

              {/* 핵심 메시지 */}
              {slide.keyMessage && (
                <p className="rounded-lg bg-[#FFF0E4] px-3 py-2 text-xs font-semibold leading-relaxed text-[#8B5E3C]">
                  {slide.keyMessage}
                </p>
              )}

              {/* 내용 목록 */}
              <ul className="flex flex-col gap-1.5">
                {slide.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed text-[#9B7060]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#EEDDD0]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 발표 흐름 요약 바 */}
        <div className="mt-14 rounded-2xl border border-[#EEDDD0] bg-[#FFF8F4] px-8 py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#A07050]/60">
            발표 흐름
          </p>
          <p className="text-sm leading-relaxed text-[#8B6040]">
            공감(02~03) → 솔루션 소개(04) → 기능 설명(05~07) → 데모(08~09) → 배경/미래(10~11) → 마무리(12)
          </p>
        </div>
      </section>
    </div>
  );
}
