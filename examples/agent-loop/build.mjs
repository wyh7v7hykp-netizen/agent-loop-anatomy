// The agent loop, drawn as a linear transfer line.
//
// A pallet rides a carriage along two rails past four stations:
//   1. Plan    — a drafting head: a pen on a cross-rail that draws a plan card
//   2. Implement — a drill/mill head on a quill, lowered onto the work
//   3. Review  — a magnifier ring on an inspection lamp arm
//   4. Verify  — a dial gauge that reads the part; a go/no-go gate
//
// Past Verify, a gate either opens the exit chute (pass) or lifts a return arm
// that pushes the pallet back to Plan for another lap (fail). Hover to scrub
// the phase; click the left half to inject a failing test that loops it back.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 720;
const HEIGHT = 460;

// ---- world layout ---------------------------------------------------------
// The bench is a long base plate. Rails run along x. Four stations sit at
// fixed x positions; the carriage travels between them.
const PLATE = { x: -300, y: -70, w: 600, d: 140, r: 10 };
const PLATE_H = 14;
const FOOT_H = 6;

const RAIL_Y = [-26, 26];
const RAIL_FROM = -250;
const RAIL_TO = 250;

// Four station centres along x.
const STATION_X = [-210, -70, 70, 210];
const STATION_NAMES = ["Plan", "Implement", "Review", "Verify"];

// Carriage that carries the pallet. Built at x=0, moved with translateAlong.
const CARRIAGE = { x: -34, y: -34, w: 68, d: 68, r: 4 };
const CARRIAGE_Z = 3;
const CARRIAGE_TOP = 10;

// The pallet / workpiece — the one lit part.
const PALLET = { x: -20, y: -20, w: 40, d: 40, r: 3 };
const PALLET_Z = CARRIAGE_TOP;
const PALLET_H = 6;

// Station hardware heights.
const POST_Z = CARRIAGE_TOP + PALLET_H + 4;     // posts rise from the base
const CROSS_Z = 86;                            // cross-rail height
const HEAD_Z = 96;                             // tool head height

// Dial gauge at Verify.
const DIAL = [STATION_X[3], 0];
const DIAL_R = 16;
const DIAL_Z = 78;
const DIAL_H = 8;
const DIAL_TOP = DIAL_Z + DIAL_H;

// Exit chute past Verify (positive x end).
const CHUTE_X = 250;

// Reaching extremes for camera fit.
const extremes = [
  ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
  [STATION_X[0] - 30, -40, CROSS_Z + 14],
  [STATION_X[3] + 30, 40, CROSS_Z + 14],
  [CHUTE_X + 60, 0, 0],
  [DIAL[0] + DIAL_R, DIAL[1] + DIAL_R, DIAL_TOP + 4],
];

const P = k.fitProjection(extremes, WIDTH, HEIGHT, { pad: 26, azimuth: 42, elevation: 30 });
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---- base plate, feet, ruler, label --------------------------------------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 26))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 10, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  // corner screws
  const screws = k.corners(PLATE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge
  const strip = { x: -260, y: PLATE.y + PLATE.d - 16, w: 520, d: 8, r: 1.5 };
  out.push(S(k.slabOf(strip, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 6, strip.x + strip.w - 6, 8, 5, strip.y + 1, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 3, strip.y + 4, 0.8]), at([strip.x + strip.w - 3, strip.y + 4, 0.8])], { size: 0.45 }));
  // label plate
  const label = { x: -300 + 14, y: -70 + 12, w: 60, d: 18, r: 2 };
  out.push(S(k.slabOf(label, 0, 1, P, 5), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 2), 1, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([label.x + 6, label.y + 6], [label.x + 40, label.y + 6], 1, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 6, label.y + 11], [label.x + 30, label.y + 11], 1, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 6, label.y + 14.5], [label.x + 46, label.y + 14.5], 1, P), { tone: "lo", free: true }));
  out.push(D([at([label.x + 4, label.y + 4, 1]), at([label.x + label.w - 4, label.y + 4, 1]), at([label.x + 4, label.y + label.d - 4, 1]), at([label.x + label.w - 4, label.y + label.d - 4, 1])], { size: 0.4 }));
  return out.join("");
}

