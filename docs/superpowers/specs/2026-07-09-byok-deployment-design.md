# BYOK 전환 + Vercel 무료 배포 설계

- 날짜: 2026-07-09
- 상태: 승인됨
- 목표: 서버 소유 Gemini API 키를 제거하고 사용자 개인 키(BYOK) 방식으로 전환한 뒤, 운영 비용 0원으로 공개 배포한다.

## 배경과 결정

| 항목 | 결정 |
|------|------|
| 대상 사용자 | 학교/커뮤니티에 공개 (불특정 다수 교사) |
| 현재 배포 | 없음 (로컬 전용, Railway·Cloud Run은 과거 시도 흔적) |
| 비용 제약 | 운영자 부담 0원 — API 비용은 각 사용자가 자기 키로 부담 |
| BYOK 방식 | **1안: 클라이언트 직접 호출** (브라우저 → Gemini 직행, 키가 서버를 경유하지 않음) |
| 호스팅 | **Vercel Hobby (무료)** — 비상업 무료 도구이므로 약관 적합 |
| 모델 정책 | Flash 기본 + Pro(gemini-3.1-pro-preview) 선택 |

### 대안 비교 (기각 사유)

- **2안 서버 릴레이 + Cloud Run**: 서버가 대용량 PDF(5MB+)와 최대 5분 요청을 계속 처리해야 하므로 Vercel 무료 불가. Cloud Run은 결제 계정 필수에 소액 과금 가능성, 사용자 키가 서버를 경유하는 신뢰 문제. 기각.
- **3안 완전 정적 사이트**: PPTX 생성까지 클라이언트로 옮기는 리팩터링이 현재 목표 대비 과함. 1안 이후 자연스러운 확장 방향으로 남겨둠.

## 아키텍처

```
[변경 전]  브라우저 ──PDF──▶ 서버(/api/extract, 서버 키) ──▶ Gemini
[변경 후]  브라우저 ──사용자 키 + PDF──────────────────▶ Gemini 직행
           브라우저 ──슬라이드 JSON──▶ Vercel(/api/generate-*) ──▶ PPTX/HTML
```

핵심: 무거운 작업(PDF 전송, 장시간 Gemini 대기)이 전부 브라우저↔Google 사이에서 일어나므로, Vercel 무료 티어의 제한(요청 바디 4.5MB, 함수 실행시간)이 애초에 걸리지 않는다.

### 코드 변경

**신규/이동**
- `src/lib/gemini-client.ts` (신규): `gemini-server.ts`의 추출 로직 전체 이동 — 프롬프트 3종(Mode A/C/Round2), 2라운드 검증, 타임아웃 110초, 타임아웃 1회 재시도, 429/401 에러 매핑. fetch 기반이므로 로직 변경 없이 이사.
  - `Buffer.from(...).toString("base64")` → 브라우저 API(`FileReader` 또는 `arrayBuffer` + btoa 계열)로 교체.
- `src/lib/gemini-file-upload.ts`: 서버 전용 가정 제거, 브라우저에서 사용자 키로 실행. (청크 업로드 경로는 기존 구현으로 검증됨)
- `src/lib/api-key-storage.ts` (신규): localStorage 키/모델 읽기·쓰기·검증 유틸.
- `src/components/ApiKeySettings.tsx` (신규): 키 입력 모달 + 발급 가이드 + 모델 선택.

**PDF 전송 분기** (gemini-client.ts 내부)
- 추출된 PDF ≤ 15MB → base64 인라인으로 `generateContent`에 포함 (Gemini 인라인 한도 20MB, 안전 마진 확보).
- \> 15MB → Gemini File API 업로드(세션 생성 → 청크 업로드 → ACTIVE 폴링) 후 fileUri 사용.

**삭제**
- `src/app/api/extract/route.ts`
- `src/app/api/start-file-upload/route.ts`
- `src/app/api/upload-pdf/route.ts`
- `src/lib/gemini-server.ts`
- `@vercel/blob` 의존성
- `.env.local`의 `GEMINI_API_KEY` 요구 자체가 사라짐

**유지 (변경 없음)**
- `/api/generate-pptx`, `/api/generate-html` — 키 무관, 몇 초짜리 작업
- `annotation-matcher`, `slide-splitter`, pptx 생성 계열 전부

**호출부 수정**
- `useEditorState.ts`의 `handleExtractAnnotations`/`handleExtractAll`: `fetch("/api/extract")` → `gemini-client.ts` 직접 호출. 진행 메시지/에러 alert 흐름은 유지.

