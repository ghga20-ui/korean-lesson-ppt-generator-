# 골든 렌더 하네스

생성된 `.pptx`를 **실제 PowerPoint로 렌더**해, 마커 도형이 글자에 제대로 붙었는지
픽셀로 검증한다. OfficeCLI(`npm i -g @officecli/officecli`)가 필요하다.

## 왜 필요한가

이 프로젝트의 기하 계산(`pptx-geometry.ts`)은 PowerPoint가 글자를 어디에 그릴지
**예측**한다. 그 예측이 맞는지 확인할 방법이 지금까지 없었다. 앱의 계산을 앱의
계산으로 검증하면 순환논증이다.

## 접두사 프로빙

대상 문자열의 x 구간을 PowerPoint에게 직접 물어본다.

1. 본문을 대상 **직전까지** 담은 슬라이드를 렌더한다.
2. 본문을 대상 **까지** 담은 슬라이드를 렌더한다.
3. 두 렌더의 글자 마스크를 차분한다. 남는 픽셀이 대상의 글자 상자다.

접두사가 진짜 접두사이므로 앞 글자들의 배치는 동일하다. 공백 폭을 추정할 필요가 없다.

## 사용

```bash
npm run dev                                  # 포트 확인
bash scripts/golden/render.sh case.json out 3000
python scripts/golden/measure.py out.png --mode marker
python scripts/golden/measure.py upto.png --mode target --prefix-png pre.png
python scripts/golden/sweep.py 3000 measurements.json    # 전체 스윕
```

## 한계

**OfficeCLI 네이티브 렌더는 옛한글 조합용 자모(U+1100 블록)의 OpenType shaping을
재현하지 못한다.** 실제 PowerPoint는 한컴산뜻돋움으로 옛한글을 정상 조합하지만,
이 렌더에서는 자모가 흩어진다. 옛한글 슬라이드를 이 하네스로 판정하지 말 것.
현대 한글과 라틴 문자의 기하 검증에만 쓴다.
