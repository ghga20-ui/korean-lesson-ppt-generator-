import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "저작권·이용 안내 — 밑줄쫙",
  description: "교과서·지도서 이용의 법적 근거와 이 도구의 무저장 구조 안내",
};

// 교정지 톤의 문서 페이지. 본문은 문서이므로 자연 문단, 소제목은 명조.
export default function NoticePage() {
  return (
    <div className="min-h-screen bg-[#FBFAF7] text-[#16202B]">
      <div className="mx-auto max-w-[720px] px-6 py-12">
        <Link
          href="/"
          className="text-sm text-[#5B6470] transition-colors hover:text-[#294C67]"
        >
          ← 처음으로
        </Link>

        <h1 className="mt-6 font-display text-[32px] font-extrabold leading-snug">
          저작권·이용 안내
        </h1>
        <p className="mt-2 text-sm text-[#6E7683]">
          2026년 7월 기준 · 이 문서는 법률 자문이 아닌 서비스 이용 안내입니다
        </p>

        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold">
            이 도구는 학교 수업을 전제로 합니다
          </h2>
          <p className="mt-3 leading-relaxed text-[#3d4753]">
            밑줄쫙은 초·중·고등학교 교사가 <b>자신의 수업</b>에 쓸 화면을
            만드는 도구입니다. 교과서 본문과 교사용 지도서의 해설은 각각
            작가와 출판사의 저작물이지만, 저작권법 제25조(학교교육 목적
            등에의 이용)는 학교의 수업 목적에 한해 공표된 저작물의 일부분을
            허락 없이 복제·배포·공연·전시·공중송신할 수 있도록 허용하며,
            고등학교 이하의 학교에서는 보상금도 면제됩니다.
          </p>
          <p className="mt-3 leading-relaxed text-[#3d4753]">
            즉, 교사가 지도서에서 주석을 추출해 자기 교실 화면에 띄우는 것은
            법이 예정하고 있는 이용입니다.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold">
            하지 말아야 할 것
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-[#3d4753]">
            <li>
              생성한 PPT를 <b>수업 밖으로 배포·공유·판매</b>하는 것 — 교사
              커뮤니티 업로드, 블로그 게시, 자료 판매 등은 제25조의 보호를
              받지 못하며 저작권 침해가 될 수 있습니다.
            </li>
            <li>
              <b>학교가 아닌 곳</b>(학원 등)에서의 사용 — 제25조는 학교
              교육기관에만 적용됩니다.
            </li>
            <li>
              저작물의 <b>전부</b>를 통째로 옮기는 것 — 허용되는 범위는
              수업에 필요한 &ldquo;일부분&rdquo;입니다.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold">
            선생님의 자료는 어디에 있나요
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-[#3d4753]">
            <li>
              올리신 PDF는 <b>이 서비스의 서버에 오지 않습니다.</b> 브라우저에서
              선생님 본인의 Gemini 키로 Google에 직접 전송되어 주석만
              추출됩니다.
            </li>
            <li>
              작업 중인 슬라이드·주석은 <b>선생님 브라우저 안</b>(localStorage)에만
              저장됩니다. 계정도, 서버 보관도, 공유 기능도 없습니다.
            </li>
            <li>
              Gemini <b>무료 티어</b>는 Google 정책상 입력 데이터가 모델 개선에
              활용될 수 있습니다. 민감한 자료라면 유료 티어 키 사용을
              권합니다.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold">더 확실히 하려면</h2>
          <p className="mt-3 leading-relaxed text-[#3d4753]">
            저작권 관련 판단이 필요한 경우 한국저작권위원회 상담센터
            (1800-5455, <a className="text-[#294C67] underline" href="https://www.copyright.or.kr" target="_blank" rel="noreferrer">copyright.or.kr</a>)에서
            무료 법률상담을 받을 수 있습니다.
          </p>
        </section>

        <footer className="mt-14 border-t border-[#E4E1DA] pt-6 text-sm text-[#6E7683]">
          <p>© 2026 밑줄쫙 · 만든이 박세준</p>
          <p className="mt-1">
            고등학교 국어 수업을 위해 만들었습니다. 생성 파일은 초안입니다 —
            PowerPoint에서 확인 후 수업에 쓰세요.
          </p>
        </footer>
      </div>
    </div>
  );
}