// ---- rails, end stops, return loop track ---------------------------------
function rails() {
  const out = [];
  for (const y of RAIL_Y) {
    out.push(S(k.slabOf({ x: RAIL_FROM, y, w: RAIL_TO - RAIL_FROM, d: 6, r: 1.2 }, 0, 3.5, P, 4, 0.4), { tone: "mid" }));
    out.push(D([RAIL_FROM + 8, RAIL_TO - 8].map((x) => at([x, y + 3, 3.5])), { size: 0.4, tone: "lo" }));
  }
  // end stops at both ends
  for (const x of [RAIL_FROM - 6, RAIL_TO]) {
    out.push(S(k.slabOf({ x, y: -30, w: 6, d: 60, r: 1.4 }, 0, 8, P, 4, 0.5), { tone: "mid" }));
    out.push(D([at([x + 3, -24, 8]), at([x + 3, 24, 8])], { size: 0.45 }));
  }
  // return track: a second rail pair at the back, lower, that carries the
  // pallet back to Plan on fail. Drawn as a trough.
  const back = PLATE.y + 4;
  out.push(S(k.slabOf({ x: RAIL_FROM, y: back, w: RAIL_TO - RAIL_FROM, d: 10, r: 2 }, -PLATE_H + 2, 4, P, 6, 0.6), { tone: "lo" }));
  out.push(k.fadeLineSvg(k.pointsAt([[RAIL_FROM + 4, back + 2, -PLATE_H + 6], [RAIL_TO - 4, back + 2, -PLATE_H + 6]], P), { fade: 8, tone: "faint" }));
  return out.join("");
}

// ---- a shared station frame: two posts + a cross beam --------------------
function frame(stationX) {
  const out = [];
  const postY = [-40, 40];
  for (const py of postY) {
    // collar at base
    out.push(S(k.cylinder(stationX, py, 5, 0, 4, P, 28), { tone: "mid" }));
    // post
    out.push(S(k.cylinder(stationX, py, 3.2, 4, CROSS_Z - 4, P, 28, 0), { tone: "mid", crease: "none" }));
    out.push(L([40, 60, 80].map((z) => k.sideArc(stationX, py, 3.2, z, P, 16)).join(""), { tone: "faint" }));
    // cap
    out.push(S(k.cylinder(stationX, py, 3.8, CROSS_Z, 2, P, 28), { tone: "mid" }));
  }
  // cross beam spanning the posts
  const beam = { x: stationX - 6, y: postY[0], w: 12, d: postY[1] - postY[0], r: 2 };
  out.push(S(k.slabOf(beam, CROSS_Z, 6, P, 4, 0.5), { tone: "mid" }));
  out.push(D([at([stationX, postY[0] + 4, CROSS_Z + 6]), at([stationX, postY[1] - 4, CROSS_Z + 6])], { size: 0.4 }));
  return out.join("");
}

