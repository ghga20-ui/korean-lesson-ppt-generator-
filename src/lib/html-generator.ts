import type {
  Annotation,
  Genre,
  SlideData,
  PptSettings,
} from "./types";
import { DEFAULT_POETRY_SETTINGS, DEFAULT_NOVEL_SETTINGS } from "./types";

// ---------------------------------------------------------------------------
// Constants (matching PPT style)
// ---------------------------------------------------------------------------

const MARKER_COLOR = "#294C67";
const MAIN_TEXT_COLOR = "#222222";
const SUMMARY_BG = "#E8EFF5";
const SUMMARY_BORDER = "#294C67";

// ---------------------------------------------------------------------------
// Text segmentation
// ---------------------------------------------------------------------------

interface TextSegment {
  text: string;
  annotation: Annotation | null;
}

function segmentText(text: string, annotations: Annotation[]): TextSegment[] {
  if (annotations.length === 0) {
    return [{ text, annotation: null }];
  }

  const sorted = [...annotations]
    .filter((a) => a.markerType !== "summary")
    .sort((a, b) => a.startIndex - b.startIndex || a.order - b.order);

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const ann of sorted) {
    const start = Math.max(ann.startIndex, cursor);
    const end = Math.min(ann.endIndex, text.length);
    if (start >= end) continue;

    if (cursor < start) {
      segments.push({ text: text.slice(cursor, start), annotation: null });
    }
    segments.push({ text: text.slice(start, end), annotation: ann });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), annotation: null });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

// ---------------------------------------------------------------------------
// Build a single slide's HTML
// ---------------------------------------------------------------------------

