#!/usr/bin/env node
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {escapeXml}=require('./render-panel-overlays');
const {releaseReadiness}=require('./release-readiness');
const root=process.cwd(),failures=[],summary=[];
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
for(const ep of ['EP002','EP003','EP004','EP005']){
 try{
  const base=`episodes/${ep}`;
  const panels=read(`${base}/panels/panels.json`).panels;
  const script=read(`${base}/script/panel-script.json`).panels;
  const storyboard=read(`${base}/storyboard/storyboard.json`).pages.flatMap(p=>p.panels);
  const overlays=read(`${base}/panels/text-overlays.json`).panels;
  const qa=read(`${base}/qa/qa.json`);
  const html=fs.readFileSync(path.join(root,`dist/season/episodes/${ep}/read.html`),'utf8');
  for(const rows of [script,storyboard,overlays])if(rows.length!==panels.length||new Set(rows.map(p=>p.panel_id)).size!==panels.length)throw Error('panel coverage mismatch');
  for(const p of panels){
   const row=script.find(r=>r.panel_id===p.panel_id),o=overlays.find(r=>r.panel_id===p.panel_id);
   if(row.description!==p.description||storyboard.find(r=>r.panel_id===p.panel_id)?.description!==p.description)throw Error(`${p.panel_id}: scene mismatch`);
   if(o.source_image_path!==p.image_path||o.source_sha256!==hash(p.image_path))throw Error(`${p.panel_id}: stale source`);
   const signature=crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
   if(o.canonical_signature!==signature)throw Error(`${p.panel_id}: stale text`);
   if(o.status!=='approved')throw Error(`${p.panel_id}: final review pending`);
   if(JSON.stringify(row.text)!==JSON.stringify(o.overlays.map(({kind,speaker,text})=>({kind,speaker,text}))))throw Error(`${p.panel_id}: text mismatch`);
   if(!html.includes(`id="${p.panel_id}"`)||!html.includes(escapeXml(p.image_path)))throw Error(`${p.panel_id}: reader omission`);
   for(const t of row.text)if(!html.includes(escapeXml(t.text)))throw Error(`${p.panel_id}: missing dialogue`);
   if(qa.artifact_sha256[p.image_path]!==hash(p.image_path)||qa.artifact_sha256[o.final_image_path]!==hash(o.final_image_path))throw Error(`${p.panel_id}: QA does not cover current files`);
  }
  if(qa.overall_score<42||qa.final_images.length!==panels.length)throw Error('QA gate failed');
  if(process.argv.includes('--require-release')){
   const release=releaseReadiness(root,ep);
   if(release.status!=='ready')throw Error(release.blockers.join('; '));
  }
  summary.push({episode:ep,panels:panels.length,qa:qa.overall_score,release:read(`${base}/approvals/gates.json`).gates.find(g=>g.id==='release').status});
 }catch(e){failures.push(`${ep}: ${e.message}`)}
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(JSON.stringify({production:'complete',episodes:summary},null,2));
