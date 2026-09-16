/**
 * Generates local SVG poster/backdrop artwork so the app never depends on
 * external image hosts or copyrighted movie stills (the master spec
 * explicitly prohibits shipping real movie posters we don't hold rights
 * to). These are deliberately more elaborate than flat placeholders —
 * layered gradients, a soft "aurora" glow, a film-grain-like noise
 * texture, and a vignette — to read as designed key art rather than a
 * wireframe box, while staying 100% procedurally generated and
 * copyright-safe. Deterministic per title so reseeding looks the same.
 */
import fs from "node:fs";
import path from "node:path";

// Navy/gold "aurora" palette, matching src/app/globals.css.
const NAVY = ["#060b1a", "#0d1730", "#142344"];
const ACCENTS = [
  ["#e8b954", "#f5d78e"], // gold
  ["#2dd4c8", "#7fe9e0"], // teal
  ["#6d5ce8", "#a79bf2"], // violet
  ["#e8b954", "#2dd4c8"], // gold+teal mix
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function wrapTitle(title: string, maxCharsPerLine: number): string[] {
  const words = title.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeXml(input: string): string {
  return input.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);
}

// A subtle repeating grain pattern so flat gradients don't look artificially
// clean/flat — reads more like printed key art than a UI mockup.
const GRAIN_FILTER = `
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="noise" />
    <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.035 0" />
  </filter>`;

function posterSvg(title: string, classification: string, language: string): string {
  const h = hashString(title);
  const navy = NAVY[h % NAVY.length];
  const [accent, accentLight] = ACCENTS[h % ACCENTS.length];
  const lines = wrapTitle(title.toUpperCase(), 14);
  const startY = 320 - (lines.length - 1) * 22;
  const textLines = lines
    .map(
      (line, i) =>
        `<text x="200" y="${startY + i * 44}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="32" font-weight="700" fill="#f2f5ff" letter-spacing="0.5">${escapeXml(line)}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <defs>
    ${GRAIN_FILTER}
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="${navy}" />
      <stop offset="0.55" stop-color="#060b1a" />
      <stop offset="1" stop-color="#02040c" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="28%" r="55%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55" />
      <stop offset="1" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glow2" cx="80%" cy="75%" r="45%">
      <stop offset="0" stop-color="${accentLight}" stop-opacity="0.3" />
      <stop offset="1" stop-color="${accentLight}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.5" />
      <stop offset="0.3" stop-color="#000000" stop-opacity="0" />
      <stop offset="0.75" stop-color="#000000" stop-opacity="0" />
      <stop offset="1" stop-color="#000000" stop-opacity="0.65" />
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#bg)" />
  <rect width="400" height="600" fill="url(#glow)" />
  <rect width="400" height="600" fill="url(#glow2)" />
  <rect width="400" height="600" fill="#ffffff" filter="url(#grain)" opacity="0.5" />
  <circle cx="200" cy="185" r="70" fill="none" stroke="${accent}" stroke-width="1" opacity="0.35" />
  <circle cx="200" cy="185" r="90" fill="none" stroke="${accentLight}" stroke-width="0.5" opacity="0.2" />
  ${textLines}
  <rect width="400" height="600" fill="url(#vignette)" />
  <rect x="20" y="20" width="360" height="560" fill="none" stroke="${accent}" stroke-width="1" opacity="0.4" />
  <text x="24" y="44" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="${accent}" opacity="0.9">${escapeXml(classification)}</text>
  <text x="376" y="44" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#f2f5ff" opacity="0.8">${escapeXml(language)}</text>
  <text x="200" y="562" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" letter-spacing="5" fill="${accent}" opacity="0.85">CINEBOOK</text>
</svg>`;
}

function backdropSvg(title: string): string {
  const h = hashString(title + "backdrop");
  const navy = NAVY[h % NAVY.length];
  const [accent, accentLight] = ACCENTS[(h + 1) % ACCENTS.length];

  const blobs = Array.from({ length: 5 })
    .map((_, i) => {
      const cx = (i * 311 + h) % 1280;
      const cy = (i * 197 + h) % 720;
      const r = 140 + (i % 3) * 80;
      const color = i % 2 === 0 ? accent : accentLight;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.16" />`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    ${GRAIN_FILTER}
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${navy}" />
      <stop offset="1" stop-color="#02040c" />
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0" />
      <stop offset="1" stop-color="#000000" stop-opacity="0.55" />
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)" />
  <g>${blobs}</g>
  <rect width="1280" height="720" fill="#ffffff" filter="url(#grain)" opacity="0.4" />
  <rect width="1280" height="720" fill="url(#fade)" />
  <text x="64" y="648" font-family="Georgia, 'Times New Roman', serif" font-size="52" font-weight="700" fill="#f2f5ff">${escapeXml(title)}</text>
</svg>`;
}

export function writeMovieArt(slug: string, title: string, classification: string, language = "English"): { posterUrl: string; backdropUrl: string } {
  const postersDir = path.join(__dirname, "..", "public", "posters");
  const backdropsDir = path.join(__dirname, "..", "public", "backdrops");
  fs.mkdirSync(postersDir, { recursive: true });
  fs.mkdirSync(backdropsDir, { recursive: true });

  fs.writeFileSync(path.join(postersDir, `${slug}.svg`), posterSvg(title, classification, language), "utf-8");
  fs.writeFileSync(path.join(backdropsDir, `${slug}.svg`), backdropSvg(title), "utf-8");

  return { posterUrl: `/posters/${slug}.svg`, backdropUrl: `/backdrops/${slug}.svg` };
}
