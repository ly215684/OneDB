import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook to enable drag-to-scroll on a container element.
 * Click and drag to scroll horizontally and vertically.
 */
export function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollLeft = useRef(0);
  const scrollTop = useRef(0);

  const onMouseDown = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    // Only activate on left mouse button
    if (e.button !== 0) return;
    isDragging.current = true;
    startX.current = e.clientX;
    startY.current = e.clientY;
    scrollLeft.current = el.scrollLeft;
    scrollTop.current = el.scrollTop;
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !ref.current) return;
    e.preventDefault();
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    ref.current.scrollLeft = scrollLeft.current - dx;
    ref.current.scrollTop = scrollTop.current - dy;
  }, []);

  const onMouseUp = useCallback(() => {
    if (!ref.current) return;
    isDragging.current = false;
    ref.current.style.cursor = '';
    ref.current.style.userSelect = '';
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseDown, onMouseMove, onMouseUp]);

  return ref;
}
