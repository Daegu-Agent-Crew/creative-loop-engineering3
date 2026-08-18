const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  escapeXml,
  overlaySvg,
  parseArgs,
  renderEpisode,
  renderPanel,
  wrapText
} = require('../scripts/render-panel-overlays');

function writeMinimalPng(filePath, width = 320, height = 180) {
  const buffer = Buffer.alloc(24);
  buffer.write('\x89PNG\r\n\x1a\n', 0, 'binary');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

test('escapes XML and wraps long text deterministically', () => {
  assert.equal(escapeXml('A&B <C> "D"'), 'A&amp;B &lt;C&gt; &quot;D&quot;');
  assert.deepEqual(wrapText('123456789', 4), ['1234', '5678', '9']);
  assert.deepEqual(wrapText('alpha   beta gamma', 10), ['alpha beta', 'gamma']);
});

test('renders every supported overlay kind with the intended visual family', () => {
  const box = { x: 0.1, y: 0.1, w: 0.5, h: 0.25 };
  for (const kind of ['dialogue', 'caption', 'narration', 'sfx', 'note', 'title', 'screen']) {
    const svg = overlaySvg({ kind, text: `${kind} & test`, box }, 1000, 600);
    assert.match(svg, new RegExp(`overlay-${kind}`));
    assert.match(svg, /&amp;/);
    if (['note', 'sfx', 'title'].includes(kind)) assert.doesNotMatch(svg, /<rect/);
    else assert.match(svg, /<rect/);
  }
  assert.match(overlaySvg({ kind: 'screen', text: 'READY', box }, 1000, 600), /#6de8ff/);
});

test('applies rotation only when requested', () => {
  const box = { x: 0, y: 0, w: 0.5, h: 0.5 };
  assert.match(overlaySvg({ kind: 'note', text: '회전', rotation: 12, box }, 100, 100), /rotate\(12/);
  assert.doesNotMatch(overlaySvg({ kind: 'note', text: '고정', box }, 100, 100), /rotate\(/);
});

test('renders relative and embedded source SVGs and rejects a missing source', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cle3-render-'));
  const source = 'episodes/EP999/panels/assets/p1-1.png';
  const output = 'episodes/EP999/panels/final/p1-1.svg';
  writeMinimalPng(path.join(rootDir, source));
  const panel = { source_image_path: source, final_image_path: output, overlays: [] };
  assert.equal(renderPanel(rootDir, panel), true);
  assert.match(fs.readFileSync(path.join(rootDir, output), 'utf8'), /href="\.\.\/assets\/p1-1\.png"/);
  assert.equal(renderPanel(rootDir, { ...panel, final_image_path: 'episodes/EP999/panels/final/embedded.svg' }, { embedSource: true }), true);
  assert.match(fs.readFileSync(path.join(rootDir, 'episodes/EP999/panels/final/embedded.svg'), 'utf8'), /data:image\/png;base64/);
  assert.equal(renderPanel(rootDir, { ...panel, source_image_path: 'missing.png' }), false);
});

test('filters an episode render by page and parses CLI options', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cle3-episode-'));
  const manifestDir = path.join(rootDir, 'episodes/EP999/panels');
  fs.mkdirSync(manifestDir, { recursive: true });
  for (const id of ['p1-1', 'p2-1']) writeMinimalPng(path.join(manifestDir, `assets/${id}.png`));
  fs.writeFileSync(path.join(manifestDir, 'text-overlays.json'), JSON.stringify({
    panels: [
      { panel_id: 'p1-1', page_number: 1, source_image_path: 'episodes/EP999/panels/assets/p1-1.png', final_image_path: 'episodes/EP999/panels/final/p1-1.svg', overlays: [] },
      { panel_id: 'p2-1', page_number: 2, source_image_path: 'episodes/EP999/panels/assets/p2-1.png', final_image_path: 'episodes/EP999/panels/final/p2-1.svg', overlays: [] }
    ]
  }));
  const args = parseArgs(['node', 'script', '--episode', 'EP999', '--page', '2', '--embed-source']);
  assert.deepEqual(args, { episode: 'EP999', page: 2, embedSource: true });
  assert.equal(renderEpisode(rootDir, args), 1);
  assert.equal(fs.existsSync(path.join(manifestDir, 'final/p1-1.svg')), false);
  assert.match(fs.readFileSync(path.join(manifestDir, 'final/p2-1.svg'), 'utf8'), /data:image\/png;base64/);
});

