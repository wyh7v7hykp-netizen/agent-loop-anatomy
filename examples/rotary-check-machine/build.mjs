// The agent loop, drawn as a rotary indexing machine.
//
// A round turntable on a central column carries a pallet in one of four
// radial pockets. Four station heads sit fixed around the table:
//   1. Plan    — a drafting pen on a small cross-rail
//   2. Implement — a drill quill lowered onto the work
//   3. Review  — a magnifier ring on an inspection lamp arm
//   4. Verify  — a dial gauge; a go/no-go ejector arm
//
// The table indexes 90° per step, carrying the pallet from station to
// station. At Verify, the dial reads the part: a pass fires the ejector
// arm and the part drops down the exit chute; a fail lets the table turn
// another full lap so the part runs through Plan → Implement → Review
// → Verify again. Hover to scrub the table angle; click the left half
// to inject a failing test that forces another lap.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 720;
const HEIGHT = 540;

// ---- world layout ---------------------------------------------------------
// The bench is a round base plate. A central column carries the turntable.
// Four station heads stand on posts around the table at the compass points.
const PLATE = { x: -190, y: -150, w: 380, d: 300, r: 26 };
const PLATE_H = 14;
const FOOT_H = 6;

const HUB_R = 18;
const TABLE_R = 116;
const TABLE_Z = 34;
const TABLE_H = 8;
const TABLE_TOP = TABLE_Z + TABLE_H;

// Pockets are radial slots cut into the table edge. The subject pallet
// sits in the pocket at angle 0 (built rest position), and the whole
// table group rotates to carry it between stations.
const POCKET_R = 86;
const POCKET_PLAN = { x: -16, y: -16, w: 32, d: 32, r: 3 };
const PALLET_H = 7;

// Four station angles around the table (world, measured from +x axis,
// clockwise on the floor so that Plan is at the back-left where the
// camera looks in).
const STATION_ANGLES = [150, 60, -30, -120]; // Plan, Implement, Review, Verify
const STATION_NAMES = ["Plan", "Implement", "Review", "Verify"];

// Place each station head just outside the table at its angle.
const stationAt = (angleDeg) => {
  const a = (angleDeg * Math.PI) / 180;
  return [Math.cos(a) * (TABLE_R + 40), Math.sin(a) * (TABLE_R + 40)];
};

const POST_Z = TABLE_TOP + PALLET_H + 4;
const CROSS_Z = 96;
const HEAD_Z = 104;

// Dial gauge at Verify.
const dialCenter = stationAt(STATION_ANGLES[3]);
const DIAL_R = 15;
const DIAL_Z = 78;
const DIAL_H = 8;
const DIAL_TOP = DIAL_Z + DIAL_H;

// Exit chute past Verify, pointing outward.
const CHUTE_ANGLE = STATION_ANGLES[3];

const extremes = [
  ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
  [TABLE_R + 70, 0, CROSS_Z + 16],
  [0, TABLE_R + 70, CROSS_Z + 16],
  [-TABLE_R - 70, 0, CROSS_Z + 16],
  [0, -TABLE_R - 70, CROSS_Z + 16],
  [dialCenter[0] + 30, dialCenter[1] + 30, DIAL_TOP + 6],
];

