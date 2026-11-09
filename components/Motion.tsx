"use client";
// Landing-page motion (/ only). Each effect plays once, when its section scrolls into view.
// The server-rendered page is already the final state; under prefers-reduced-motion nothing here runs.
import { useEffect } from "react";

export function Motion() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const counters = [...document.querySelectorAll<HTMLElement>("main [data-count]")];
    for (const c of counters) c.textContent = "0";
    root.classList.add("js-motion");

    const countUp = (el: HTMLElement) => {
      const to = Number(el.dataset.count), t0 = performance.now(), ms = 700;
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        el.textContent = String(Math.round(to * k));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        io.unobserve(e.target);
        e.target.querySelectorAll<HTMLElement>("[data-count]").forEach((c) => setTimeout(() => countUp(c), 300));
      }
    }, { threshold: 0.15 });
    document.querySelectorAll("main .pp").forEach((s) => io.observe(s));

    return () => {
      io.disconnect();
      root.classList.remove("js-motion");
      for (const c of counters) c.textContent = c.dataset.count ?? c.textContent;
    };
  }, []);
  return null;
}
