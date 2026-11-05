// WCAG contrast ratios for the design tokens. node scripts/contrast.mjs
const lum = (h) => { const [r,g,b] = [1,3,5].map((i) => parseInt(h.slice(i,i+2),16)/255).map((c) => c <= .03928 ? c/12.92 : ((c+.055)/1.055)**2.4); return .2126*r+.7152*g+.0722*b; };
const cr = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return ((x+.05)/(y+.05)); };
// blend a translucent colour over a background
const over = (fg, a, bg) => "#" + [1,3,5].map((i) => Math.round(parseInt(fg.slice(i,i+2),16)*a + parseInt(bg.slice(i,i+2),16)*(1-a)).toString(16).padStart(2,"0")).join("");
const L = { paper:"#F4F6F8", sheet:"#FFFFFF", ink:"#1C2533", muted:"#4F5D70", green:"#2E6B4F", brick:"#B4412F", teal:"#0E5E63", marker:"#F3D35B", rule:"#CBD6E2" };
const D = { paper:"#0F1620", sheet:"#17202C", ink:"#E6ECF2", muted:"#9AA9BA", green:"#6CBE93", brick:"#EE8A77", teal:"#58BBC0", rule:"#2B3A4D" };
const rows = [
  ["light ink on paper", cr(L.ink,L.paper)], ["light ink on sheet", cr(L.ink,L.sheet)], ["light muted on paper", cr(L.muted,L.paper)], ["light muted on sheet", cr(L.muted,L.sheet)],
  ["light green on sheet", cr(L.green,L.sheet)], ["light green on paper", cr(L.green,L.paper)], ["light brick on sheet", cr(L.brick,L.sheet)], ["light teal on sheet", cr(L.teal,L.sheet)],
  ["light ink on marker", cr(L.ink,L.marker)], ["light white on teal (button)", cr("#FFFFFF",L.teal)], ["light white on ink (button)", cr("#FFFFFF",L.ink)],
  ["dark ink on paper", cr(D.ink,D.paper)], ["dark ink on sheet", cr(D.ink,D.sheet)], ["dark muted on paper", cr(D.muted,D.paper)], ["dark muted on sheet", cr(D.muted,D.sheet)],
  ["dark green on sheet", cr(D.green,D.sheet)], ["dark brick on sheet", cr(D.brick,D.sheet)], ["dark teal on sheet", cr(D.teal,D.sheet)],
  ["dark ink on marker 30% over sheet", cr(D.ink, over(L.marker,.30,D.sheet))], ["dark paper on dark-ink button", cr(D.paper,D.ink)], ["dark paper on dark teal button", cr(D.paper,D.teal)],
];
for (const [n,v] of rows) console.log(v.toFixed(1).padStart(5), v >= 4.5 ? "AA " : "FAIL", n);