// ---- station 1: Plan — a pen plotter head on the cross beam --------------
function planHead() {
  const out = [];
  const sx = STATION_X[0];
  // carriage on the beam
  const car = { x: sx - 10, y: -8, w: 20, d: 16, r: 2 };
  out.push(S(k.slabOf(car, CROSS_Z + 6, 8, P, 4, 0.4), { tone: "mid" }));
  out.push(D([at([sx - 7, -4, CROSS_Z + 14]), at([sx + 7, -4, CROSS_Z + 14])], { size: 0.4 }));
  // pen holder (quill)
  out.push(S(k.cylinder(sx, 0, 2.6, CROSS_Z + 14, 16, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(sx, 0, 3.4, CROSS_Z + 14, 3, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(sx, 0, 3.4, CROSS_Z + 14, CROSS_Z + 17, 18, P), { tone: "lo" }));
  // pen nib (lit) — the drawing tip
  out.push(S(k.cylinder(sx, 0, 1.2, CROSS_Z + 14, 22, P, 12, 0), { tone: "hi", lit: true, crease: "none" }));
  out.push(D([at([sx, 0, CROSS_Z + 36])], { size: 0.5, tone: "lit" }));
  return out.join("");
}

// ---- station 2: Implement — a drill quill lowered onto the work ---------
function implementHead() {
  const out = [];
  const sx = STATION_X[1];
  // spindle housing on the beam
  out.push(S(k.cylinder(sx, 0, 7, CROSS_Z + 6, 14, P, 28), { tone: "mid" }));
  out.push(L(k.sideArc(sx, 0, 7, CROSS_Z + 12, P, 18), { tone: "lo" }));
  // chuck
  out.push(S(k.cylinder(sx, 0, 4.6, CROSS_Z + 6, 6, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(sx, 0, 4.6, CROSS_Z + 6, CROSS_Z + 12, 24, P), { tone: "lo" }));
  // the bit (lit) — what does the work
  out.push(S(k.cylinder(sx, 0, 1.4, CROSS_Z + 6, 40, P, 12, 0), { tone: "hi", lit: true, crease: "none" }));
  // flute line — fade out at both ends so it doesn't float
  out.push(k.fadeLineSvg(k.pointsAt([[sx, 0, CROSS_Z + 6 - 16], [sx, 0, CROSS_Z + 6 - 4]], P), { fade: 4, tone: "faint" }));
  return out.join("");
}

// ---- station 3: Review — a magnifier on an inspection lamp arm ----------
function reviewHead() {
  const out = [];
  const sx = STATION_X[2];
  // arm from the cross beam down to a ring
  out.push(S(k.cylinder(sx, 0, 3.2, CROSS_Z + 6, 12, P, 20, 0), { tone: "mid", crease: "none" }));
  // lamp shade (a short cone-ish bell) — use a cylinder with bevel
  out.push(S(k.cylinder(sx, 0, 6, CROSS_Z + 6 - 14, 8, P, 24, 0.6), { tone: "mid" }));
  out.push(S(k.cylinder(sx, 0, 4.4, CROSS_Z + 6 - 14, 2, P, 24), { tone: "mid" }));
  // magnifier ring (lit) — the lens hoop
  const lensZ = CROSS_Z + 6 - 26;
  out.push(S(k.cylinder(sx, 0, 8, lensZ, 3, P, 40, 0.4), { tone: "hi", lit: true, crease: "lo" }));
  out.push(L(k.ring(sx, 0, 6.4, lensZ + 3, P, 40), { tone: "lo" }));
  out.push(L(k.sideArc(sx, 0, 8, lensZ + 1.5, P, 28), { tone: "faint" }));
  return out.join("");
}

// ---- station 4: Verify — a dial gauge on a bracket ----------------------
function verifyHead() {
  const out = [];
  const sx = STATION_X[3];
  // bracket from the cross beam
  const br = { x: sx - 4, y: -4, w: 8, d: 8, r: 1.5 };
  out.push(S(k.slabOf(br, CROSS_Z + 6, 6, P, 3, 0.4), { tone: "mid" }));
  // stem down to the dial
  out.push(S(k.cylinder(sx, 0, 3, DIAL_TOP, DIAL_Z - DIAL_TOP, P, 20, 0), { tone: "mid", crease: "none" }));
  // dial body
  out.push(S(k.cylinder(DIAL[0], DIAL[1], DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(DIAL[0], DIAL[1], DIAL_R, DIAL_TOP - 3, DIAL_TOP, 84, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(DIAL[0], DIAL[1], DIAL_R, DIAL_TOP - 3, P, 40), { tone: "faint" }));
  out.push(L(k.ring(DIAL[0], DIAL[1], DIAL_R - 2, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(DIAL[0], DIAL[1], DIAL_R - 2.6, 50, 5, DIAL_TOP, [1.2, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // plunger touching the part
  out.push(S(k.cylinder(DIAL[0], DIAL[1], 1.4, 2.4, DIAL_Z - 2.4, P, 16, 0), { tone: "hi", lit: true, crease: "none" }));
  out.push(S(k.cylinder(DIAL[0], DIAL[1], 2.6, 0, 2.4, P, 20, 0), { tone: "hi", lit: true }));
  out.push(L(k.ring(DIAL[0], DIAL[1], 1.6, DIAL_TOP, P, 16), { tone: "mid" }));
  // engraved label
  out.push(k.faceTextSvg(k.topMatrix([DIAL[0], DIAL[1] + 8], DIAL_TOP, P, "x"), "PASS", { size: 2.4, tone: "lo", anchor: "middle" }));
  return out.join("");
}

// ---- the exit chute past Verify ------------------------------------------
function chute() {
  const out = [];
  // a sloped slab ramp leading off the right end
  const ramp = { x: CHUTE_X, y: -20, w: 60, d: 40, r: 3 };
  out.push(S(k.slabOf(ramp, 0, 4, P, 5, 0.6), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(ramp, 3), 4, P), { tone: "faint" }));
  out.push(D([at([ramp.x + 5, ramp.y + 5, 4]), at([ramp.x + ramp.w - 5, ramp.y + 5, 4]), at([ramp.x + 5, ramp.y + ramp.d - 5, 4]), at([ramp.x + ramp.w - 5, ramp.y + ramp.d - 5, 4])], { size: 0.4 }));
  // side rails of the chute
  out.push(S(k.slabOf({ x: CHUTE_X, y: -22, w: 60, d: 3, r: 1 }, 4, 4, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: CHUTE_X, y: 19, w: 60, d: 3, r: 1 }, 4, 4, P, 3, 0.3), { tone: "mid" }));
  return out.join("");
}

// ---- the carriage + pallet (the subject) --------------------------------
function carriage() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CARRIAGE, 3), CARRIAGE_Z, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(CARRIAGE, CARRIAGE_Z, CARRIAGE_TOP - CARRIAGE_Z, P, 5, 0.6), { tone: "mid" }));
  // bushings at corners
  for (const [x, y] of k.corners(CARRIAGE, 4)) {
    out.push(S(k.cylinder(x, y, 2.4, CARRIAGE_TOP, 3, P, 16), { tone: "mid" }));
    out.push(D([at([x, y, CARRIAGE_TOP + 3])], { size: 0.35, tone: "lo" }));
  }
  // rivets along the front edge
  out.push(D([-26, -14, -2, 10, 22].map((x) => at([x, CARRIAGE.y + CARRIAGE.d - 2.4, CARRIAGE_TOP])), { size: 0.35, tone: "lo" }));
  // handle on the front
  const handle = [CARRIAGE.x + CARRIAGE.w - 8, CARRIAGE.y + CARRIAGE.d + 3];
  out.push(S(k.slabOf({ x: handle[0] - 2, y: CARRIAGE.y + CARRIAGE.d - 1, w: 4, d: 4, r: 1 }, CARRIAGE_Z + 1, 3, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(handle[0], handle[1] + 1, 3, CARRIAGE_Z, 5, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(handle[0], handle[1] + 1, 3, CARRIAGE_Z, CARRIAGE_Z + 5, 18, P), { tone: "lo" }));
  return out.join("");
}

function pallet() {
  const out = [];
  // the workpiece — the one lit part
  out.push(S(k.slabOf(PALLET, PALLET_Z, PALLET_H, P, 4, 0.5), { tone: "hi", lit: true, crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(PALLET, 2), PALLET_Z + PALLET_H, P), { tone: "faint" }));
  // tiny engraved mark
  out.push(D([at([PALLET.x + 4, PALLET.y + 4, PALLET_Z + PALLET_H]), at([PALLET.x + PALLET.w - 4, PALLET.y + PALLET.d - 4, PALLET_Z + PALLET_H])], { size: 0.35, tone: "lo" }));
  return out.join("");
}

// ---- the needle on the verify dial (moves with the readout) -------------
const needleAt = (turn) => {
  const angle = turn * Math.PI * 2;
  const [x, y] = DIAL;
  return k.lineOnTop(
    [x - Math.sin(angle) * 3, y + Math.cos(angle) * 3],
    [x + Math.sin(angle) * (DIAL_R - 4), y - Math.cos(angle) * (DIAL_R - 4)],
    DIAL_TOP + 0.2,
    P,
  );
};

// ---- station name labels (tiny engraved, one per station post) ----------
// craft allows at most one tiny engraved label, but station tags live as
// FaceText on the front face of each cross beam — kept off the drawing body.
function stationTags() {
  const out = [];
  STATION_X.forEach((sx, i) => {
    const m = k.topMatrix([sx, 0], CROSS_Z + 6, P, "x");
    out.push(k.faceTextSvg(m, STATION_NAMES[i].toUpperCase(), { size: 4.2, tone: "hi", anchor: "middle" }));
  });
  return out.join("");
}

// ---- assemble the static SVG --------------------------------------------
// Build order is back-to-front. Stations are drawn after the rails and
// carriage so their posts sit behind the moving pallet; the pallet is drawn
// last among the moving parts so it reads as the foreground subject.
const startX = STATION_X[0];

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A linear transfer line that draws the coding-agent loop. A pallet rides a carriage along two rails past four stations — Plan, Implement, Review, Verify — and a dial gauge at Verify reads the part. A pass sends it down the exit chute; a fail lifts the return arm and the pallet runs back to Plan for another lap.",
  body: [
    plate(),
    rails(),
    frame(STATION_X[0]), planHead(),
    frame(STATION_X[1]), implementHead(),
    frame(STATION_X[2]), reviewHead(),
    frame(STATION_X[3]), verifyHead(),
    chute(),
    stationTags(),
    `<g data-part="carriage" transform="${k.translateAlong(P, [startX, 0, 0])}">${carriage()}</g>`,
    `<g data-part="pallet" transform="${k.translateAlong(P, [startX, 0, 0])}">${pallet()}</g>`,
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.1"/>`,
  ],
});

// ---- live behaviour ------------------------------------------------------
// The carriage eases between the four station x positions. The pallet rides
// on it. At Verify, the needle turns to show the gauge reading. A pass sends
// the carriage past Verify onto the chute; a fail loops it back to Plan.
const live = `
const P = ${JSON.stringify(P)};
const STATIONS = ${JSON.stringify(STATION_X)};
const NAMES = ${JSON.stringify(STATION_NAMES)};
const DIAL = ${JSON.stringify(DIAL)};
const DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const REACH = [STATIONS[0] - 6, STATIONS[3] + 56];
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const carriage = svg.querySelector('[data-part="carriage"]');
const pallet = svg.querySelector('[data-part="pallet"]');
const needle = svg.querySelector('[data-part="needle"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
let x = STATIONS[0], target = x, lap = 1, failed = false, frame = 0, last = 0, clock = 0, touring = true, visible = false, idleTimer = 0;
// Tour: dwell at each station in turn; at Verify, randomly pass or fail.
const tourStop = (t) => {
  const seg = Math.floor(t / 2.4) % 5;
  return seg < 4 ? STATIONS[seg] : STATIONS[3] + 30;
};
function draw() {
  carriage.setAttribute("transform", translateAlong(P, [x, 0, 0]));
  pallet.setAttribute("transform", translateAlong(P, [x, 0, 0]));
  // needle reading: zero except when the pallet is under Verify
  const atVerify = Math.abs(x - STATIONS[3]) < 6;
  const turn = atVerify ? (failed ? 0.78 : 0.12) : 0;
  needle.setAttribute("d", needleAt(turn));
  let text;
  if (atVerify) text = NAMES[3] + " · " + (failed ? "FAIL → loop back" : "pass → ship");
  else {
    const idx = STATIONS.reduce((b, s, i) => (Math.abs(s - x) < Math.abs(STATIONS[b] - x) ? i : b), 0);
    text = NAMES[idx] + (Math.abs(x - STATIONS[idx]) < 1 ? " · hold" : " · transfer") + " · lap " + lap;
  }
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(x)));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    target = tourStop(clock);
    if (calm) x = target;
  }
  x = calm ? target : x + (target - x) * (1 - Math.exp(-dt / 0.32));
  if (Math.abs(target - x) < 0.02) x = target;
  // when we land at Verify on tour, decide pass/fail for this lap
  if (touring && Math.abs(x - STATIONS[3]) < 0.05) {
    failed = (Math.floor(clock / 2.4) % 5 === 4) ? (lap % 2 === 0) : failed;
  }
  draw();
  const settled = !touring && x === target;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => { touring = false; target = clamp(next, REACH[0], REACH[1]); clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.2) / 0.6, 0, 1);
  steer(REACH[0] + share * (REACH[1] - REACH[0]));
});
stage.addEventListener("pointerleave", () => steer(target));
// click left half to inject a failing test that loops the pallet back
stage.addEventListener("click", (event) => {
  const box = svg.getBoundingClientRect();
  const left = (event.clientX - box.left) / box.width < 0.5;
  failed = left;
  if (left) { touring = false; target = STATIONS[0]; lap++; }
  clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600); run();
});
stage.addEventListener("keydown", (event) => {
  const here = STATIONS.reduce((b, s, i) => (Math.abs(s - target) < Math.abs(STATIONS[b] - target) ? i : b), 0);
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = Math.min(STATIONS.length, here + 1);
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = Math.max(0, here - 1);
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = STATIONS.length;
  if (to === null) return;
  event.preventDefault();
  steer(to < STATIONS.length ? STATIONS[to] : REACH[1]);
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "The agent loop",
  hint: "Hover to scrub · click left half to fail the test",
  readout: "Plan · hold · lap 1",
  keys: [
    { mark: "lit", label: "Pallet, bit, pen, lens and gauge: the parts that touch the work" },
    { mark: "raised", label: "Four stations on posts: Plan, Implement, Review, Verify" },
  ],
  caption:
    "A coding agent's loop drawn as a transfer line. The pallet rides the carriage past Plan, Implement, Review and Verify. The dial gauge reads the part at Verify; a pass sends it down the exit chute, a fail runs it back to Plan for another lap.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Agent loop: arrow keys move the pallet from station to station" aria-valuemin="${STATION_X[0]}" aria-valuemax="${STATION_X[3] + 56}" aria-valuenow="${STATION_X[0]}">${svg}</div>`,
});

writeFileSync(
  join(HERE, theme === "light" ? "agent-loop-light.html" : "agent-loop.html"),
  k.pageHtml({ title: "The agent loop", theme, body, script: kitScript() + live }),
);
console.log("wrote", theme === "light" ? "agent-loop-light.html" : "agent-loop.html");
