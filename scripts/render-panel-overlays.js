#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const args = { episode: 'EP001', page: null };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--episode') args.episode = argv[++index];
    else if (value === '--page') args.page = Number(argv[++index]);
  }
  return args;
}

function pngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`not a PNG: ${filePath}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text, maxChars) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const words = normalized.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.flatMap((line) => {
    if (line.length <= maxChars) return [line];
    const chunks = [];
    for (let index = 0; index < line.length; index += maxChars) chunks.push(line.slice(index, index + maxChars));
    return chunks;
  });
}

function overlaySvg(overlay, width, height) {
  const box = overlay.box;
  const x = Math.round(box.x * width);
  const y = Math.round(box.y * height);
  const w = Math.round(box.w * width);
  const h = Math.round(box.h * height);
  const fontSize = overlay.kind === 'sfx'
    ? Math.round(height * 0.06)
    : overlay.kind === 'note'
      ? Math.round(height * 0.038)
      : Math.round(height * 0.024);
  const maxChars = Math.max(6, Math.floor(w / (fontSize * 0.72)));
  const lines = wrapText(overlay.text, maxChars).slice(0, 4);
  const lineHeight = Math.round(fontSize * 1.35);
  const textY = y + Math.round((h - lineHeight * lines.length) / 2) + fontSize;
  const fill = overlay.kind === 'caption' || overlay.kind === 'narration' ? '#111111' : '#ffffff';
  const stroke = overlay.kind === 'sfx' ? '#111111' : '#111111';
  const textFill = overlay.kind === 'caption' || overlay.kind === 'narration' ? '#ffffff' : overlay.kind === 'note' ? '#d14b83' : '#111111';
  const radius = overlay.kind === 'sfx' ? 12 : 28;
  const opacity = overlay.kind === 'caption' || overlay.kind === 'narration' ? 0.86 : overlay.kind === 'note' ? 0 : 0.96;
  const weight = overlay.kind === 'sfx' ? 900 : overlay.kind === 'note' ? 800 : 700;
  const textAnchor = overlay.kind === 'sfx' ? 'middle' : 'middle';
  const textX = x + Math.round(w / 2);
  const tspans = lines.map((line, index) => (
    `<tspan x="${textX}" y="${textY + index * lineHeight}">${escapeXml(line)}</tspan>`
  )).join('');

  if (overlay.kind === 'note') {
    return `<g class="overlay overlay-${overlay.kind}">
    <text text-anchor="${textAnchor}" font-family="'Apple SD Gothic Neo', 'Nanum Pen Script', cursive" font-size="${fontSize}" font-weight="${weight}" fill="${textFill}" stroke="#ffffff" stroke-width="${Math.max(2, Math.round(width * 0.003))}" paint-order="stroke">${tspans}</text>
  </g>`;
  }

  return `<g class="overlay overlay-${overlay.kind}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${Math.max(3, Math.round(width * 0.004))}" />
    <text text-anchor="${textAnchor}" font-family="'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${textFill}">${tspans}</text>
  </g>`;
}

function renderPanel(rootDir, panel) {
  const sourcePath = path.join(rootDir, panel.source_image_path);
  if (!fs.existsSync(sourcePath)) return false;
  const outputPath = path.join(rootDir, panel.final_image_path);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const size = pngSize(sourcePath);
  const href = path.relative(path.dirname(outputPath), sourcePath).split(path.sep).join('/');
  const overlays = (panel.overlays || []).map((overlay) => overlaySvg(overlay, size.width, size.height)).join('\n');
  const overlayBlock = overlays ? `\n  ${overlays}` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
  <image href="${escapeXml(href)}" x="0" y="0" width="${size.width}" height="${size.height}" />${overlayBlock}
</svg>
`;
  fs.writeFileSync(outputPath, svg);
  return true;
}

function main() {
  const args = parseArgs(process.argv);
  const rootDir = process.cwd();
  const overlayPath = path.join(rootDir, 'episodes', args.episode, 'panels', 'text-overlays.json');
  const overlays = readJson(overlayPath);
  let count = 0;
  for (const panel of overlays.panels || []) {
    if (args.page !== null && panel.page_number !== args.page) continue;
    if (renderPanel(rootDir, panel)) count += 1;
  }
  console.log(`rendered ${args.episode}: ${count}`);
}

main();
