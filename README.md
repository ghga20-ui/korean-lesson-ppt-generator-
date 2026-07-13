# 밑줄쫙 — 국어 수업 슬라이드 제작 도구

**https://korean-ppt.vercel.app**

"밑줄 쫙, 별표 다섯 개" — 고등학교 국어 수업용 PPT 초안을 자동 생성하는 웹 애플리케이션입니다.  
교과서 본문을 붙여넣으면 슬라이드로 분할하고, 주석(밑줄·도형)과 클릭 애니메이션이 포함된 `.pptx` 파일을 생성합니다.

## 주요 기능

- **운문 / 산문 자동 분할**: 시는 연·행 단위, 소설은 글자 수 기준으로 슬라이드 자동 분할
- **주석 편집기**: 텍스트 선택 → 마커 유형(밑줄·원·사각형·세모·꺾쇠) + 색상 + 내용 설정
- **클릭 애니메이션**: 마커 도형 → 주석 텍스트 순서로 클릭할 때마다 등장
- **PDF 주석 추출**: 교사용 교과서 PDF에서 Gemini AI로 주석 자동 추출 (Mode A/C)
- **옛한글 지원**: 나눔바른고딕 옛한글 폰트 내장 — 아래아 포함 조합 음절 정상 렌더링
- **슬라이드 병합/분할**: 편집 중 슬라이드 합치거나 나누기 가능
- **실행 취소/다시 실행**: Ctrl+Z / Ctrl+Y
- **프로젝트 저장/불러오기**: JSON 파일로 작업 내용 보존

## 입력 모드

| 모드 | 설명 |
|------|------|
| **A — PDF 전체 추출** | 교사용 교과서 PDF에서 본문 + 주석 전부 추출 |
| **B — 직접 입력** | 본문 텍스트 직접 붙여넣기, 주석 수동 추가 |
| **C — 텍스트 + PDF 주석** | 본문은 직접 입력, 주석만 PDF에서 추출 (권장) |

## 기술 스택

- **Next.js** (App Router) + TypeScript
- **Tailwind CSS**
- **pptxgenjs** — PPTX 생성
- **pdf-lib** — PDF 페이지 처리
- **Gemini API** — PDF 주석 추출 (브라우저에서 본인 키로 직접 호출, BYOK)
- **나눔바른고딕 옛한글** — 옛한글 렌더링 폰트 (로컬 호스팅)
- **Vercel** — 배포

## 설치 및 실행

```bash
npm install
npm run dev
```

## API 키 (PDF 주석 추출용)

PDF 주석 추출(Mode A/C)은 본인의 Gemini API 키가 필요합니다 — 서버에 키를 두지 않는 BYOK 방식입니다.

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 무료 키 발급
2. 앱 입력 화면의 **키 설정** 버튼에 붙여넣기
3. 키는 브라우저(localStorage)에만 저장되며 서버로 전송되지 않습니다

키 설정 모달에서 **gemini-flash-latest**(기본값, 무료 키 권장)와 **gemini-3.1-pro-preview**(정밀, 유료 권장) 중 선택할 수 있습니다. PDF는 12MB 이상 업로드할 수 없으므로, 필요한 페이지 범위를 먼저 추출해 파일 크기를 줄여주세요.

> 직접 입력(Mode B)과 PPT 생성은 키 없이 사용할 수 있습니다.

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                # 홈 (텍스트 유형 선택)
│   ├── editor/page.tsx         # 에디터 페이지
│   └── api/
│       ├── generate-pptx/      # PPTX 생성
│       └── generate-html/      # HTML 프레젠테이션
├── components/
│   ├── AnnotateStep.tsx        # 슬라이드 목록 + 편집 레이아웃
│   ├── AnnotationEditor.tsx    # 주석 편집기 (선택·마커·순서·요약)
│   ├── ApiKeySettings.tsx      # Gemini API 키 입력/저장 모달
│   ├── BatchEditPanel.tsx      # 주석 일괄 편집
│   ├── InputStep.tsx           # 텍스트 입력 단계
│   ├── ModeSelector.tsx        # 입력 모드 선택
│   └── PdfUploader.tsx         # PDF 업로드 UI
├── hooks/
│   ├── useEditorState.ts       # 에디터 전체 상태 관리
│   ├── useHistory.ts           # 실행 취소/다시 실행
│   ├── useKeyboardShortcuts.ts # 단축키
│   └── usePanelResize.ts       # 패널 너비 드래그 조절
└── lib/
    ├── types.ts                # 타입 정의
    ├── pptx-generator.ts       # PPTX 생성 코어
    ├── pptx-geometry.ts        # 텍스트 위치·줄 계산
    ├── pptx-animation.ts       # 클릭 애니메이션 XML
    ├── pptx-constants.ts       # 폰트·슬라이드 상수
    ├── slide-splitter.ts       # 슬라이드 자동 분할
    ├── annotation-matcher.ts   # 주석↔텍스트 매칭
    ├── gemini-client.ts        # 브라우저에서 Gemini API 직접 호출 (BYOK)
    ├── api-key-storage.ts      # API 키·모델 localStorage 저장
    ├── gemini-models.ts        # 선택 가능한 Gemini 모델 목록
    └── font-metrics.ts         # 폰트 메트릭스 계산

NanumBarunGothicYetHangul/
└── NanumBarunGothic-YetHangul.otf   # 옛한글 지원 폰트
```

## 단축키

| 단축키 | 기능 |
|--------|------|
| `←` / `→` | 이전/다음 슬라이드 |
| `Ctrl+Z` | 실행 취소 |
| `Ctrl+Y` | 다시 실행 |
| `Ctrl+S` | 프로젝트 저장 (JSON) |
| `Ctrl+Enter` | PPT 생성 |

## 사용 시 참고

- 생성된 `.pptx`는 **초안**입니다. PowerPoint에서 열어 세부 조정 후 사용하세요.
- PPT 본문 폰트는 **한컴산뜻돋움 Bold**로 생성됩니다. 해당 폰트가 설치된 환경에서 열어야 레이아웃이 정확합니다.
- **옛한글 입력**: 브라우저 IME 한계로 직접 입력이 어렵습니다. HWP에서 작성 후 복사·붙여넣기 하세요.
