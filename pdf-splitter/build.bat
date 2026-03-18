@echo off
echo === PDF 분할기 exe 빌드 ===
echo.

REM 의존성 설치
python -m pip install -r requirements.txt

echo.
echo 빌드 시작...
python -m PyInstaller --onefile --windowed --name "PDF분할기" --clean pdf_splitter.py

echo.
echo 빌드 완료! dist 폴더에서 PDF분할기.exe를 확인하세요.
pause
