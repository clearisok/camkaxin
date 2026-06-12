import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'scheduling-session-panel-width';
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 280;
const MAX_WIDTH = 640;

function loadPanelWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(n)));
  } catch {
    return DEFAULT_WIDTH;
  }
}

function savePanelWidth(width: number) {
  localStorage.setItem(STORAGE_KEY, String(width));
}

export function useSchedulingSessionSplit(enabled: boolean) {
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
  const [resizing, setResizing] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(panelWidth);

  useEffect(() => {
    widthRef.current = panelWidth;
  }, [panelWidth]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!enabled || !resizing) return;

    const onMove = (e: MouseEvent) => {
      const layout = layoutRef.current;
      if (!layout) return;
      const rect = layout.getBoundingClientRect();
      const next = Math.round(rect.right - e.clientX);
      const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
      widthRef.current = clamped;
      setPanelWidth(clamped);
    };

    const onUp = () => {
      setResizing(false);
      savePanelWidth(widthRef.current);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [enabled, resizing]);

  return { panelWidth, resizing, layoutRef, startResize };
}
