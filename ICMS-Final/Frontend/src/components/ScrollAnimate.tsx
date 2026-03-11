import { useEffect, useRef } from "react";

interface Props {
  children: React.ReactNode;
  delay?: number;
}

export default function ScrollAnimate({ children, delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Minimal, premium style animation
    el.style.opacity = "0";
    el.style.transform = "translateY(45px) scale(.985)";
    el.style.transition =
      `opacity .55s ease-out ${delay}ms,
       transform .75s cubic-bezier(.22,.9,.3,1) ${delay}ms`;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.style.opacity = "1";
        el.style.transform = "translateY(0) scale(1)";
        observer.unobserve(el);
      }
    }, { threshold: 0.25 });

    observer.observe(el);
  }, [delay]);

  return <div ref={ref}>{children}</div>;
}