/**
 * Generates simple local SVG placeholder posters/backdrops so the app never
 * depends on external image hosts or copyrighted movie art (per the master
 * spec's "no copyrighted assets" constraint). Deterministic per title so
 * reseeding produces the same look.
 */
import fs from "node:fs";
import path from "node:path";

const PALETTE = [
  ["#0f172a", "#38bdf8"],
  ["#1e1b4b", "#a78bfa"],
  ["#3f0d12", "#f97362"],
  ["#052e2b", "#2dd4bf"],
  ["#2e1065", "#f472b6"],
  ["#1a2e05", "#a3e635"],
  ["#431407", "#fb923c"],
  ["#0c2340", "#facc15"],
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

function posterSvg(title: string, classification: string): string {
  const [bg, accent] = PALETTE[hashString(title) % PALETTE.length];
  const lines = wrapTitle(title.toUpperCase(), 14);
  const startY = 300 - (lines.length - 1) * 22;
  const textLines = lines
    .map((line, i) => `<text x="200" y="${startY + i * 44}" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#f8fafc">${escapeXml(line)}</text>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg}" />
      <stop offset="1" stop-color="#000000" />
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#g)" />
  <rect x="24" y="24" width="352" height="552" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5" />
  <circle cx="200" cy="180" r="60" fill="${accent}" opacity="0.15" />
  ${textLines}
  <text x="200" y="540" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" letter-spacing="4" fill="${accent}">CINEBOOK</text>
  <text x="376" y="48" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="#f8fafc" opacity="0.8">${escapeXml(classification)}</text>
</svg>`;
}

function backdropSvg(title: string): string {
  const [bg, accent] = PALETTE[hashString(title + "backdrop") % PALETTE.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}" />
      <stop offset="1" stop-color="#000000" />
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)" />
  <g opacity="0.25">
    ${Array.from({ length: 8 })
      .map((_, i) => `<circle cx="${(i * 173) % 1280}" cy="${(i * 271) % 720}" r="${60 + (i % 3) * 40}" fill="${accent}" />`)
      .join("")}
  </g>
  <text x="64" y="640" font-family="Georgia, serif" font-size="56" fill="#f8fafc">${escapeXml(title)}</text>
</svg>`;
}

function escapeXml(input: string): string {
  return input.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);
}

export function writeMovieArt(slug: string, title: string, classification: string): { posterUrl: string; backdropUrl: string } {
  const postersDir = path.join(__dirname, "..", "public", "posters");
  const backdropsDir = path.join(__dirname, "..", "public", "backdrops");
  fs.mkdirSync(postersDir, { recursive: true });
  fs.mkdirSync(backdropsDir, { recursive: true });

  fs.writeFileSync(path.join(postersDir, `${slug}.svg`), posterSvg(title, classification), "utf-8");
  fs.writeFileSync(path.join(backdropsDir, `${slug}.svg`), backdropSvg(title), "utf-8");

  return { posterUrl: `/posters/${slug}.svg`, backdropUrl: `/backdrops/${slug}.svg` };
}
