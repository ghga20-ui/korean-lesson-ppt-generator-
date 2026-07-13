import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

// 확정 디자인: docs/mockups/home-chalkboard.html (판서 대비 C안)
// 칠판 히어로(before의 세계) 위에 흰 슬라이드 카드(after의 결과물)를 띄운다.

// desc는 의미 단위 2줄로 고정 개행 — 문장 중간 줄겹침 금지.
const FLOW_STEPS = [
  {
    n: "1",
    title: "본문 입력",
    desc: ["시·소설을 붙여넣거나 교사용 교과서 PDF 업로드", "연·문장 단위로 자동 분할"],
  },
  {
    n: "2",
    title: "주석 달기",
    desc: ["교사용 PDF에서 AI가 추출하거나 직접 달기", "편집 화면이 곧 실제 슬라이드"],
  },
  {
    n: "3",
    title: "PPT 내보내기",
    desc: ["클릭 애니메이션이 포함된 .pptx", "PowerPoint에서 바로 수업"],
  },
];

const CTA_BASE =
  "inline-flex items-center gap-2 rounded-lg border-[1.5px] border-[#F4F1E8] px-[22px] py-[13px] text-[15px] font-bold transition-opacity motion-reduce:transition-none focus-visible:[outline:3px_solid_#F0DC9E] focus-visible:outline-offset-2";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FBFAF7] text-[#16202B]">
      {/* ── 칠판 히어로 ─────────────────────────────────────── */}
      <div
        className="border-b-8 border-[#8A6B4D] pb-[72px] text-[#F4F1E8]"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 20% 10%, rgba(244,241,232,0.05), transparent), radial-gradient(ellipse 70% 50% at 85% 85%, rgba(244,241,232,0.04), transparent), #263A31",
        }}
      >
        <header className="mx-auto flex max-w-[1240px] items-baseline justify-between px-6 pt-[22px] min-[961px]:px-12">
          <p className="flex items-baseline gap-3">
            <BrandLogo size={30} tone="chalk" />
            <small className="text-xs font-normal text-[#C9CDBF]">
              국어 수업 슬라이드 제작 도구
            </small>
          </p>
          <p className="rounded-full border border-dashed border-[#F4F1E8]/40 px-2.5 py-[3px] text-xs text-[#C9CDBF]">
            무료 · 브라우저에서 바로
          </p>
        </header>

        <section className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-10 px-6 pt-10 min-[961px]:grid-cols-2 min-[961px]:gap-14 min-[961px]:px-12 min-[961px]:pt-16">
          {/* 좌: 카피 */}
          <div>
            <h1
              className="mb-[18px] text-balance font-display text-[clamp(30px,3.8vw,44px)] font-extrabold leading-[1.35] tracking-[-0.01em] text-[#F4F1E8]"
              style={{ textShadow: "0 0 14px rgba(244,241,232,0.25)" }}
            >
              오늘도 같은 판서를
              <br />
              다시 쓰고 계신가요?
              <br />
              <span className="text-[#F0DC9E]">한 번만 만들어 두세요.</span>
            </h1>
            {/* 부제는 판서처럼 의미 단위로 개행한다 — 문장 중간 줄겹침 금지. */}
            <p className="mb-[30px] break-keep text-base leading-[1.75] text-[#C9CDBF]">
              <span className="block">교과서 본문을 붙여넣으면 슬라이드가 되고,</span>
              <span className="block">
                교사용 PDF를 올리면{" "}
                <b className="font-bold text-[#F4F1E8]">AI가 주석까지 대신 답니다</b>.
              </span>
              <span className="block">
                수업에서는 클릭마다{" "}
                <b className="font-bold text-[#F4F1E8]">주석이 하나씩</b>.
              </span>
              <span className="block">로그인도 설치도 없습니다.</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/editor?genre=poetry"
                className={`${CTA_BASE} bg-[#F4F1E8] text-[#16202B] hover:opacity-90`}
              >
                운문으로 시작 <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/editor?genre=novel"
                className={`${CTA_BASE} bg-transparent text-[#F4F1E8] transition-colors hover:bg-[#F4F1E8]/10`}
              >
                산문으로 시작 <span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="mt-[14px] text-[13px] text-[#C9CDBF]/80">
              PDF 주석 추출은 본인 Gemini 키로 — 발급은 무료이고 1분이면 됩니다
            </p>
          </div>

          {/* 우: 칠판 위에 떠 있는 결과물 — 흰 슬라이드 카드 */}
          <div
            role="img"
            aria-label="완성된 수업 슬라이드 예시 — 진달래꽃 세 행에 밑줄·원 주석이 표시된 화면"
            className="relative aspect-[1333/750] rounded-md bg-white px-[8%] py-[7%] shadow-[0_30px_70px_rgba(0,0,0,0.45)]"
          >
            <span className="absolute -top-3 left-[22px] rounded-full bg-[#294C67] px-2.5 py-[3px] text-[11px] text-white">
              수업 화면 (.pptx)
            </span>
            <div className="text-[clamp(15px,1.9vw,23px)] font-bold leading-[2.1] tracking-[-0.01em] text-[#16202B]">
              <div className="relative whitespace-nowrap">
                나 보기가{" "}
                <span className="relative inline-block">
                  역겨워
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-[0.3em] h-[0.09em] rounded-[1px] bg-[#294C67]"
                  />
                  <span className="absolute top-full -mt-[0.55em] whitespace-nowrap text-[0.6em] font-bold leading-[1.1] text-[#294C67]">
                    반어 — 속마음은 반대
                  </span>
                </span>
              </div>
              <div className="relative whitespace-nowrap">
                가실{" "}
                <span className="relative inline-block">
                  때에는
                  <span
                    aria-hidden="true"
                    className="absolute inset-[0.08em_-0.14em_0.22em_-0.14em] rounded-full border-2 border-[#C0392B]"
                  />
                  <span className="absolute top-full -mt-[0.55em] whitespace-nowrap text-[0.6em] font-bold leading-[1.1] text-[#C0392B]">
                    이별의 상황 가정
                  </span>
                </span>{" "}
                말없이
              </div>
              <div className="relative whitespace-nowrap">고이 보내 드리오리다</div>
            </div>
            <span className="absolute bottom-2.5 right-3.5 text-[11px] text-[#6E7683]">
              클릭마다 주석이 하나씩 나타납니다
            </span>
          </div>
        </section>
      </div>

      {/* ── 칠판 아래: 교정지 톤 3단계 흐름 ──────────────────── */}
      <section className="mx-auto max-w-[1240px] px-6 pb-8 pt-9 min-[961px]:px-12 min-[961px]:pb-10 min-[961px]:pt-12">
        <ol className="grid grid-cols-1 gap-5 min-[721px]:grid-cols-3 min-[721px]:gap-8">
          {FLOW_STEPS.map((step) => (
            <li key={step.n} className="flex items-baseline gap-3.5">
              <span className="min-w-[22px] font-display text-[22px] font-extrabold text-[#294C67]">
                {step.n}
              </span>
              <div>
                <p className="mb-[3px] text-[15px] font-bold">{step.title}</p>
                <p className="break-keep text-[13.5px] text-[#5B6470]">
                  {step.desc.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="mx-auto max-w-[1240px] px-6 pb-10 text-[12.5px] text-[#6E7683] min-[961px]:px-12">
        생성 파일은 초안입니다 — PowerPoint에서 확인 후 수업에 쓰세요.
      </p>
    </div>
  );
}
