#!/usr/bin/env python3
"""Compress newly generated delivery files; retain exact PNG originals in .candidates."""
import hashlib, json, subprocess
from pathlib import Path

for episode in ('EP002', 'EP003', 'EP004', 'EP005'):
    meta = Path('episodes') / episode / 'panels/panels.json'
    data = json.loads(meta.read_text())
    for panel in data['panels']:
        source = Path(panel['image_path'])
        if source.suffix != '.png' or not source.exists():
            continue
        # Only sources created by this production run have preserved candidates.
        candidates = Path('.candidates') / episode / panel['panel_id']
        digest = hashlib.sha256(source.read_bytes()).digest()
        if not candidates.exists() or not any(hashlib.sha256(p.read_bytes()).digest() == digest for p in candidates.rglob('*.png')):
            continue
        target = source.with_suffix('.webp')
        subprocess.run(['cwebp', '-quiet', '-q', '90', '-m', '6', str(source), '-o', str(target)], check=True)
        if target.stat().st_size > 1_000_000:
            subprocess.run(['cwebp', '-quiet', '-q', '82', '-m', '6', str(source), '-o', str(target)], check=True)
        panel['image_path'] = str(target)
        record = meta.parent / 'generation-records' / (panel['panel_id'] + '.json')
        if record.exists():
            item = json.loads(record.read_text())
            item['asset'] = str(target)
            item['delivery_sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
            item['source_sha256'] = digest.hex()
            record.write_text(json.dumps(item, ensure_ascii=False, indent=2) + '\n')
        # Exact originals remain in the candidate archive and native tool output.
        tracked = subprocess.run(["git", "show", "HEAD:" + str(source)], capture_output=True)
        if tracked.returncode == 0:
            # Keep the pre-existing reference anchor byte-for-byte at its old path.
            source.write_bytes(tracked.stdout)
        else:
            source.unlink()
    meta.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(episode, sum(Path(p['image_path']).stat().st_size for p in data['panels'] if Path(p['image_path']).exists()))
