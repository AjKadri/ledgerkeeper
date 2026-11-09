"use client";
// Landing-page motion (/ only). Each effect plays once, when its section scrolls into view.
// The server-rendered page is already the final state; under prefers-reduced-motion nothing here runs.
import { useEffect } from "react";

export function Motion() {
  // Current section in the nav (not motion, so it also runs under reduced motion).
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const links = new Map([...document.querySelectorAll<HTMLAnchorElement>(".sitenav a[href^='#']")].map((a) => [a.hash.slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const a = links.get(e.target.id);
        if (!a) continue;
        if (e.isIntersecting) { links.forEach((l) => l.removeAttribute("aria-current")); a.setAttribute("aria-current", "true"); }
        else if (a.getAttribute("aria-current")) a.removeAttribute("aria-current");
      }
    }, { rootMargin: "-40% 0px -55% 0px" });
    links.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

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