## BYOK 키 UX

- 키 저장소: `localStorage` (예: `gemini-api-key`, `gemini-model`).
- 키가 필요한 기능은 **PDF 추출(Mode A/C)뿐**. Mode B(직접 입력)와 PPTX 생성은 키 없이 완전 동작 — 키 미보유 사용자도 앱 대부분을 쓸 수 있음을 UI에서 명확히 한다.
- Mode A/C 진입 시 키가 없으면 그 시점에 안내 배너 + 설정 모달 유도.
- 설정 모달 구성:
  1. 키 입력 필드 (붙여넣기, 마스킹 표시)
  2. 발급 가이드: Google AI Studio 링크 + 3단계 안내 (로그인 → API 키 만들기 → 복사)
  3. 모델 선택 드롭다운
  4. 프라이버시 문구: "키는 이 브라우저에만 저장되며 저희 서버로 전송되지 않습니다."
- 저장 시 검증: 가벼운 GET(모델 목록 조회 등)으로 즉시 유효성 확인, 실패 시 인라인 에러.

## 모델 정책

- 상수 파일에 2종 정의:
  - 기본: Flash 계열 최신 안정 모델 — 무료 티어 한도에 친화적. 정확한 모델명은 구현 시점에 확인 후 확정 (상수 한 줄).
  - 선택: `gemini-3.1-pro-preview` — 정밀 추출용, 유료 키 권장 라벨.
- 드롭다운 라벨 예: "빠름 · 무료 키 권장 (Flash)" / "정밀 · 유료 키 권장 (Pro)".
- 선택값은 localStorage 저장, 추출 호출 시 사용.

## 에러 처리

기존 서버 코드의 매핑을 클라이언트로 승계:

| 상황 | 처리 |
|------|------|
| 401/403 | "API 키가 유효하지 않습니다" + **설정 열기 버튼** |
| 429 | "무료 키 한도 초과 — 잠시 후 재시도하거나 Flash 모델을 사용하세요" |
| 타임아웃(110초) | 3초 후 1회 자동 재시도 (기존 로직 유지) |
| 네트워크/CORS 오류 | 연결 오류 안내 + 재시도 유도 |

2라운드 주석 검증(quickMatch → 미매칭 시 Round 2) 로직은 변경 없이 유지.

## 배포 (Vercel Hobby)

1. GitHub 저장소 `ghga20-ui/korean-lesson-ppt-generator-` 를 Vercel에 연결 (Import Project).
2. 프레임워크 자동 감지(Next.js), 환경변수 **설정 불필요** — 서버 키가 없으므로.
3. `main` 푸시 시 자동 배포, 기본 `*.vercel.app` 도메인 사용.
4. README 갱신: Railway/Cloud Run 언급 제거, BYOK 사용법·키 발급 안내 추가.
5. `docs/cloud-run-cli.md`, `scripts/deploy-cloud-run.ps1`, `.gcloudignore` 는 legacy 표시 또는 삭제.

## 검증 계획

1. **CORS 선행 검증 (구현 1단계)**: 브라우저에서 사용자 키로 ① `generateContent` 인라인 호출 ② File API 업로드 세션 생성 — 둘 다 되는지 확인.
   - ②가 CORS로 막히면: 인라인 20MB 제한으로 운영하고 File API 분기는 제거. 페이지 추출 기능 덕분에 실사용 PDF는 대부분 1~5MB라 커버 가능.
2. 로컬 E2E: 키 입력 → Mode C 추출 → 슬라이드 생성 → PPTX 다운로드.
3. 크기 분기: ~5MB(인라인), 15MB+(File API) 각 1회.
4. 키 없는 상태: Mode B + PPTX 생성이 완전 동작하는지.
5. 잘못된 키/429 시 에러 UX 확인.
6. Vercel 배포 후 프로덕션에서 2~4 재확인.

## 리스크

- **File API 브라우저 CORS 불허 가능성** (유일한 기술 리스크): 검증 계획 1의 폴백으로 흡수.
- **localStorage 키 보관**: XSS에 노출되면 키 유출 가능하나, 본 앱은 외부 사용자 콘텐츠를 렌더링하지 않아 표면이 작음. BYOK 도구의 표준 관행. 프라이버시 문구로 사용자에게 보관 위치를 고지.
- **Vercel Hobby 약관(비상업)**: 무료 교사 도구로 해당 없음. 추후 수익화 시 Pro 전환 필요.