const P = k.fitProjection(extremes, WIDTH, HEIGHT, { pad: 26, azimuth: 42, elevation: 32 });
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---- base plate, feet, ruler, label --------------------------------------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 30))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 14, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 7), 0, P), { tone: "lo" }));
  // corner screws
  const screws = k.corners(PLATE, 14);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler arc along the front edge — a tick strip curved around the plate
  const strip = { x: -150, y: PLATE.y + PLATE.d - 18, w: 300, d: 8, r: 2 };
  out.push(S(k.slabOf(strip, 0, 0.8, P, 5), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 8, strip.x + strip.w - 8, 10, 5, strip.y + 1, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 4, strip.y + 4, 0.8]), at([strip.x + strip.w - 4, strip.y + 4, 0.8])], { size: 0.45 }));
  // label plate
  const label = { x: PLATE.x + 16, y: PLATE.y + 14, w: 70, d: 20, r: 2.5 };
  out.push(S(k.slabOf(label, 0, 1, P, 5), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 2), 1, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([label.x + 7, label.y + 6], [label.x + 50, label.y + 6], 1, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 7, label.y + 11], [label.x + 36, label.y + 11], 1, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 7, label.y + 16], [label.x + 56, label.y + 16], 1, P), { tone: "lo", free: true }));
  out.push(D([at([label.x + 4, label.y + 4, 1]), at([label.x + label.w - 4, label.y + 4, 1]), at([label.x + 4, label.y + label.d - 4, 1]), at([label.x + label.w - 4, label.y + label.d - 4, 1])], { size: 0.4 }));
  return out.join("");
}

// ---- central column, hub, turntable --------------------------------------
function column() {
  const out = [];
  // base collar
  out.push(S(k.cylinder(0, 0, HUB_R + 6, -PLATE_H, 6, P, 40), { tone: "lo" }));
  out.push(S(k.cylinder(0, 0, HUB_R, -PLATE_H + 6, TABLE_Z + PLATE_H - 6, P, 40, 0), { tone: "mid", crease: "none" }));
  out.push(L([20, 50, 80].map((z) => k.sideArc(0, 0, HUB_R, z, P, 24)).join(""), { tone: "faint" }));
  // bearing at top of column
  out.push(S(k.cylinder(0, 0, HUB_R + 2, TABLE_TOP, 4, P, 40), { tone: "mid" }));
  out.push(L(k.ring(0, 0, HUB_R + 2, TABLE_TOP + 4, P, 40), { tone: "lo" }));
  return out.join("");
}

// the turntable disc and its pockets (drawn at rest, rotated as a group live)
function turntable() {
  const out = [];
  // disc
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: -TABLE_R, y: -TABLE_R, w: TABLE_R * 2, d: TABLE_R * 2, r: TABLE_R }, TABLE_Z, TABLE_H, P)}" style="filter:blur(5px)"/>`);
  out.push(S(k.cylinder(0, 0, TABLE_R, TABLE_Z, TABLE_H, P, 96, 1), { tone: "mid" }));
  // radial position ring (faint)
  out.push(L(k.ring(0, 0, TABLE_R - 2, TABLE_TOP, P, 64), { tone: "faint" }));
  // four pocket slots cut at the rim — built at the four station angles
  for (const a of [0, 90, 180, 270]) {
    const ang = (a * Math.PI) / 180;
    const px = Math.cos(ang) * POCKET_R;
    const py = Math.sin(ang) * POCKET_R;
    // pocket recess (a thin slab inset)
    out.push(S(k.slabOf({ x: px - 16, y: py - 16, w: 32, d: 32, r: 3 }, TABLE_TOP, 2, P, 5, 0.4), { tone: "lo" }));
    out.push(L(k.planOutline(k.insetPlan({ x: px - 16, y: py - 16, w: 32, d: 32, r: 3 }, 2), TABLE_TOP + 2, P), { tone: "faint" }));
    // tiny screws at pocket corners
    out.push(D([at([px - 12, py - 12, TABLE_TOP + 2]), at([px + 12, py - 12, TABLE_TOP + 2]), at([px - 12, py + 12, TABLE_TOP + 2]), at([px + 12, py + 12, TABLE_TOP + 2])], { size: 0.35, tone: "lo" }));
  }
  return out.join("");
}

// the subject pallet (the one lit part) — built at angle 0, rotates with table
function pallet() {
  const out = [];
  out.push(S(k.slabOf(POCKET_PLAN, TABLE_TOP + 2, PALLET_H, P, 4, 0.5), { tone: "hi", lit: true, crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(POCKET_PLAN, 2), TABLE_TOP + 2 + PALLET_H, P), { tone: "faint" }));
  out.push(D([at([POCKET_PLAN.x + 5, POCKET_PLAN.y + 5, TABLE_TOP + 2 + PALLET_H]), at([POCKET_PLAN.x + POCKET_PLAN.w - 5, POCKET_PLAN.y + POCKET_PLAN.d - 5, TABLE_TOP + 2 + PALLET_H])], { size: 0.35, tone: "lo" }));
  return out.join("");
}

