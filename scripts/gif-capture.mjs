// gif-capture.mjs — capture a sequence of frames from an HTML figure, then
// stitch them into an animated GIF with ffmpeg. Uses the same CDP approach
// as capture.mjs (raw WebSocket, no puppeteer dependency).

import { chromePort } from "./chrome-port.mjs";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (typeof WebSocket === "undefined" && !process.execArgv.includes("--experimental-websocket")) {
  const child = spawn(process.execPath, ["--experimental-websocket", ...process.argv.slice(1)], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await main();
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  return candidates.find((p) => { try { return existsSync(p); } catch { return false; } });
}

function ffmpegPath() {
  const candidates = [
    process.env.FFMPEG_PATH,
    "C:\\Users\\ROG\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe",
    "/usr/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
  ].filter(Boolean);
  return candidates.find((p) => { try { return existsSync(p); } catch { return false; } }) || "ffmpeg";
}

function usage() {
  console.log(`Capture an animated GIF from an HTML figure.

  node gif-capture.mjs <file.html> [options]

  --out <gif>         output path (default: output.gif)
  --frames <n>        number of frames (default 30)
  --interval <ms>     ms between frames (default 500)
  --width <px>        viewport width (default 900)
  --height <px>       viewport height (default 700)
  --scale <n>         device pixel ratio (default 2)
  --wait <ms>         initial settle time (default 2000)
  --fps <n>           GIF playback fps (default 10)
  --actions <json>    array of {t:<ms>, type:"move"|"click"|"key", x:<frac>, y:<frac>, key:<str>}
                      to drive interaction during recording
`);
}

async function main() {
  const argv = process.argv.slice(2);
  let target = null;
  const opt = { out: "output.gif", frames: 30, interval: 500, width: 900, height: 700, scale: 2, wait: 2000, fps: 10, actions: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === "--out") opt.out = next();
    else if (a === "--frames") opt.frames = Number(next());
    else if (a === "--interval") opt.interval = Number(next());
    else if (a === "--width") opt.width = Number(next());
    else if (a === "--height") opt.height = Number(next());
    else if (a === "--scale") opt.scale = Number(next());
    else if (a === "--wait") opt.wait = Number(next());
    else if (a === "--fps") opt.fps = Number(next());
    else if (a === "--actions") opt.actions = JSON.parse(next());
    else if (a === "--help" || a === "-h") { usage(); process.exit(0); }
    else target = a;
  }
  if (!target) { usage(); process.exit(1); }

  const url = /^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(target)).href;
  const outGif = resolve(opt.out);
  const frameDir = mkdtempSync(join(tmpdir(), "gif-frames-"));

  const binary = chromePath();
  if (!binary) { console.error("No Chrome found. Set CHROME_PATH."); process.exit(1); }

  const profile = mkdtempSync(join(tmpdir(), "iso-gif-"));
  const chrome = spawn(binary, [
    "--headless=new", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--hide-scrollbars",
    "--allow-file-access-from-files", "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist", "about:blank",
  ]);

  const port = await chromePort(chrome, profile);
  const finish = (code) => {
    chrome.kill("SIGKILL");
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
    try { rmSync(frameDir, { recursive: true, force: true }); } catch {}
    process.exit(code);
  };

  try {
    const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (msg) => {
      const d = JSON.parse(msg.data);
      if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    };
    await new Promise((r) => (ws.onopen = r));
    const send = (m, p = {}) => new Promise((r) => { const c = ++id; pending.set(c, r); ws.send(JSON.stringify({ id: c, method: m, params: p })); });
    const eval_ = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: opt.width, height: opt.height, deviceScaleFactor: opt.scale, mobile: false });
    await send("Page.navigate", { url });
    await sleep(opt.wait);

    // Focus the stage so keyboard events are received
    await eval_(`(()=>{const s=document.querySelector(".iso-stage");if(s)s.focus();})()`);

    // Get the .iso-plate bounding box
    const box = await eval_(`(()=>{const el=document.querySelector(".iso-plate")||document.querySelector("svg")||document.body;el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return{x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height,vx:r.left,vy:r.top}})()`);

    const clip = { x: box.x - 4, y: box.y - 4, width: box.w + 8, height: box.h + 8, scale: 1 };

    const shoot = async (path) => {
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
      writeFileSync(path, Buffer.from(shot.result.data, "base64"));
    };

    const actions = [...opt.actions].sort((a, b) => a.t - b.t);
    let actionIdx = 0;
    const startTime = Date.now();

    // Initial hover from top-left to center to wake up interactivity
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.vx + 2, y: box.vy + 2 });
    await sleep(100);

    for (let f = 0; f < opt.frames; f++) {
      const now = Date.now() - startTime;

      // Process actions whose time has come
      while (actionIdx < actions.length && actions[actionIdx].t <= now) {
        const act = actions[actionIdx];
        const ax = box.vx + box.w * (act.x ?? 0.5);
        const ay = box.vy + box.h * (act.y ?? 0.5);
        if (act.type === "move") {
          for (let s = 1; s <= 8; s++) {
            await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.vx + 2 + ((ax - box.vx - 2) * s) / 8, y: box.vy + 2 + ((ay - box.vy - 2) * s) / 8 });
            await sleep(20);
          }
        } else if (act.type === "click") {
          await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: ax, y: ay });
          await sleep(50);
          await send("Input.dispatchMouseEvent", { type: "mousePressed", x: ax, y: ay, button: "left", clickCount: 1 });
          await sleep(30);
          await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: ax, y: ay, button: "left", clickCount: 1 });
        } else if (act.type === "key" && act.key) {
          const key = act.key;
          const code = key.length === 1 ? (/[0-9]/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`) : key;
          await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, text: key.length === 1 ? key : undefined });
          await send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
        }
        actionIdx++;
      }

      const framePath = join(frameDir, `frame_${String(f).padStart(4, "0")}.png`);
      await shoot(framePath);
      const readout = await eval_(`(()=>{const el=document.querySelector(".iso-stage");const plate=el&&el.closest(".iso-plate")||document.querySelector(".iso-plate");return(plate.querySelector("[data-readout]")||{}).textContent||""})()`);
      console.log(`frame ${f + 1}/${opt.frames} at ${now}ms · readout "${readout}"`);
      await sleep(opt.interval);
    }

    ws.close();

    const ff = ffmpegPath();
    const palette = join(frameDir, "palette.png");
    const listPath = join(frameDir, "frames.txt");
    const lines = readdirSync(frameDir)
      .filter((f) => f.endsWith(".png") && f.startsWith("frame_"))
      .sort()
      .map((f) => `file '${join(frameDir, f).replace(/\\/g, "/")}'`)
      .join("\n");
    writeFileSync(listPath, lines);

    // Generate palette for better quality
    const ffmpegPalette = spawn(ff, [
      "-y", "-i", `${join(frameDir, "frame_%04d.png").replace(/\\/g, "/")}`,
      "-vf", "palettegen=max_colors=128",
      palette.replace(/\\/g, "/"),
    ], { stdio: "pipe" });
    const paletteExit = await new Promise((r) => ffmpegPalette.on("exit", r));
    if (paletteExit !== 0) throw new Error(`ffmpeg palettegen exited ${paletteExit}`);

    const fps = opt.fps;
    const ffmpegGif = spawn(ff, [
      "-y",
      "-framerate", String(fps),
      "-i", `${join(frameDir, "frame_%04d.png").replace(/\\/g, "/")}`,
      "-i", palette.replace(/\\/g, "/"),
      "-lavfi", `paletteuse=dither=bayer:bayer_scale=5`,
      "-gifflags", "+transdiff",
      outGif.replace(/\\/g, "/"),
    ], { stdio: "pipe" });

    ffmpegGif.stdout.on("data", () => {});
    ffmpegGif.stderr.on("data", (d) => process.stderr.write(d));
    const gifExit = await new Promise((r) => ffmpegGif.on("exit", r));
    if (gifExit !== 0) throw new Error(`ffmpeg gif exited ${gifExit}`);

    await sleep(500); // let the filesystem flush the GIF before we exit
    if (!existsSync(outGif) || statSync(outGif).size === 0) {
      console.error(`GIF write failed; frames preserved in ${frameDir}`);
      finish(1);
    }
    console.log(`GIF saved: ${outGif} (${Math.round(statSync(outGif).size / 1024)}KiB)`);
    finish(0);
  } catch (err) {
    console.error(err);
    finish(1);
  }
}
