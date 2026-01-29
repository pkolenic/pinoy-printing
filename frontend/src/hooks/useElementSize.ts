import { useState, useLayoutEffect, useRef } from 'react';

export const useElementSize = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setSize({
          width: entry.contentRect.width,
          height: entry.target.getBoundingClientRect().height,
        });
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
};
