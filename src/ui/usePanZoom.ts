import { useState, useCallback, useRef } from 'react';

export interface UsePanZoomOptions {
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
}

export interface UsePanZoomReturn {
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  mode: 'select' | 'pan';
  setMode: (mode: 'select' | 'pan') => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitView: () => void;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  handleWheel: (e: React.WheelEvent<Element>) => void;
  startPan: (clientX: number, clientY: number) => void;
  updatePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
  handleTouchStart: (e: React.TouchEvent<Element>) => void;
  handleTouchMove: (e: React.TouchEvent<Element>) => void;
  handleTouchEnd: (e: React.TouchEvent<Element>) => void;
}

/**
 * Reusable hook for high-performance 2D CAD canvas navigation:
 * - Zoom in / Zoom out / Fit view / Reset 1:1
 * - Focal wheel zoom centered around mouse cursor
 * - Drag-to-pan using middle-mouse button, spacebar+drag, or drag mode
 * - Multi-touch pinch-to-zoom and two-finger pan for mobile devices
 */
export function usePanZoom(options: UsePanZoomOptions = {}): UsePanZoomReturn {
  const {
    initialZoom = 1.0,
    minZoom = 0.25,
    maxZoom = 8.0,
    zoomStep = 1.25,
  } = options;

  const [zoom, setZoom] = useState<number>(initialZoom);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [mode, setMode] = useState<'select' | 'pan'>('select');

  const startDragRef = useRef<{ clientX: number; clientY: number; startPanX: number; startPanY: number } | null>(null);
  const pinchRef = useRef<{ dist: number; startZoom: number; center: { x: number; y: number }; startPan: { x: number; y: number } } | null>(null);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(maxZoom, Math.round(z * zoomStep * 100) / 100));
  }, [maxZoom, zoomStep]);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(minZoom, Math.round((z / zoomStep) * 100) / 100));
  }, [minZoom, zoomStep]);

  const resetView = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  const fitView = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  // Handle wheel zoom centered around cursor
  const handleWheel = useCallback(
    (e: React.WheelEvent<Element>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? zoomStep : 1 / zoomStep;

      setZoom((prevZoom) => {
        const nextZoom = Math.max(minZoom, Math.min(maxZoom, Math.round(prevZoom * factor * 100) / 100));
        if (nextZoom === prevZoom) return prevZoom;

        // Shift pan so that point under cursor remains unchanged
        setPan((prevPan) => {
          const scaleChange = nextZoom / prevZoom;
          const newPanX = cursorX - (cursorX - prevPan.x) * scaleChange;
          const newPanY = cursorY - (cursorY - prevPan.y) * scaleChange;
          return {
            x: Math.round(newPanX * 10) / 10,
            y: Math.round(newPanY * 10) / 10,
          };
        });

        return nextZoom;
      });
    },
    [minZoom, maxZoom, zoomStep],
  );

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      setIsPanning(true);
      startDragRef.current = {
        clientX,
        clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    },
    [pan],
  );

  const updatePan = useCallback(
    (clientX: number, clientY: number) => {
      if (!startDragRef.current) return;
      const dx = clientX - startDragRef.current.clientX;
      const dy = clientY - startDragRef.current.clientY;
      setPan({
        x: Math.round((startDragRef.current.startPanX + dx) * 10) / 10,
        y: Math.round((startDragRef.current.startPanY + dy) * 10) / 10,
      });
    },
    [],
  );

  const endPan = useCallback(() => {
    setIsPanning(false);
    startDragRef.current = null;
  }, []);

  // Multi-touch pinch-to-zoom and pan for mobile devices
  const handleTouchStart = useCallback((e: React.TouchEvent<Element>) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0]!;
      const t2 = e.touches[1]!;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const centerY = (t1.clientY + t2.clientY) / 2 - rect.top;

      pinchRef.current = {
        dist,
        startZoom: zoom,
        center: { x: centerX, y: centerY },
        startPan: { ...pan },
      };
    }
  }, [zoom, pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent<Element>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const t1 = e.touches[0]!;
      const t2 = e.touches[1]!;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scale = dist / pinchRef.current.dist;

      const nextZoom = Math.max(minZoom, Math.min(maxZoom, Math.round(pinchRef.current.startZoom * scale * 100) / 100));
      setZoom(nextZoom);

      const scaleChange = nextZoom / pinchRef.current.startZoom;
      const { center, startPan: sp } = pinchRef.current;
      const newPanX = center.x - (center.x - sp.x) * scaleChange;
      const newPanY = center.y - (center.y - sp.y) * scaleChange;

      setPan({
        x: Math.round(newPanX * 10) / 10,
        y: Math.round(newPanY * 10) / 10,
      });
    }
  }, [minZoom, maxZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<Element>) => {
    if (e.touches.length < 2) {
      pinchRef.current = null;
    }
  }, []);

  return {
    zoom,
    pan,
    isPanning,
    mode,
    setMode,
    zoomIn,
    zoomOut,
    resetView,
    fitView,
    setZoom,
    setPan,
    handleWheel,
    startPan,
    updatePan,
    endPan,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
