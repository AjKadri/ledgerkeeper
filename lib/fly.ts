// The filing motion: a clone of a card shrinks and flies to its place in the drawer (Web Animations API, no library).
// Resolves when the flight ends. With reduced motion, or if either end is missing, it resolves at once.
import { prefersReducedMotion } from "./format";

export function fly(src: HTMLElement | null, target: HTMLElement | null, duration = 520): Promise<void> {
  if (!src || !target || prefersReducedMotion()) return Promise.resolve();
  const a = src.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (a.width === 0 || b.width === 0) return Promise.resolve();
  const ghost = src.cloneNode(true) as HTMLElement;
  ghost.removeAttribute("data-qcard");
  ghost.removeAttribute("data-fmkey");
  ghost.removeAttribute("data-qkey");
  Object.assign(ghost.style, {
    position: "fixed", left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, margin: "0", zIndex: "80", pointerEvents: "none",
    background: "var(--sheet)", border: "1px solid var(--rule)", borderRadius: "6px", padding: "12px", transformOrigin: "top left",
  } as CSSStyleDeclaration);
  document.body.appendChild(ghost);
  const sx = Math.min(1, b.width / a.width), sy = Math.min(1, Math.max(0.1, b.height / a.height));
  const anim = ghost.animate(
    [
      { transform: "translate(0,0) scale(1,1)", opacity: 1 },
      { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${sx}, ${sy})`, opacity: 0.35 },
    ],
    { duration, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
  );
  return anim.finished.then(() => undefined, () => undefined).finally(() => ghost.remove());
}
