---
name: agent-loop-anatomy
description: |
  Generate isometric SVG figures that explain a coding agent's
  Plan → Implement → Review → Verify loop as a real physical machine.
  Includes two working figures built with the Anatomy kit: a linear
  transfer line and a rotary indexing machine, each with live
  interaction, dark/light themes, and zero floating line-ends.
license: MIT
compatibility: Works with Claude Code, OpenCode, and Codex. Requires the global Anatomy skill's kit/ and scripts/ (bundled here), Node.js 22+, and Chrome/Chromium for screenshots and line checks.
metadata:
  opencode/slash: "true"
---

# Agent Loop Anatomy

Two ready-to-build figures that turn the agent workflow loop into a physical machine you can watch.

## Included figures

- `examples/agent-loop/` — a linear transfer line. A pallet rides a carriage along rails past four station heads: Plan (drafting pen), Implement (drill), Review (magnifier), and Verify (dial gauge). A pass sends the part down the exit chute; a click on the left half injects a failing test and loops the pallet back to Plan.
- `examples/rotary-check-machine/` — a rotary indexing machine. A turntable carries the pallet between the same four stations. At Verify, the dial reads the part: pass ejects it down the chute, fail turns the table for another lap.

## How to build

```bash
# Build both figures in dark and light themes
node examples/agent-loop/build.mjs
node examples/agent-loop/build.mjs --light
node examples/rotary-check-machine/build.mjs
node examples/rotary-check-machine/build.mjs --light
```

Each script writes a standalone `.html` next to itself.

## Verify the craft

```bash
# Screenshot
node scripts/capture.mjs examples/agent-loop/agent-loop.html --out examples/agent-loop/agent-loop.png
node scripts/capture.mjs examples/rotary-check-machine/rotary-check-machine.html --out examples/rotary-check-machine/rotary-check-machine.png

# Line-end check (should print "line ends: 0")
node scripts/lines.mjs examples/agent-loop/agent-loop.html
node scripts/lines.mjs examples/rotary-check-machine/rotary-check-machine.html
```

## Files

- `examples/agent-loop/build.mjs`
- `examples/rotary-check-machine/build.mjs`
- `kit/iso-kit.mjs`, `kit/iso-kit.ts`, `kit/iso.css`
- `scripts/inline-kit.mjs`, `scripts/capture.mjs`, `scripts/lines.mjs`

## Notes

- Figures are intentionally mid-sized (not Hero/Epic) so they build in seconds and open in any browser without WebGL.
- The Anatomy kit is included so the examples are self-contained; it mirrors the upstream kit at `github.com/wheresryan22/anatomy`.
