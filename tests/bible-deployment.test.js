const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

test('Pages workflow packages every approved Bible artifact linked by the viewer', () => {
  const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/deploy.yml'), 'utf8');
  const viewer = fs.readFileSync(path.join(rootDir, 'docs/episodes/EP001/index.html'), 'utf8');
  const artifacts = [
    ['episodes/EP001/bible/bible.json', './bible/bible.json'],
    ['episodes/EP001/bible/application-evidence.json', './bible/application-evidence.json'],
    ['reports/CLE3-EP001-Bible-v1.1.docx', './bible/CLE3-EP001-Bible-v1.1.docx']
  ];

  for (const [source, publicHref] of artifacts) {
    assert.equal(fs.existsSync(path.join(rootDir, source)), true, `${source} must exist`);
    assert.match(workflow, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(viewer.includes(publicHref), `${publicHref} must be linked from the public viewer`);
  }
  assert.match(workflow, /episodes\/EP001\/bible\/\*\*/);
});