function buildSlideHtml(slide: SlideData, settings: PptSettings, slideIndex: number): string {
  const sortedAnnotations = [...slide.annotations].sort(
    (a, b) => a.order - b.order,
  );

  const segments = segmentText(slide.text, sortedAnnotations);
  const summaries = sortedAnnotations.filter((a) => a.markerType === "summary");

  // step index per slide: marker at even (0,2,4...), annotation text at odd (1,3,5...)
  let stepIndex = 0;
  const mainTextParts: string[] = [];

  for (const seg of segments) {
    if (!seg.annotation) {
      mainTextParts.push(textToHtml(seg.text));
      continue;
    }

    const ann = seg.annotation;
    const markerStep = stepIndex;
    const annotStep = stepIndex + 1;
    stepIndex += 2;

    // Annotation text element (absolutely positioned below target)
    const annTextHtml =
      `<span class="ann-text step" data-step="${annotStep}">` +
        escapeHtml(ann.content) +
      `</span>`;

    if (ann.markerType === "circle" || ann.markerType === "triangle") {
      const svgShape = ann.markerType === "circle"
        ? `<ellipse cx="50%" cy="50%" rx="49%" ry="45%" />`
        : `<polygon points="50,2 2,98 98,98" />`;

      mainTextParts.push(
        `<span class="ann-wrap step" data-step="${markerStep}" data-marker="${ann.markerType}" style="--ann-color:${ann.color}">` +
          textToHtml(seg.text) +
          `<svg class="marker-svg marker-svg-${ann.markerType}" viewBox="0 0 100 100" preserveAspectRatio="none">` +
            svgShape +
          `</svg>` +
          annTextHtml +
        `</span>`,
      );
    } else {
      mainTextParts.push(
        `<span class="ann-wrap step" data-step="${markerStep}" data-marker="${ann.markerType}" style="--ann-color:${ann.color}">` +
          textToHtml(seg.text) +
          annTextHtml +
        `</span>`,
      );
    }
  }

  // Summary boxes (last steps)
  let summaryHtml = "";
  for (const sum of summaries) {
    summaryHtml +=
      `  <div class="summary step" data-step="${stepIndex}" style="--ann-color:${sum.color}">` +
        `<span class="summary-icon">▶</span> ${escapeHtml(sum.content)}` +
      `</div>\n`;
    stepIndex++;
  }

  // HTML needs wider line spacing than PPT to fit annotation text in the gap.
  // Gap = fontSize × (lineHeight - 1) must be > annotationFontSize + padding
  const minLineHeight = 1 + (settings.annotationFontSize + 20) / settings.fontSize;
  const htmlLineHeight = Math.max(settings.lineSpacing, minLineHeight).toFixed(2);

  return (
    `<div class="slide" data-slide="${slideIndex}" data-steps="${stepIndex}">\n` +
    `  <div class="main-text" style="font-size:${settings.fontSize}pt; line-height:${htmlLineHeight};">\n` +
    `    ${mainTextParts.join("")}\n` +
    `  </div>\n` +
    summaryHtml +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

function getCustomCss(settings: PptSettings): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }

    /* Slide container */
    .slides-viewport {
      width: 100vw; height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: #000;
    }
    .slide {
      display: none;
      width: ${settings.slideWidth}in;
      height: ${settings.slideHeight}in;
      background: #fff;
      padding: 0.35in 0.5in;
      position: relative;
      overflow: hidden;
      /* Scale to fit viewport */
      transform-origin: center center;
    }
    .slide.active { display: block; }

    /* Main text */
    .main-text {
      color: ${MAIN_TEXT_COLOR};
      font-family: '${settings.fontFamily}', '맑은 고딕', sans-serif;
      font-weight: bold;
      word-break: keep-all;
      overflow-wrap: break-word;
    }

    /* ---- Step animation: hidden until .shown ---- */
    .step { /* marker effects start hidden; text always visible via .ann-wrap */ }

    /* ---- Annotation wrapper: text always visible ---- */
    .ann-wrap {
      position: relative;
      display: inline;
    }

    /* Underline */
    .ann-wrap[data-marker="underline"] {
      border-bottom: 3px solid transparent;
      transition: border-color 0.15s;
    }
    .ann-wrap[data-marker="underline"].shown {
      border-bottom-color: var(--ann-color, ${MARKER_COLOR});
    }

    /* Rectangle */
    .ann-wrap[data-marker="rectangle"] {
      border: 3px solid transparent;
      border-radius: 2px;
      padding: 0 2px;
      transition: border-color 0.15s;
    }
    .ann-wrap[data-marker="rectangle"].shown {
      border-color: var(--ann-color, ${MARKER_COLOR});
    }

    /* Bracket — ::before is absolute so it doesn't push text right */
    .ann-wrap[data-marker="bracket"]::before {
      content: "「";
      color: var(--ann-color, ${MARKER_COLOR});
      font-weight: bold;
      font-size: 1em;
      position: absolute;
      left: -0.7em;
      top: -0.1em;
      visibility: hidden;
    }
    .ann-wrap[data-marker="bracket"]::after {
      content: "」";
      color: var(--ann-color, ${MARKER_COLOR});
      font-weight: bold;
      font-size: 1em;
      position: relative;
      top: 0.15em;
      visibility: hidden;
    }
    .ann-wrap[data-marker="bracket"].shown::before,
    .ann-wrap[data-marker="bracket"].shown::after {
      visibility: visible;
    }

    /* Circle / Triangle SVG overlay */
    .marker-svg {
      position: absolute;
      left: -4px; top: -4px;
      width: calc(100% + 8px);
      height: calc(100% + 8px);
      pointer-events: none;
      fill: none;
      stroke: var(--ann-color, ${MARKER_COLOR});
      stroke-width: 2.5;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .marker-svg-triangle {
      left: -6px; top: -6px;
      width: calc(100% + 12px);
      height: calc(100% + 12px);
    }
    .ann-wrap.shown .marker-svg { opacity: 1; }

    /* ---- Annotation text (between lines, below target) ---- */
    .ann-text {
      position: absolute;
      left: 0;
      /* Use pt (not em) so it's relative to main text size, not annotation size */
      top: ${Math.round(settings.fontSize * 1.1)}pt;
      color: var(--ann-color, ${MARKER_COLOR});
      font-family: '${settings.fontFamily}', '맑은 고딕', sans-serif;
      font-weight: bold;
      font-size: ${settings.annotationFontSize}pt;
      white-space: nowrap;
      z-index: 10;
      pointer-events: none;
      visibility: hidden;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .ann-text.shown {
      visibility: visible;
      opacity: 1;
    }

    /* ---- Summary box ---- */
    .summary {
      position: absolute;
      bottom: 0.2in; left: 0.5in; right: 0.5in;
      background: ${SUMMARY_BG};
      border: 2px solid var(--ann-color, ${SUMMARY_BORDER});
      border-radius: 6px;
      padding: 0.4em 0.8em;
      font-family: '${settings.fontFamily}', '맑은 고딕', sans-serif;
      font-weight: bold;
      font-size: ${settings.annotationFontSize}pt;
      color: var(--ann-color, ${SUMMARY_BORDER});
      visibility: hidden;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .summary.shown { visibility: visible; opacity: 1; }
    .summary-icon { margin-right: 0.3em; }

    /* ---- Navigation controls ---- */
    .nav-bar {
      position: fixed;
      bottom: 12px; left: 50%;
      transform: translateX(-50%);
      display: flex; align-items: center; gap: 12px;
      background: rgba(0,0,0,0.6);
      padding: 6px 16px;
      border-radius: 20px;
      z-index: 100;
      user-select: none;
    }
    .nav-bar button {
      background: none; border: none; color: #fff;
      font-size: 18px; cursor: pointer; padding: 4px 8px;
      border-radius: 4px;
    }
    .nav-bar button:hover { background: rgba(255,255,255,0.2); }
    .nav-bar button:disabled { opacity: 0.3; cursor: default; }
    .nav-bar .slide-num {
      color: #fff; font-size: 13px; min-width: 60px; text-align: center;
    }
    .nav-bar .fs-btn { font-size: 14px; }

    /* ---- Progress bar ---- */
    .progress-bar {
      position: fixed;
      bottom: 0; left: 0;
      height: 3px;
      background: ${MARKER_COLOR};
      transition: width 0.2s;
      z-index: 100;
    }
  `;
}

// ---------------------------------------------------------------------------
// Presentation JavaScript (pure, no dependencies)
// ---------------------------------------------------------------------------

function getPresentationJs(): string {
  return `
(function() {
  const slides = document.querySelectorAll('.slide');
  const totalSlides = slides.length;
  let currentSlide = 0;
  let currentStep = -1; // -1 = no steps shown yet

  const numEl = document.getElementById('slide-num');
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const progressBar = document.getElementById('progress-bar');

  function getMaxSteps() {
    return parseInt(slides[currentSlide].dataset.steps || '0', 10);
  }

  function showSlide(index) {
    slides.forEach((s, i) => s.classList.toggle('active', i === index));
    currentSlide = index;
    currentStep = -1;
    // Reset all steps in this slide
    slides[index].querySelectorAll('.step').forEach(el => el.classList.remove('shown'));
    updateUI();
    fitSlide();
  }

  function advance() {
    const maxSteps = getMaxSteps();
    if (currentStep < maxSteps - 1) {
      currentStep++;
      const els = slides[currentSlide].querySelectorAll('[data-step="' + currentStep + '"]');
      els.forEach(el => el.classList.add('shown'));
      updateUI();
    } else if (currentSlide < totalSlides - 1) {
      showSlide(currentSlide + 1);
    }
  }

  function retreat() {
    if (currentStep >= 0) {
      const els = slides[currentSlide].querySelectorAll('[data-step="' + currentStep + '"]');
      els.forEach(el => el.classList.remove('shown'));
      currentStep--;
      updateUI();
    } else if (currentSlide > 0) {
      showSlide(currentSlide - 1);
      // Show all steps of the previous slide
      const maxSteps = getMaxSteps();
      for (let i = 0; i < maxSteps; i++) {
        currentStep = i;
        slides[currentSlide].querySelectorAll('[data-step="' + i + '"]')
          .forEach(el => el.classList.add('shown'));
      }
      updateUI();
    }
  }

  function updateUI() {
    numEl.textContent = (currentSlide + 1) + ' / ' + totalSlides;
    prevBtn.disabled = currentSlide === 0 && currentStep < 0;
    const progress = ((currentSlide + 1) / totalSlides) * 100;
    progressBar.style.width = progress + '%';
  }

  function fitSlide() {
    const slide = slides[currentSlide];
    if (!slide) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sw = slide.offsetWidth;
    const sh = slide.offsetHeight;
    const scale = Math.min(vw / sw, vh / sh, 1);
    slide.style.transform = 'scale(' + scale + ')';
  }

  // Event listeners
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
    if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); retreat(); }
    if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    }
  });

  document.addEventListener('click', function(e) {
    if (e.target.closest('.nav-bar')) return;
    advance();
  });

  nextBtn.addEventListener('click', function(e) { e.stopPropagation(); advance(); });
  prevBtn.addEventListener('click', function(e) { e.stopPropagation(); retreat(); });
  document.getElementById('btn-fs').addEventListener('click', function(e) {
    e.stopPropagation();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  });

  window.addEventListener('resize', fitSlide);

  // Init
  showSlide(0);
})();
  `;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateHtmlPresentation(
  slides: SlideData[],
  genre: Genre,
  settings?: PptSettings,
): string {
  const s = settings ??
    (genre === "poetry" ? DEFAULT_POETRY_SETTINGS : DEFAULT_NOVEL_SETTINGS);

  const customCss = getCustomCss(s);
  const slidesHtml = slides
    .map((slide, i) => buildSlideHtml(slide, s, i))
    .join("\n");
  const presentationJs = getPresentationJs();

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>수업 자료 — ${genre === "poetry" ? "운문" : "산문"}</title>
<style>
${customCss}
</style>
</head>
<body>
<div class="slides-viewport">
${slidesHtml}
</div>

<div class="nav-bar">
  <button id="btn-prev" title="이전 (←)">◀</button>
  <span id="slide-num" class="slide-num">1 / 1</span>
  <button id="btn-next" title="다음 (→ / Space)">▶</button>
  <button id="btn-fs" class="fs-btn" title="전체화면 (F)">⛶</button>
</div>
<div id="progress-bar" class="progress-bar"></div>

<script>
${presentationJs}
</script>
</body>
</html>`;
}
