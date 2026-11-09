// WCAG contrast ratios for the design tokens. node scripts/contrast.mjs
const lum = (h) => { const [r,g,b] = [1,3,5].map((i) => parseInt(h.slice(i,i+2),16)/255).map((c) => c <= .03928 ? c/12.92 : ((c+.055)/1.055)**2.4); return .2126*r+.7152*g+.0722*b; };
const cr = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return ((x+.05)/(y+.05)); };
// blend a translucent colour over a background
const over = (fg, a, bg) => "#" + [1,3,5].map((i) => Math.round(parseInt(fg.slice(i,i+2),16)*a + parseInt(bg.slice(i,i+2),16)*(1-a)).toString(16).padStart(2,"0")).join("");
// v3 tokens (docs/design-plan-v3.md): warm paper + green night; dark mode is green night throughout.
const L = { paper:"#F6F4EF", sheet:"#FFFFFF", ink:"#1C2533", muted:"#4F5D70", green:"#2E6B4F", brick:"#B4412F", teal:"#0E5E63", marker:"#F3D35B", ruleStrong:"#8C8576",
  night:"#12352A", night2:"#0C271F", onNight:"#EEF3EF", onNightMuted:"#A9C2B5" };
const D = { paper:"#0B2019", sheet:"#133229", ink:"#EAF1EC", muted:"#A3BCAF", green:"#7CCBA0", brick:"#F09482", teal:"#5CC2C6", ruleStrong:"#6A9483", night:"#061510" };
const litL = over(L.marker, .08, L.night), litD = over(L.marker, .07, D.night);
const rows = [
  ["light ink on paper", cr(L.ink,L.paper)], ["light ink on sheet", cr(L.ink,L.sheet)], ["light muted on paper", cr(L.muted,L.paper)], ["light muted on sheet", cr(L.muted,L.sheet)],
  ["light green on sheet", cr(L.green,L.sheet)], ["light green on paper", cr(L.green,L.paper)], ["light brick on sheet", cr(L.brick,L.sheet)], ["light brick on paper", cr(L.brick,L.paper)], ["light teal on sheet", cr(L.teal,L.sheet)],
  ["light ink on marker", cr(L.ink,L.marker)], ["light white on teal (button)", cr("#FFFFFF",L.teal)], ["light white on ink (button)", cr("#FFFFFF",L.ink)],
  ["light on-night on night", cr(L.onNight,L.night)], ["light on-night-muted on night", cr(L.onNightMuted,L.night)], ["light on-night on night-2 (band, rule card)", cr(L.onNight,L.night2)],
  ["light on-night-muted on lit column", cr(L.onNightMuted,litL)], ["light night on marker (swipe on night)", cr(L.night,L.marker)], ["light night on on-night (button on night)", cr(L.night,L.onNight)],
  ["dark ink on paper", cr(D.ink,D.paper)], ["dark ink on sheet", cr(D.ink,D.sheet)], ["dark muted on paper", cr(D.muted,D.paper)], ["dark muted on sheet", cr(D.muted,D.sheet)],
  ["dark green on sheet", cr(D.green,D.sheet)], ["dark brick on sheet", cr(D.brick,D.sheet)], ["dark teal on sheet", cr(D.teal,D.sheet)],
  ["dark ink on marker 30% over sheet", cr(D.ink, over(L.marker,.30,D.sheet))], ["dark paper on dark-ink button", cr(D.paper,D.ink)], ["dark paper on dark teal button", cr(D.paper,D.teal)],
  ["dark on-night on night", cr(L.onNight,D.night)], ["dark on-night-muted on night", cr(L.onNightMuted,D.night)], ["dark on-night-muted on lit column", cr(L.onNightMuted,litD)],
];
for (const [n,v] of rows) console.log(v.toFixed(1).padStart(5), v >= 4.5 ? "AA " : "FAIL", n);
// Control borders (non-text UI boundaries) need 3:1 (WCAG 1.4.11). Decorative rule lines are exempt.
const ui = [["light rule-strong on paper", cr(L.ruleStrong,L.paper)], ["light rule-strong on sheet", cr(L.ruleStrong,L.sheet)], ["dark rule-strong on paper", cr(D.ruleStrong,D.paper)], ["dark rule-strong on sheet", cr(D.ruleStrong,D.sheet)]];
for (const [n,v] of ui) console.log(v.toFixed(1).padStart(5), v >= 3 ? "3:1" : "FAIL", n);
