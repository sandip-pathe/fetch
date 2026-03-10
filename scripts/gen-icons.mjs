/**
 * Generates PNG icon assets for the PWA from public/icon.svg.
 * Run once: node scripts/gen-icons.mjs
 * Requires: npm install --save-dev @resvg/resvg-js
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dir, "../public/icon.svg");
const outDir = join(__dir, "../public");

const svg = readFileSync(svgPath, "utf8");

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  const pngData = resvg.render();
  writeFileSync(join(outDir, name), pngData.asPng());
  console.log(`✓ ${name}  ${size}×${size}`);
}
