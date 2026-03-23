import { useState, useRef, useCallback } from "react";

/**
 * 패널 너비를 마우스 드래그로 조절하는 훅.
 * @param defaultWidth 초기 너비(px)
 * @param min 최소 너비(px)
 * @param max 최대 너비(px)
 * @param direction "right" — 핸들이 패널 오른쪽(왼쪽 패널용), "left" — 핸들이 패널 왼쪽(오른쪽 패널용)
 */
export function usePanelResize(
  defaultWidth: number,
  min: number,
  max: number,
  direction: "right" | "left" = "right",
) {
  const [width, setWidth] = useState(defaultWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: width };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const raw = ev.clientX - dragRef.current.startX;
        const delta = direction === "left" ? -raw : raw;
        setWidth(Math.min(max, Math.max(min, dragRef.current.startWidth + delta)));
      };

      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width, min, max, direction],
  );

  return { width, startDrag };
}
