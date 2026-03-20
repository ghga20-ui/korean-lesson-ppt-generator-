# 국어 수업 PPT 생성기

교과서 PDF에서 주석을 추출하여 수업용 PPT를 자동 생성하는 웹 애플리케이션입니다.

## 주요 기능

- **PDF OCR 추출**: 교사용 교과서 PDF에서 주석/해설을 자동 추출 (Gemini AI)
- **3가지 입력 모드**:
  - **PDF 전체 추출 (A)**: PDF에서 텍스트 + 주석 모두 추출
  - **텍스트 + PDF 주석 (C)**: 텍스트 직접 입력 + PDF에서 주석만 추출 (권장)
  - **직접 입력 (B)**: 텍스트와 주석을 수동 입력
- **주석 편집기**: 마커 유형(밑줄, 원형, 사각형, 세모, 꺾쇠), 색상, 순서 편집
- **클릭 애니메이션**: PPT에서 클릭할 때마다 마커 → 주석 순서대로 등장
- **운문/산문 지원**: 시(연/행 단위 분할) / 소설(문장 경계 자동 분할)

## 기술 스택

- **Next.js 16** (App Router)
- **React 19** + TypeScript
- **Tailwind CSS 4**
- **pptxgenjs** (PPTX 생성)
- **pdf-lib** (PDF 페이지 추출)
- **Gemini API** (AI 주석 추출)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 환경 변수 설정
# .env.local 파일에 Gemini API 키 추가
echo "GEMINI_API_KEY=your-api-key-here" > .env.local

# 개발 서버 실행
npm run dev
```

http://localhost:3000 에서 접속합니다.

## 사용 방법

1. 홈페이지에서 **운문 / 산문** 텍스트 유형 선택
2. 입력 모드 선택 후 텍스트 입력 or PDF 업로드
3. **슬라이드 분할** → 자동으로 적정 분량 분할
4. 편집기에서 주석 확인/수정 (마커 유형, 색상, 순서 등)
5. **PPT 생성** → .pptx 파일 다운로드

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx              # 홈 (텍스트 유형 선택)
│   ├── editor/page.tsx       # 에디터 페이지
│   ├── api/
│   │   ├── extract/          # Gemini 추출 API
│   │   ├── generate-pptx/    # PPTX 생성 API
│   │   └── generate-html/    # HTML 프리젠테이션 API
│   └── globals.css
├── components/
│   ├── AnnotationEditor.tsx  # 주석 편집기
│   ├── AnnotateStep.tsx      # 편집 단계 UI
│   ├── InputStep.tsx         # 입력 단계 UI
│   ├── ModeSelector.tsx      # 입력 모드 선택
│   ├── PdfUploader.tsx       # PDF 업로드
│   └── ApiKeyInput.tsx       # API 키 입력
├── hooks/
│   └── useEditorState.ts     # 에디터 상태 관리
└── lib/
    ├── types.ts              # 타입 정의
    ├── pptx-generator.ts     # PPTX 생성 코어
    ├── pptx-geometry.ts      # 위치 계산
    ├── pptx-animation.ts     # 애니메이션 XML
    ├── pptx-constants.ts     # 상수 정의
    ├── slide-splitter.ts     # 슬라이드 분할
    ├── annotation-matcher.ts # 주석 매칭
    ├── html-generator.ts     # HTML 프리젠테이션
    ├── gemini.ts             # Gemini API (클라이언트)
    ├── gemini-server.ts      # Gemini API (서버)
    └── font-metrics.ts       # 폰트 메트릭스
```
