"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Genre, SlideData, InputMode, ExtractedAnnotation, Annotation, PptSettings } from "@/lib/types";
import { DEFAULT_POETRY_SETTINGS, DEFAULT_NOVEL_SETTINGS } from "@/lib/types";
import { splitText, splitSlideAt, mergeSlides } from "@/lib/slide-splitter";
import { matchAnnotationsToText, distributeAnnotationsToSlides } from "@/lib/annotation-matcher";
import { useHistory } from "@/hooks/useHistory";

// ---------------------------------------------------------------------------
// Auto-save helpers
// ---------------------------------------------------------------------------

const SAVE_KEY = "lit-ppt-autosave";
const SAVE_DEBOUNCE_MS = 2000;

interface SavedProject {
  genre: Genre;
  fullText: string;
  slides: SlideData[];
  currentSlideIndex: number;
  savedAt: string;
}

function loadSavedProject(genre: Genre): SavedProject | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data: SavedProject = JSON.parse(raw);
    if (data.genre !== genre) return null;
    return data;
  } catch {
    return null;
  }
}

function saveProject(data: SavedProject): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage full — silently fail */ }
}

function clearSavedProject(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Export / import project as JSON file
// ---------------------------------------------------------------------------

function downloadJson(data: SavedProject): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `수업자료_${data.genre === "poetry" ? "운문" : "산문"}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function readJsonFile(file: File): Promise<SavedProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.genre || !data.slides) throw new Error("잘못된 프로젝트 파일");
        resolve(data as SavedProject);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// PDF → Gemini File API 업로드 (브라우저에서 직접 Google에 업로드)
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB (Vercel 4.5MB 한도 이하)

async function uploadPdfToGemini(
  file: File,
  onProgress: (msg: string) => void,
): Promise<string> {
  // 1. 서버에서 Gemini 업로드 세션 URL 발급 (API 키는 서버에서만 사용)
  onProgress("업로드 준비 중...");
  const initRes = await fetch("/api/start-file-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size: file.size }),
  });
  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(err.error || "업로드 초기화 실패");
  }
  const { uploadUrl } = await initRes.json();

  // 2. PDF를 3MB 청크로 나눠 서버에 전달 → 서버가 Gemini에 포워딩
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let offset = 0;

  for (let i = 0; i < totalChunks; i++) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const isLast = i === totalChunks - 1;
    onProgress(`PDF 업로드 중... (${i + 1}/${totalChunks})`);

    const formData = new FormData();
    formData.append("uploadUrl", uploadUrl);
    formData.append("offset", String(offset));
    formData.append("chunk", chunk);
    formData.append("isLast", String(isLast));

    const res = await fetch("/api/upload-chunk", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `청크 업로드 실패 (${i + 1}/${totalChunks})`);
    }
    const data = await res.json();
    if (isLast) return data.fileUri;
    offset = data.nextOffset;
  }

  throw new Error("파일 URI를 받지 못했습니다.");
}

// ---------------------------------------------------------------------------
// Hook interfaces
// ---------------------------------------------------------------------------

export interface EditorState {
  genre: Genre;
  step: "input" | "annotate";
  toast: string | null;
  fullText: string;
  slides: SlideData[];
  currentSlideIndex: number;
  isGenerating: boolean;
  clipboardAnnotation: Annotation | null;
  pptSettings: PptSettings;
  inputMode: InputMode;
  pdfFile: File | null;
  isExtracting: boolean;
  extractionProgress: string;
  unmatchedAnnotations: ExtractedAnnotation[];
  pendingUnmatched: ExtractedAnnotation | null;
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
}

export interface EditorActions {
  setStep: (step: "input" | "annotate") => void;
  showToast: (msg: string) => void;
  setFullText: (text: string) => void;
  setSlides: React.Dispatch<React.SetStateAction<SlideData[]>>;
  setCurrentSlideIndex: (index: number) => void;
  setInputMode: (mode: InputMode) => void;
  setPdfFile: (file: File | null) => void;
  setUnmatchedAnnotations: React.Dispatch<React.SetStateAction<ExtractedAnnotation[]>>;
  setPendingUnmatched: (ann: ExtractedAnnotation | null) => void;
  setPptSettings: React.Dispatch<React.SetStateAction<PptSettings>>;
  handleSplit: () => void;
  handleExtractAnnotations: () => Promise<void>;
  handleExtractAll: () => Promise<void>;
  handleUpdateSlide: (updatedSlide: SlideData) => void;
  handleSplitAt: (charIndex: number) => void;
  handleMergeNext: () => void;
  handleMergePrev: () => void;
  handleGenerate: () => Promise<void>;
  handleCutAnnotation: (annotation: Annotation) => void;
  handlePasteAnnotation: (startIndex: number, endIndex: number, targetText: string) => void;
  handleCancelPaste: () => void;
  handleAddUnmatched: (startIndex: number, endIndex: number, targetText: string) => void;
  handleCancelUnmatched: () => void;
  resetToInput: () => void;
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  // Save/Load
  exportProject: () => void;
  importProject: (file: File) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useEditorState(genre: Genre): EditorState & EditorActions {
  const [step, setStep] = useState<"input" | "annotate">("input");
  const [toast, setToast] = useState<string | null>(null);
  const [fullText, setFullText] = useState("");
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [clipboardAnnotation, setClipboardAnnotation] = useState<Annotation | null>(null);
  const [pptSettings, setPptSettings] = useState<PptSettings>(
    genre === "poetry" ? { ...DEFAULT_POETRY_SETTINGS } : { ...DEFAULT_NOVEL_SETTINGS }
  );
  const [inputMode, setInputMode] = useState<InputMode>("C");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState("");
  const [unmatchedAnnotations, setUnmatchedAnnotations] = useState<ExtractedAnnotation[]>([]);
  const [pendingUnmatched, setPendingUnmatched] = useState<ExtractedAnnotation | null>(null);

  // Undo/Redo for slides
  const history = useHistory<SlideData[]>([]);

  // ---- Auto-save --------------------------------------------------------
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step !== "annotate" || slides.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProject({ genre, fullText, slides, currentSlideIndex, savedAt: new Date().toISOString() });
    }, SAVE_DEBOUNCE_MS);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [slides, currentSlideIndex, step, genre, fullText]);

  // ---- Restore on mount --------------------------------------------------
  useEffect(() => {
    const saved = loadSavedProject(genre);
    if (saved && saved.slides.length > 0) {
      const shouldRestore = window.confirm("이전 작업이 저장되어 있습니다. 복원하시겠습니까?");
      if (shouldRestore) {
        setFullText(saved.fullText);
        setSlides(saved.slides);
        setCurrentSlideIndex(saved.currentSlideIndex);
        history.reset(saved.slides);
        setStep("annotate");
      } else {
        clearSavedProject();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Helper: update slides with history tracking
  const updateSlidesWithHistory = useCallback((newSlides: SlideData[]) => {
    history.push(newSlides);
    setSlides(newSlides);
  }, [history]);

  const handleSplit = useCallback(() => {
    if (!fullText.trim()) return;
    const result = splitText(fullText, genre, pptSettings);
    setSlides(result);
    history.reset(result);
    setCurrentSlideIndex(0);
    setStep("annotate");
  }, [fullText, genre, pptSettings, history]);

  const handleExtractAnnotations = useCallback(async () => {
    if (!pdfFile || !fullText.trim()) return;
    setIsExtracting(true);
    setExtractionProgress("PDF를 AI에 전송 중...");
    setUnmatchedAnnotations([]);

    try {
      const fileUri = await uploadPdfToGemini(pdfFile, setExtractionProgress);

      setExtractionProgress("AI 분석 중...");
      const formData = new FormData();
      formData.append("fileUri", fileUri);
      formData.append("mode", "C");
      formData.append("genre", genre);
      formData.append("userText", fullText);

      const response = await fetch("/api/extract", { method: "POST", body: formData });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        let msg = `오류 (HTTP ${response.status})`;
        try { msg = JSON.parse(text).error || msg; } catch { msg = text.slice(0, 200) || msg; }
        throw new Error(msg);
      }
      const result = await response.json();
      setExtractionProgress("본문과 주석 매칭 중...");
      const { matched, unmatched } = matchAnnotationsToText(fullText, result.annotations);
      if (unmatched.length > 0) setUnmatchedAnnotations(unmatched);

      const summaryBreaks = matched
        .filter(a => a.markerType === "summary")
        .map(a => { const nl = fullText.indexOf("\n", a.endIndex); return nl !== -1 ? nl + 1 : fullText.length; });

      setExtractionProgress("슬라이드로 분할 중...");
      const splitSlides = splitText(fullText, genre, pptSettings, summaryBreaks);
      const slidesWithAnnotations = distributeAnnotationsToSlides(fullText, splitSlides, matched);

      setSlides(slidesWithAnnotations);
      history.reset(slidesWithAnnotations);
      setCurrentSlideIndex(0);
      setStep("annotate");
    } catch (error) {
      alert(error instanceof Error ? error.message : "주석 추출 중 오류가 발생했습니다");
    } finally {
      setIsExtracting(false);
      setExtractionProgress("");
    }
  }, [pdfFile, fullText, genre, pptSettings, history]);

  const handleExtractAll = useCallback(async () => {
    if (!pdfFile) return;
    setIsExtracting(true);
    setExtractionProgress("PDF를 AI에 전송 중...");
    setUnmatchedAnnotations([]);

    try {
      const fileUri = await uploadPdfToGemini(pdfFile, setExtractionProgress);

      setExtractionProgress("AI 분석 중...");
      const formData = new FormData();
      formData.append("fileUri", fileUri);
      formData.append("mode", "A");
      formData.append("genre", genre);

      const response = await fetch("/api/extract", { method: "POST", body: formData });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        let msg = `오류 (HTTP ${response.status})`;
        try { msg = JSON.parse(text).error || msg; } catch { msg = text.slice(0, 200) || msg; }
        throw new Error(msg);
      }
      const result = await response.json();
      setFullText(result.text);

      if (result.annotations.length > 0) {
        setExtractionProgress("본문과 주석 매칭 중...");
        const { matched, unmatched } = matchAnnotationsToText(result.text, result.annotations);
        if (unmatched.length > 0) setUnmatchedAnnotations(unmatched);

        const summaryBreaks = matched
          .filter(a => a.markerType === "summary")
          .map(a => { const nl = result.text.indexOf("\n", a.endIndex); return nl !== -1 ? nl + 1 : result.text.length; });

        setExtractionProgress("슬라이드로 분할 중...");
        const splitSlides2 = splitText(result.text, genre, pptSettings, summaryBreaks);
        const slidesWithAnnotations = distributeAnnotationsToSlides(result.text, splitSlides2, matched);

        setSlides(slidesWithAnnotations);
        history.reset(slidesWithAnnotations);
        setCurrentSlideIndex(0);
        setStep("annotate");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "PDF 추출 중 오류가 발생했습니다");
    } finally {
      setIsExtracting(false);
      setExtractionProgress("");
    }
  }, [pdfFile, genre, pptSettings, history]);

  const handleUpdateSlide = useCallback(
    (updatedSlide: SlideData) => {
      setSlides((prev) => {
        const next = prev.map((s) => (s.id === updatedSlide.id ? updatedSlide : s));
        history.push(next);
        return next;
      });
    },
    [history]
  );

  const handleSplitAt = useCallback(
    (charIndex: number) => {
      setSlides((prev) => {
        const next = splitSlideAt(prev, currentSlideIndex, charIndex);
        history.push(next);
        return next;
      });
    },
    [currentSlideIndex, history]
  );

  const handleMergeNext = useCallback(() => {
    setSlides((prev) => {
      const next = mergeSlides(prev, currentSlideIndex);
      history.push(next);
      return next;
    });
  }, [currentSlideIndex, history]);

  const handleMergePrev = useCallback(() => {
    if (currentSlideIndex === 0) return;
    setSlides((prev) => {
      const next = mergeSlides(prev, currentSlideIndex - 1);
      history.push(next);
      return next;
    });
    setCurrentSlideIndex(currentSlideIndex - 1);
  }, [currentSlideIndex, history]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, fullText, slides, settings: pptSettings }),
      });
      if (!response.ok) throw new Error("PPT 생성에 실패했습니다");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `수업자료_${genre === "poetry" ? "운문" : "산문"}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("PPT 파일이 다운로드되었습니다");
    } catch (error) {
      alert(error instanceof Error ? error.message : "PPT 생성 중 오류가 발생했습니다");
    } finally {
      setIsGenerating(false);
    }
  }, [genre, fullText, slides, pptSettings, showToast]);

  const handleCutAnnotation = useCallback((annotation: Annotation) => {
    setClipboardAnnotation(annotation);
    setSlides((prev) => {
      const next = prev.map((s) =>
        s.id === slides[currentSlideIndex]?.id
          ? { ...s, annotations: s.annotations.filter((a) => a.id !== annotation.id) }
          : s
      );
      history.push(next);
      return next;
    });
  }, [slides, currentSlideIndex, history]);

  const handlePasteAnnotation = useCallback(
    (startIndex: number, endIndex: number, targetText: string) => {
      if (!clipboardAnnotation) return;
      const cs = slides[currentSlideIndex];
      if (!cs) return;
      const nextOrder = cs.annotations.length > 0 ? Math.max(...cs.annotations.map((a) => a.order)) + 1 : 1;
      const newAnn: Annotation = {
        ...clipboardAnnotation,
        id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
        startIndex, endIndex, targetText, order: nextOrder,
      };
      setSlides((prev) => {
        const next = prev.map((s) => s.id === cs.id ? { ...s, annotations: [...s.annotations, newAnn] } : s);
        history.push(next);
        return next;
      });
      setClipboardAnnotation(null);
    },
    [clipboardAnnotation, slides, currentSlideIndex, history]
  );

  const handleCancelPaste = useCallback(() => { setClipboardAnnotation(null); }, []);

  const handleAddUnmatched = useCallback(
    (startIndex: number, endIndex: number, targetText: string) => {
      if (!pendingUnmatched) return;
      const cs = slides[currentSlideIndex];
      if (!cs) return;
      const nextOrder = cs.annotations.length > 0 ? Math.max(...cs.annotations.map((a) => a.order)) + 1 : 1;
      const newAnn: Annotation = {
        id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
        startIndex, endIndex, targetText,
        content: pendingUnmatched.content, markerType: pendingUnmatched.markerType,
        order: nextOrder, color: "#294C67",
      };
      setSlides((prev) => {
        const next = prev.map((s) => s.id === cs.id ? { ...s, annotations: [...s.annotations, newAnn] } : s);
        history.push(next);
        return next;
      });
      setUnmatchedAnnotations((prev) => prev.filter((ua) => ua !== pendingUnmatched));
      setPendingUnmatched(null);
    },
    [pendingUnmatched, slides, currentSlideIndex, history]
  );

  const handleCancelUnmatched = useCallback(() => { setPendingUnmatched(null); }, []);

  const resetToInput = useCallback(() => {
    setStep("input");
    setSlides([]);
    history.reset([]);
    setCurrentSlideIndex(0);
    setUnmatchedAnnotations([]);
    clearSavedProject();
  }, [history]);

  // ---- Undo / Redo -------------------------------------------------------
  const undo = useCallback(() => {
    const prev = history.undo();
    if (prev) {
      setSlides(prev);
      showToast("실행 취소");
    }
  }, [history, showToast]);

  const redo = useCallback(() => {
    const next = history.redo();
    if (next) {
      setSlides(next);
      showToast("다시 실행");
    }
  }, [history, showToast]);

  // ---- Export / Import ---------------------------------------------------
  const exportProject = useCallback(() => {
    downloadJson({ genre, fullText, slides, currentSlideIndex, savedAt: new Date().toISOString() });
    showToast("프로젝트가 저장되었습니다");
  }, [genre, fullText, slides, currentSlideIndex, showToast]);

  const importProject = useCallback(async (file: File) => {
    try {
      const data = await readJsonFile(file);
      setFullText(data.fullText);
      setSlides(data.slides);
      history.reset(data.slides);
      setCurrentSlideIndex(data.currentSlideIndex || 0);
      setStep("annotate");
      showToast("프로젝트를 불러왔습니다");
    } catch {
      alert("잘못된 프로젝트 파일입니다.");
    }
  }, [history, showToast]);

  return {
    // State
    genre, step, toast, fullText, slides, currentSlideIndex, isGenerating,
    clipboardAnnotation, pptSettings, inputMode, pdfFile, isExtracting,
    extractionProgress, unmatchedAnnotations, pendingUnmatched,
    canUndo: history.canUndo, canRedo: history.canRedo,
    // Actions
    setStep, showToast, setFullText, setSlides, setCurrentSlideIndex,
    setInputMode, setPdfFile, setUnmatchedAnnotations, setPendingUnmatched,
    setPptSettings, handleSplit, handleExtractAnnotations, handleExtractAll,
    handleUpdateSlide, handleSplitAt, handleMergeNext, handleMergePrev, handleGenerate,
    handleCutAnnotation, handlePasteAnnotation, handleCancelPaste,
    handleAddUnmatched, handleCancelUnmatched, resetToInput,
    undo, redo, exportProject, importProject,
  };
}
