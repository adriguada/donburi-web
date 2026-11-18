import { useEffect, useState } from "react";

export interface ScrollHeaderState {
  /** False while the user scrolls down the page; true when they scroll up or are at the top. */
  visible: boolean;
  /** True only at the very top of the page (where the full-size header is shown). */
  atTop: boolean;
}

/** How close to the top (px) still counts as "at the top". */
const TOP_ZONE = 4;

/**
 * Tracks the scroll direction to hide the header while scrolling down and
 * show it again when scrolling up. Movements smaller than `threshold` px are
 * ignored so small jitters (e.g. touch scrolling) don't toggle it.
 */
export function useShowOnScrollUp(threshold = 8): ScrollHeaderState {
  const [state, setState] = useState<ScrollHeaderState>({ visible: true, atTop: true });

  useEffect(() => {
    let lastY = Math.max(0, window.scrollY);
    let frame = 0;

    const set = (visible: boolean, atTop: boolean) =>
      setState((prev) => (prev.visible === visible && prev.atTop === atTop ? prev : { visible, atTop }));

    const update = () => {
      frame = 0;
      // Clamp: iOS rubber-band scrolling reports negative values at the top.
      const y = Math.max(0, window.scrollY);
      const atTop = y <= TOP_ZONE;
      if (atTop) {
        set(true, true);
      } else if (y - lastY > threshold) {
        set(false, false);
      } else if (lastY - y > threshold) {
        set(true, false);
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

  return state;
}
