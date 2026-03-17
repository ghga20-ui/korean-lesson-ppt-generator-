# Annotation Editing Features

## Context

에디터에서 주석을 추가한 후 수정하는 과정이 불편하다:
- ▲/▼ 순서 변경 버튼이 너무 작고 hover해야만 보여서 존재를 모르는 사용자가 있음
- Gemini가 주석을 잘못된 슬라이드에 배치하면 삭제 후 수동 재입력해야 함
- 타겟 텍스트가 잘못되면 삭제 후 재추가해야 함

## Requirements

1. **▲/▼ 버튼 가시성 개선**: 크기 키우기, 항상 보이게
2. **잘라내기/붙여넣기로 슬라이드 간 이동**: clipboard 방식
3. **타겟 텍스트 변경**: 주석 내용 유지, 타겟만 재선택

## Design

### 1. 버튼 가시성 개선 (`AnnotationEditor.tsx`)

현재: `opacity-0 group-hover:opacity-100`, `text-[10px]`

변경:
- `opacity-0` 제거 → 항상 보임
- 크기: `text-[10px]` → `text-xs`
- ▲/▼/삭제 + 새 버튼(잘라내기, 타겟변경)을 주석 항목 하단에 한 줄로 배치
- 아이콘+텍스트 라벨로 명확하게

### 2. 잘라내기/붙여넣기 (`AnnotationEditor.tsx` + `editor/page.tsx`)

**상태 (EditorInner 레벨):**
```typescript
const [clipboardAnnotation, setClipboardAnnotation] = useState<Annotation | null>(null);
```

EditorInner → AnnotationEditor로 props 전달:
- `clipboardAnnotation: Annotation | null`
- `onCutAnnotation: (annotation: Annotation) => void`
- `onPasteAnnotation: (startIndex: number, endIndex: number, targetText: string) => void`

**잘라내기 흐름:**
1. 주석 항목에 ✂️ 버튼 클릭
2. `onCutAnnotation(ann)` → 부모에서 clipboard에 저장 + 현재 슬라이드에서 해당 주석 제거

**붙여넣기 흐름:**
1. clipboard에 주석이 있으면 주석 목록 상단에 "📋 붙여넣기 대기 중" 배너 표시
2. 본문에서 텍스트 드래그 선택
3. 기존 팝업 대신 "여기에 붙여넣기" 버튼이 나타남
4. 클릭 시 `onPasteAnnotation(startIndex, endIndex, selectedText)` → 부모에서 clipboard 주석의 내용/색상/마커타입 + 새 위치로 주석 생성

### 3. 타겟 텍스트 변경 (`AnnotationEditor.tsx`)

**상태:**
```typescript
const [retargetingId, setRetargetingId] = useState<string | null>(null);
```

**흐름:**
1. 주석 항목에 🎯 버튼 클릭 → `retargetingId` 설정
2. 본문 영역 상단에 "새 타겟 텍스트를 선택하세요" 안내 배너
3. 텍스트 드래그 선택 시: 기존 팝업 대신 즉시 타겟 업데이트
4. `startIndex`, `endIndex`, `targetText` 변경, 나머지 유지
5. `retargetingId` 초기화

**기존 handleTextSelection 분기:**
```
텍스트 선택 감지 →
  retargetingId가 있으면 → 타겟 변경 실행
  clipboardAnnotation이 있으면 → 붙여넣기 팝업
  그 외 → 기존 주석 추가 팝업
```

### 4. 영향 범위

| 파일 | 변경 |
|------|------|
| `src/components/AnnotationEditor.tsx` | 버튼 스타일, 잘라내기/타겟변경 UI, 텍스트선택 분기 |
| `src/app/editor/page.tsx` | clipboardAnnotation 상태, onCut/onPaste 핸들러 전달 |

## Verification

1. ▲/▼ 버튼이 hover 없이 보이고 클릭하기 쉬운 크기인지 확인
2. 주석 잘라내기 → 다른 슬라이드에서 텍스트 선택 → 붙여넣기 → 주석 이동 확인
3. 타겟 변경 → 주석 내용/색상/마커 유지, 타겟만 변경 확인
4. 기존 주석 추가 플로우가 영향받지 않는지 확인
