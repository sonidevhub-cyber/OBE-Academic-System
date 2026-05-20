import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";

export default function SmoothScroll() {
  useEffect(() => {
    console.log("🔥 Lenis Mounted");

    const lenis = new Lenis({
      duration: 1.4,
      lerp: 0.08,
      wheelMultiplier: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
    });

    // Attach globally for debugging
    // @ts-ignore
    window.lenis = lenis;

    console.log("🚀 Lenis initialized", lenis);

    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };

    requestAnimationFrame(raf);

    return () => {
      console.log("❌ Lenis destroyed");
      lenis.destroy();
    };
  }, []);

  return null;
}