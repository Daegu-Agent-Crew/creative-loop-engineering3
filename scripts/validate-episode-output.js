#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertRepoFile(rootDir, relativePath, label) {
  assert(typeof relativePath === 'string' && relativePath.length > 0, `${label}: path is required`);
  assert(!path.isAbsolute(relativePath), `${label}: absolute paths are not allowed`);
  const resolvedRoot = path.resolve(rootDir);
  const resolved = path.resolve(rootDir, relativePath);
  assert(resolved.startsWith(`${resolvedRoot}${path.sep}`), `${label}: path escapes repository`);
  assert(fs.existsSync(resolved), `${label}: missing ${relativePath}`);
}

function main() {
  const rootDir = process.cwd();
  const episodeId = process.argv[2] || 'EP001';
  assert(/^EP\d{3}$/.test(episodeId), 'episode id must match EP###');
  const prefix = `episodes/${episodeId}`;
  const overlays = readJson(rootDir, `${prefix}/panels/text-overlays.json`);
  const panels = readJson(rootDir, `${prefix}/panels/panels.json`);
  const characters = readJson(rootDir, `${prefix}/characters/characters.json`);
  const qa = readJson(rootDir, `${prefix}/qa/qa.json`);
  const approvals = readJson(rootDir, `${prefix}/approvals/gates.json`);
  const overlaySchema = readJson(rootDir, 'schemas/text-overlays.schema.json');
  const characterSchema = readJson(rootDir, 'schemas/characters.schema.json');
  const overlayKinds = overlaySchema.properties.panels.items.properties.overlays.items.properties.kind.enum;
  const characterStatuses = characterSchema.properties.characters.items.properties.generation_status.enum;

  assert(overlays.episode_id === episodeId, 'overlay episode mismatch');
  assert(overlays.panels.length === panels.panels.length, 'panel and overlay counts differ');
  const panelIds = new Set(panels.panels.map((panel) => panel.panel_id));
  assert(panelIds.size === panels.panels.length, 'duplicate panel id');
  for (const panel of panels.panels) {
    assertRepoFile(rootDir, panel.image_path, `panel ${panel.panel_id}`);
    for (const reference of panel.reference_assets || []) {
      assertRepoFile(rootDir, reference, `panel ${panel.panel_id} reference`);
    }
  }

  for (const panel of overlays.panels) {
    assert(panelIds.has(panel.panel_id), `overlay references unknown panel ${panel.panel_id}`);
    assertRepoFile(rootDir, panel.source_image_path, `overlay ${panel.panel_id} source`);
    assertRepoFile(rootDir, panel.final_image_path, `overlay ${panel.panel_id} final`);
    for (const overlay of panel.overlays || []) {
      assert(overlayKinds.includes(overlay.kind), `${panel.panel_id}: unsupported overlay kind ${overlay.kind}`);
      if (overlay.rotation !== undefined) {
        assert(Number.isFinite(overlay.rotation) && Math.abs(overlay.rotation) <= 360, `${panel.panel_id}: invalid rotation`);
      }
    }
  }

  for (const character of characters.characters) {
    if (character.generation_status) {
      assert(characterStatuses.includes(character.generation_status), `${character.name}: unsupported character status ${character.generation_status}`);
    }
    if (character.image_path) assertRepoFile(rootDir, character.image_path, `character ${character.name}`);
  }

  const qaTotal = qa.items.reduce((sum, item) => sum + item.score, 0);
  assert(qaTotal === qa.overall_score, `QA score mismatch: items=${qaTotal}, overall=${qa.overall_score}`);
  assert(new Set(qa.final_images).size === qa.final_images.length, 'QA final image list contains duplicates');
  assert(qa.final_images.length === panels.panels.length, 'QA final image count does not match panel count');
  for (const finalImage of qa.final_images) assertRepoFile(rootDir, finalImage, 'QA final image');

  const release = approvals.gates.find((gate) => gate.id === 'release');
  if (release?.status === 'approved') {
    assert(qa.overall_score >= 42, 'release approved below QA threshold');
    assert(!overlays.panels.some((panel) => panel.status === 'draft'), 'release approved with draft overlays');
  }

  const exportPath = `${prefix}/exports/cle5-bible-export.json`;
  assertRepoFile(rootDir, exportPath, 'CLE5 Bible export');
  const bibleExport = readJson(rootDir, exportPath);
  assert(bibleExport.format === 'CLE5_BIBLE_EXPORT_V1', 'invalid Bible export format');
  assert(bibleExport.approval?.status === 'approved', 'Bible export is not approved');
  assert(Array.isArray(bibleExport.assets) && bibleExport.assets.length > 0, 'Bible export has no assets');
  for (const asset of bibleExport.assets) {
    assert(asset.id && asset.label && asset.kind, 'Bible export asset identity is incomplete');
    assert(!String(asset.assetUrl || '').includes('creative-loop-engineering3'), `${asset.id}: CLE3 path leaked into CLE5 assetUrl`);
    if (asset.sourceAssetPath) assertRepoFile(rootDir, asset.sourceAssetPath, `Bible export ${asset.id} source`);
  }

  const seriesBiblePath = `${prefix}/bible/bible.json`;
  assertRepoFile(rootDir, seriesBiblePath, 'CLE3 series Bible');
  const seriesBible = readJson(rootDir, seriesBiblePath);
  assert(seriesBible.episode_id === episodeId, 'series Bible episode mismatch');
  assert(seriesBible.status === 'approved', 'series Bible is not approved');
  assertRepoFile(rootDir, seriesBible.approval_evidence, 'series Bible approval evidence');
  assert(Array.isArray(seriesBible.world_rules) && seriesBible.world_rules.length >= 3, 'series Bible world coverage is incomplete');
  assert(Array.isArray(seriesBible.characters) && seriesBible.characters.length >= 5, 'series Bible character coverage is incomplete');
  assert(Array.isArray(seriesBible.locations) && seriesBible.locations.length >= 5, 'series Bible location coverage is incomplete');
  assert(Array.isArray(seriesBible.props) && seriesBible.props.length >= 5, 'series Bible prop coverage is incomplete');
  for (const character of seriesBible.characters) assertRepoFile(rootDir, character.reference_asset, `series Bible ${character.id}`);
  for (const item of [...seriesBible.locations, ...seriesBible.props]) assertRepoFile(rootDir, item.anchor_asset, `series Bible ${item.id}`);

  const applicationEvidence = readJson(rootDir, seriesBible.approval_evidence);
  assert(applicationEvidence.bible?.version === seriesBible.version, 'Bible application evidence version mismatch');
  assert(Array.isArray(applicationEvidence.cards) && applicationEvidence.cards.length >= 2, 'Bible application evidence requires at least two creation cards');
  for (const card of applicationEvidence.cards) {
    assert(card.bible?.status === 'approved', `${card.panel_id}: creation card Bible is not approved`);
    assert(card.compiled_prompt?.includes('CLE3 APPROVED CREATION BIBLE'), `${card.panel_id}: compiled Bible prompt missing`);
    assert(Array.isArray(card.references) && card.references.length > 0, `${card.panel_id}: approved Bible references missing`);
  }

  assertRepoFile(rootDir, 'reports/CLE3-EP001-Bible-v1.1.docx', 'Bible visual report');

  const viewerPath = `docs/episodes/${episodeId}/index.html`;
  assertRepoFile(rootDir, viewerPath, 'public viewer');
  const viewer = fs.readFileSync(path.join(rootDir, viewerPath), 'utf8');
  assert(!viewer.includes('[DRY RUN]'), 'public viewer still contains DRY RUN content');
  for (const panel of panels.panels) {
    assert(viewer.includes(`'${panel.panel_id}'`), `public viewer is missing ${panel.panel_id}`);
  }

  console.log(`episode output ok: ${episodeId}, ${panels.panels.length} panels, QA ${qa.overall_score}/50, ${bibleExport.assets.length} exported + ${seriesBible.locations.length} location + ${seriesBible.props.length} prop Bible assets`);
}

if (require.main === module) main();
