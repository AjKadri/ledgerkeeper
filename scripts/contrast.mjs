// WCAG contrast ratios for the design tokens. node scripts/contrast.mjs
const lum = (h) => { const [r,g,b] = [1,3,5].map((i) => parseInt(h.slice(i,i+2),16)/255).map((c) => c <= .03928 ? c/12.92 : ((c+.055)/1.055)**2.4); return .2126*r+.7152*g+.0722*b; };
const cr = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return ((x+.05)/(y+.05)); };
// blend a translucent colour over a background
const over = (fg, a, bg) => "#" + [1,3,5].map((i) => Math.round(parseInt(fg.slice(i,i+2),16)*a + parseInt(bg.slice(i,i+2),16)*(1-a)).toString(16).padStart(2,"0")).join("");
// v3 tokens, palette A (docs/design-plan-v3.md): warm paper + navy night; dark mode uses the v2 navy values.
const L = { underline:"#B88E00", paper:"#F6F4EF", sheet:"#FFFFFF", ink:"#1C2533", muted:"#4F5D70", green:"#2E6B4F", brick:"#B4412F", teal:"#0E5E63", marker:"#F3D35B", ruleStrong:"#8C8576",
  night:"#1C2533", night2:"#0F1620", onNight:"#E6ECF2", onNightMuted:"#A9B6C6", band:"#0A4A4E", bandMuted:"#B7D3D4" };
const D = { paper:"#0F1620", sheet:"#17202C", ink:"#E6ECF2", muted:"#9AA9BA", green:"#6CBE93", brick:"#EE8A77", teal:"#58BBC0", ruleStrong:"#5F7088", night:"#080D14", band:"#0A3D41" };
const litL = over(L.marker, .07, L.night), litD = over(L.marker, .06, D.night);
const rows = [
  ["light ink on paper", cr(L.ink,L.paper)], ["light ink on sheet", cr(L.ink,L.sheet)], ["light muted on paper", cr(L.muted,L.paper)], ["light muted on sheet", cr(L.muted,L.sheet)],
  ["light green on sheet", cr(L.green,L.sheet)], ["light green on paper", cr(L.green,L.paper)], ["light brick on sheet", cr(L.brick,L.sheet)], ["light brick on paper", cr(L.brick,L.paper)], ["light teal on sheet", cr(L.teal,L.sheet)],
  ["light white on teal (button)", cr("#FFFFFF",L.teal)], ["light white on ink (button)", cr("#FFFFFF",L.ink)],
  ["light on-night on navy night", cr(L.onNight,L.night)], ["light on-night-muted on navy night", cr(L.onNightMuted,L.night)], ["light on-night on night floor (rule card)", cr(L.onNight,L.night2)],
  ["light on-night-muted on lit column", cr(L.onNightMuted,litL)], ["light navy on on-night (button on night)", cr(L.night,L.onNight)],
  ["light on-night on teal band", cr(L.onNight,L.band)], ["light band-muted on teal band", cr(L.bandMuted,L.band)],
  ["dark ink on paper", cr(D.ink,D.paper)], ["dark ink on sheet", cr(D.ink,D.sheet)], ["dark muted on paper", cr(D.muted,D.paper)], ["dark muted on sheet", cr(D.muted,D.sheet)],
  ["dark green on sheet", cr(D.green,D.sheet)], ["dark brick on sheet", cr(D.brick,D.sheet)], ["dark teal on sheet", cr(D.teal,D.sheet)],
  ["dark paper on dark-ink button", cr(D.paper,D.ink)], ["dark paper on dark teal button", cr(D.paper,D.teal)],
  ["dark on-night on night", cr(L.onNight,D.night)], ["dark on-night-muted on night", cr(L.onNightMuted,D.night)], ["dark on-night-muted on lit column", cr(L.onNightMuted,litD)],
  ["dark on-night on teal band", cr(L.onNight,D.band)], ["dark band-muted on teal band", cr(L.bandMuted,D.band)],
];
for (const [n,v] of rows) console.log(v.toFixed(1).padStart(5), v >= 4.5 ? "AA " : "FAIL", n);
// Control borders (non-text UI boundaries) need 3:1 (WCAG 1.4.11). Decorative rule lines are exempt.
const ui = [["light rule-strong on paper", cr(L.ruleStrong,L.paper)], ["light rule-strong on sheet", cr(L.ruleStrong,L.sheet)], ["dark rule-strong on paper", cr(D.ruleStrong,D.paper)], ["dark rule-strong on sheet", cr(D.ruleStrong,D.sheet)]];
for (const [n,v] of ui) console.log(v.toFixed(1).padStart(5), v >= 3 ? "3:1" : "FAIL", n);
// The emphasis underline (replaces the filled marker band). Decorative: the underlined text carries the meaning,
// so 3:1 is a target, not a requirement. Reported so the light-paper gold stays visible.
const und = [["light underline #B88E00 on paper", cr(L.underline,L.paper)], ["light underline #B88E00 on sheet", cr(L.underline,L.sheet)],
  ["marker underline on navy night", cr(L.marker,L.night)], ["marker underline on dark sheet", cr(L.marker,D.sheet)], ["marker underline on dark night", cr(L.marker,D.night)]];
for (const [n,v] of und) console.log(v.toFixed(1).padStart(5), v >= 3 ? "3:1" : "<3 ", n, "(decorative underline)");
