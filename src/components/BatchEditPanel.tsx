"use client";

import { useState, useCallback } from "react";
import type { MarkerType, Annotation } from "@/lib/types";

interface BatchEditPanelProps {
  annotations: Annotation[];
  onBatchUpdate: (updatedAnnotations: Annotation[]) => void;
}

export default function BatchEditPanel({ annotations, onBatchUpdate }: BatchEditPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === annotations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(annotations.map((a) => a.id)));
    }
  }, [annotations, selectedIds.size]);

  const applyColor = useCallback(
    (color: string) => {
      if (selectedIds.size === 0) return;
      const updated = annotations.map((a) =>
        selectedIds.has(a.id) ? { ...a, color } : a
      );
      onBatchUpdate(updated);
    },
    [annotations, selectedIds, onBatchUpdate]
  );

  const applyMarkerType = useCallback(
    (markerType: MarkerType) => {
      if (selectedIds.size === 0) return;
      const updated = annotations.map((a) =>
        selectedIds.has(a.id) ? { ...a, markerType } : a
      );
      onBatchUpdate(updated);
    },
    [annotations, selectedIds, onBatchUpdate]
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const updated = annotations.filter((a) => !selectedIds.has(a.id));
    onBatchUpdate(updated);
    setSelectedIds(new Set());
  }, [annotations, selectedIds, onBatchUpdate]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-[#CADCFC] px-3 py-1.5 text-xs text-[#1E2761] transition-colors hover:bg-[#CADCFC]/20"
      >
        일괄 편집
      </button>
    );
  }

  const PRESET_COLORS = ["#294C67", "#C44E4E", "#2B7A4B", "#7C4DFF", "#E67E22", "#2196F3"];
  const MARKER_TYPES: { value: MarkerType; label: string }[] = [
    { value: "underline", label: "밑줄" },
    { value: "circle", label: "원" },
    { value: "rectangle", label: "사각" },
    { value: "triangle", label: "세모" },
    { value: "bracket", label: "꺾쇠" },
  ];

  return (
    <div className="rounded-xl border border-[#CADCFC] bg-[#CADCFC]/10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#1E2761]">
          일괄 편집 ({selectedIds.size}/{annotations.length} 선택)
        </span>
        <button
          onClick={() => { setIsOpen(false); setSelectedIds(new Set()); }}
          className="text-xs text-[#1E2761]/50 hover:text-[#1E2761]"
        >
          닫기
        </button>
      </div>

      {/* Select all */}
      <div className="mb-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#1E2761]">
          <input
            type="checkbox"
            checked={selectedIds.size === annotations.length && annotations.length > 0}
            onChange={selectAll}
            className="h-3.5 w-3.5 rounded border-[#CADCFC] accent-[#1E2761]"
          />
          전체 선택
        </label>
      </div>

      {/* Individual checkboxes */}
      <div className="mb-3 flex max-h-28 flex-col gap-1 overflow-y-auto">
        {annotations.map((ann) => (
          <label
            key={ann.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-[#1E2761] hover:bg-white"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(ann.id)}
              onChange={() => toggleSelection(ann.id)}
              className="h-3 w-3 rounded border-[#CADCFC] accent-[#1E2761]"
            />
            <span className="truncate">&ldquo;{ann.targetText.slice(0, 15)}&rdquo; → {ann.content.slice(0, 15)}</span>
          </label>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-2 border-t border-[#CADCFC]/50 pt-2">
          {/* Color change */}
          <div>
            <span className="mb-1 block text-[10px] text-[#1E2761]/60">색상 변경</span>
            <div className="flex gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => applyColor(c)}
                  className="h-5 w-5 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110"
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Marker type change */}
          <div>
            <span className="mb-1 block text-[10px] text-[#1E2761]/60">마커 변경</span>
            <div className="flex flex-wrap gap-1">
              {MARKER_TYPES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => applyMarkerType(m.value)}
                  className="rounded border border-[#CADCFC] px-2 py-0.5 text-[10px] text-[#1E2761] transition-colors hover:bg-white"
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={deleteSelected}
            className="mt-1 self-start rounded bg-red-50 px-2.5 py-1 text-[10px] font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            선택 삭제 ({selectedIds.size}개)
          </button>
        </div>
      )}
    </div>
  );
}
