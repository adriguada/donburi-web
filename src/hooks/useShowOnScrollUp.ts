import { useEffect, useState } from "react";

/**
 * Returns false while the user scrolls down the page and true when they
 * scroll up (or are at the top). Movements smaller than `threshold` px are
 * ignored so small jitters (e.g. touch scrolling) don't toggle it.
 */
export function useShowOnScrollUp(threshold = 8): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastY = Math.max(0, window.scrollY);
    let frame = 0;

    const update = () => {
      frame = 0;
      // Clamp: iOS rubber-band scrolling reports negative values at the top.
      const y = Math.max(0, window.scrollY);
      if (y === 0) {
        setVisible(true);
      } else if (y - lastY > threshold) {
        setVisible(false);
      } else if (lastY - y > threshold) {
        setVisible(true);
      } else {
        return; // Keep lastY so slow scrolling still adds up past the threshold.
      }
      lastY = y;
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return visible;
}