// ---- station frame: a post + cross beam at a given world angle -----------
function frame(angleDeg) {
  const out = [];
  const [px, py] = stationAt(angleDeg);
  // collar at base
  out.push(S(k.cylinder(px, py, 6, 0, 5, P, 32), { tone: "mid" }));
  // post
  out.push(S(k.cylinder(px, py, 3.6, 5, CROSS_Z - 5, P, 28, 0), { tone: "mid", crease: "none" }));
  out.push(L([30, 55, 80].map((z) => k.sideArc(px, py, 3.6, z, P, 16)).join(""), { tone: "faint" }));
  // cap
  out.push(S(k.cylinder(px, py, 4.2, CROSS_Z, 2, P, 28), { tone: "mid" }));
  return out.join("");
}

// ---- station 1: Plan — drafting pen on the cross beam --------------------
function planHead() {
  const out = [];
  const [px, py] = stationAt(STATION_ANGLES[0]);
  // arm reaching over the table toward center
  const armLen = 40;
  const a = (STATION_ANGLES[0] * Math.PI) / 180;
  const tx = px - Math.cos(a) * armLen;
  const ty = py - Math.sin(a) * armLen;
  out.push(S(k.slabOf({ x: Math.min(px, tx), y: Math.min(py, ty) - 4, w: Math.abs(px - tx) + 4, d: 8, r: 2 }, CROSS_Z, 5, P, 4, 0.4), { tone: "mid" }));
  // pen holder
  out.push(S(k.cylinder(tx, ty, 2.6, CROSS_Z + 5, 14, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(tx, ty, 3.4, CROSS_Z + 5, 3, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(tx, ty, 3.4, CROSS_Z + 5, CROSS_Z + 8, 18, P), { tone: "lo" }));
  // pen nib (lit)
  out.push(S(k.cylinder(tx, ty, 1.2, CROSS_Z + 5, 22, P, 12, 0), { tone: "hi", lit: true, crease: "none" }));
  out.push(D([at([tx, ty, CROSS_Z + 27])], { size: 0.5, tone: "lit" }));
  return out.join("");
}

// ---- station 2: Implement — drill quill ----------------------------------
function implementHead() {
  const out = [];
  const [px, py] = stationAt(STATION_ANGLES[1]);
  const a = (STATION_ANGLES[1] * Math.PI) / 180;
  const tx = px - Math.cos(a) * 36;
  const ty = py - Math.sin(a) * 36;
  // spindle housing on a stub over the table
  out.push(S(k.slabOf({ x: Math.min(px, tx), y: Math.min(py, ty) - 5, w: Math.abs(px - tx) + 5, d: 10, r: 2 }, CROSS_Z, 6, P, 4, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(tx, ty, 6, CROSS_Z + 6, 12, P, 28), { tone: "mid" }));
  out.push(L(k.sideArc(tx, ty, 6, CROSS_Z + 10, P, 18), { tone: "lo" }));
  // chuck
  out.push(S(k.cylinder(tx, ty, 4.4, CROSS_Z + 6, 5, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(tx, ty, 4.4, CROSS_Z + 6, CROSS_Z + 11, 22, P), { tone: "lo" }));
  // the bit (lit)
  out.push(S(k.cylinder(tx, ty, 1.3, CROSS_Z + 6, 34, P, 12, 0), { tone: "hi", lit: true, crease: "none" }));
  return out.join("");
}

// ---- station 3: Review — magnifier on lamp arm --------------------------
function reviewHead() {
  const out = [];
  const [px, py] = stationAt(STATION_ANGLES[2]);
  const a = (STATION_ANGLES[2] * Math.PI) / 180;
  const tx = px - Math.cos(a) * 38;
  const ty = py - Math.sin(a) * 38;
  // arm
  out.push(S(k.slabOf({ x: Math.min(px, tx), y: Math.min(py, ty) - 4, w: Math.abs(px - tx) + 4, d: 8, r: 2 }, CROSS_Z, 5, P, 4, 0.4), { tone: "mid" }));
  // stem
  out.push(S(k.cylinder(tx, ty, 3, CROSS_Z + 5, 10, P, 20, 0), { tone: "mid", crease: "none" }));
  // lamp shade
  out.push(S(k.cylinder(tx, ty, 5.4, CROSS_Z + 5 - 12, 7, P, 24, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(tx, ty, 4, CROSS_Z + 5 - 12, 1.5, P, 24), { tone: "mid" }));
  // magnifier ring (lit)
  const lensZ = CROSS_Z + 5 - 22;
  out.push(S(k.cylinder(tx, ty, 7.2, lensZ, 3, P, 40, 0.4), { tone: "hi", lit: true, crease: "lo" }));
  out.push(L(k.ring(tx, ty, 5.8, lensZ + 3, P, 40), { tone: "lo" }));
  out.push(L(k.sideArc(tx, ty, 7.2, lensZ + 1.5, P, 28), { tone: "faint" }));
  return out.join("");
}

// ---- station 4: Verify — dial gauge + ejector ---------------------------
function verifyHead() {
  const out = [];
  const [px, py] = stationAt(STATION_ANGLES[3]);
  const a = (STATION_ANGLES[3] * Math.PI) / 180;
  const tx = px - Math.cos(a) * 30;
  const ty = py - Math.sin(a) * 30;
  // bracket arm
  out.push(S(k.slabOf({ x: Math.min(px, tx), y: Math.min(py, ty) - 4, w: Math.abs(px - tx) + 4, d: 8, r: 2 }, CROSS_Z, 6, P, 4, 0.4), { tone: "mid" }));
  // stem down to dial
  out.push(S(k.cylinder(tx, ty, 3, DIAL_TOP, DIAL_Z - DIAL_TOP, P, 20, 0), { tone: "mid", crease: "none" }));
  // dial body
  out.push(S(k.cylinder(tx, ty, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(tx, ty, DIAL_R, DIAL_TOP - 3, DIAL_TOP, 84, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(tx, ty, DIAL_R, DIAL_TOP - 3, P, 40), { tone: "faint" }));
  out.push(L(k.ring(tx, ty, DIAL_R - 2, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(tx, ty, DIAL_R - 2.6, 50, 5, DIAL_TOP, [1.2, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // plunger
  out.push(S(k.cylinder(tx, ty, 2.4, 0, 2.4, P, 20, 0), { tone: "hi", lit: true }));
  out.push(S(k.cylinder(tx, ty, 1.3, 2.4, DIAL_Z - 2.4, P, 16, 0), { tone: "hi", lit: true, crease: "none" }));
  out.push(L(k.ring(tx, ty, 1.6, DIAL_TOP, P, 16), { tone: "mid" }));
  // engraved PASS label
  out.push(k.faceTextSvg(k.topMatrix([tx, ty + 8], DIAL_TOP, P, "x"), "PASS", { size: 2.6, tone: "lo", anchor: "middle" }));
  return out.join("");
}

// the needle on the verify dial (moves with the reading)
function needlePath(turn, tx, ty) {
  const angle = turn * Math.PI * 2;
  return k.lineOnTop(
    [tx - Math.sin(angle) * 3, ty + Math.cos(angle) * 3],
    [tx + Math.sin(angle) * (DIAL_R - 4), ty - Math.cos(angle) * (DIAL_R - 4)],
    DIAL_TOP + 0.2,
    P,
  );
}

// ---- the exit chute past Verify -----------------------------------------
function chute() {
  const out = [];
  const [px, py] = stationAt(CHUTE_ANGLE);
  const a = (CHUTE_ANGLE * Math.PI) / 180;
  // a short ramp slab just outside the table at Verify
  const cx = px + Math.cos(a) * 10;
  const cy = py + Math.sin(a) * 10;
  const ramp = { x: cx - 24, y: cy - 16, w: 48, d: 32, r: 3 };
  out.push(S(k.slabOf(ramp, 0, 4, P, 5, 0.6), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(ramp, 3), 4, P), { tone: "faint" }));
  out.push(D([at([ramp.x + 5, ramp.y + 5, 4]), at([ramp.x + ramp.w - 5, ramp.y + 5, 4]), at([ramp.x + 5, ramp.y + ramp.d - 5, 4]), at([ramp.x + ramp.w - 5, ramp.y + ramp.d - 5, 4])], { size: 0.4 }));
  return out.join("");
}

// ---- station name tags on the base (one tiny engraved label per station post collar)
function stationTags() {
  const out = [];
  STATION_ANGLES.forEach((ang, i) => {
    const [px, py] = stationAt(ang);
    const m = k.topMatrix([px, py], 5, P, "x");
    out.push(k.faceTextSvg(m, STATION_NAMES[i].toUpperCase(), { size: 3.6, tone: "hi", anchor: "middle" }));
  });
  return out.join("");
}

// ---- assemble the static SVG --------------------------------------------
// Table center screen point, used to rotate the turntable group live.
const center = at([0, 0, TABLE_TOP]);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A rotary indexing machine that draws the coding-agent loop. A turntable carries a pallet in one of four pockets past four station heads — Plan, Implement, Review, Verify. At Verify the dial gauge reads the part: a pass fires the ejector arm and the part drops down the exit chute; a fail lets the table turn another full lap so the part runs through the loop again.",
  body: [
    plate(),
    column(),
    frame(STATION_ANGLES[0]), planHead(),
    frame(STATION_ANGLES[1]), implementHead(),
    frame(STATION_ANGLES[2]), reviewHead(),
    frame(STATION_ANGLES[3]), verifyHead(),
    chute(),
    stationTags(),
    `<g data-part="table">${turntable()}</g>`,
    `<g data-part="pallet" transform="rotate(0 ${center[0]} ${center[1]})">${pallet()}</g>`,
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needlePath(0, dialCenter[0] - 30 * Math.cos((CHUTE_ANGLE * Math.PI) / 180), dialCenter[1] - 30 * Math.sin((CHUTE_ANGLE * Math.PI) / 180))}" style="stroke-width:1.1"/>`,
  ],
});

// the verify tool tip in world coords (for the needle)
const verifyTip = stationAt(STATION_ANGLES[3]);
const vx = verifyTip[0] - Math.cos((STATION_ANGLES[3] * Math.PI) / 180) * 30;
const vy = verifyTip[1] - Math.sin((STATION_ANGLES[3] * Math.PI) / 180) * 30;

// ---- live behaviour ------------------------------------------------------
// The table group rotates around its screen centre. tableAngle (deg) eases
// between 0, 90, 180, 270, ... Each step brings the pallet under the next
// station. At Verify (when tableAngle ≡ 270 mod 360) we read the dial; a
// pass resets the pallet to Plan, a fail keeps the lap going.
const live = `
const P = ${JSON.stringify(P)};
const ANGLES = ${JSON.stringify(STATION_ANGLES)};
const NAMES = ${JSON.stringify(STATION_NAMES)};
const CENTER = ${JSON.stringify(center)};
const VX = ${vx}, VY = ${vy};
const DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const table = svg.querySelector('[data-part="table"]');
const pallet = svg.querySelector('[data-part="pallet"]');
const needle = svg.querySelector('[data-part="needle"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const needleAt = ${needlePath.toString().replace("k.lineOnTop", "lineOnTop")};
// station index whose world angle matches the pallet's current angle
const stationForAngle = (deg) => {
  const norm = ((deg % 360) + 360) % 360;
  // pallet starts at angle 0 (world). After rotating the table by 'deg',
  // the pallet sits at world angle 'deg'. Find the station whose angle is
  // closest to 'deg' mod 360.
  let best = 0, bestD = Infinity;
  ANGLES.forEach((a, i) => {
    const aa = ((a % 360) + 360) % 360;
    const d = Math.min(Math.abs(aa - norm), 360 - Math.abs(aa - norm));
    if (d < bestD) { bestD = d; best = i; }
  });
  return { index: best, dist: bestD };
};
let angle = 0, target = 0, lap = 1, failed = false, frame = 0, last = 0, clock = 0, touring = true, visible = false, idleTimer = 0;
const tourStep = (t) => Math.floor(t / 2.6) % 4;
function draw() {
  table.setAttribute("transform", \`rotate(\${angle.toFixed(2)} \${CENTER[0]} \${CENTER[1]})\`);
  pallet.setAttribute("transform", \`rotate(\${angle.toFixed(2)} \${CENTER[0]} \${CENTER[1]})\`);
  const { index, dist } = stationForAngle(angle);
  const atVerify = index === 3 && dist < 6;
  const turn = atVerify ? (failed ? 0.78 : 0.12) : 0;
  needle.setAttribute("d", needleAt(turn, VX, VY));
  let text;
  if (atVerify) text = NAMES[3] + " · " + (failed ? "FAIL → another lap" : "pass → ship");
  else text = NAMES[index] + (dist < 4 ? " · hold" : " · index") + " · lap " + lap;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(angle)));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    const step = tourStep(clock);
    target = ANGLES[step] < 0 ? ANGLES[step] + 360 : ANGLES[step];
    // unwrap so we always advance clockwise
    while (target < angle - 1) target += 360;
    if (calm) angle = target;
  }
  // ease angle toward target, taking the short rotational step
  let diff = target - angle;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  angle = calm ? target : angle + diff * (1 - Math.exp(-dt / 0.32));
  if (Math.abs(diff) < 0.05) angle = target;
  draw();
  const settled = !touring && Math.abs(target - angle) < 0.05;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => { touring = false; target = next; clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.2) / 0.6, 0, 1);
  steer(share * 360);
});
stage.addEventListener("pointerleave", () => steer(target));
// click left half to inject a failing test that forces another lap
stage.addEventListener("click", (event) => {
  const box = svg.getBoundingClientRect();
  const left = (event.clientX - box.left) / box.width < 0.5;
  failed = left;
  if (left) { touring = false; target = angle - 90; lap++; }
  clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600); run();
});
stage.addEventListener("keydown", (event) => {
  const here = stationForAngle(angle).index;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = (here + 1) % 4;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = (here + 3) % 4;
  if (to === null) return;
  event.preventDefault();
  let a = ANGLES[to]; if (a < 0) a += 360;
  while (a < angle - 1) a += 360;
  steer(a);
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "The agent loop",
  hint: "Hover to scrub · click left half to fail the test",
  readout: "Plan · hold · lap 1",
  keys: [
    { mark: "lit", label: "Pallet, pen, bit, lens and gauge: the parts that touch the work" },
    { mark: "raised", label: "Four station heads on posts around the turntable" },
  ],
  caption:
    "A coding agent's loop drawn as a rotary indexing machine. The turntable carries the pallet past Plan, Implement, Review and Verify. The dial reads the part at Verify; a pass fires the ejector and ships it down the chute, a fail turns the table another lap so the part runs through the loop again.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Agent loop: arrow keys index the turntable from station to station" aria-valuemin="0" aria-valuemax="360" aria-valuenow="0">${svg}</div>`,
});

writeFileSync(
  join(HERE, theme === "light" ? "rotary-check-machine-light.html" : "rotary-check-machine.html"),
  k.pageHtml({ title: "The agent loop", theme, body, script: kitScript() + live }),
);
console.log("wrote", theme === "light" ? "rotary-check-machine-light.html" : "rotary-check-machine.html");
