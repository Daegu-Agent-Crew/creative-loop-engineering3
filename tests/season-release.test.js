const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('public packaging requires complete-season release checks before copying readers',()=>{
 const s=fs.readFileSync(path.join(root,'.github/workflows/deploy.yml'),'utf8');
 assert.ok(s.indexOf('node scripts/build-season-reader.js')<s.indexOf('node scripts/validate-season-readiness.js --require-release'));
 assert.ok(s.indexOf('node scripts/validate-season-readiness.js --require-release')<s.indexOf('cp -R dist/season/. _site/'));
});
test('season release validator rejects a pending approval even with matching QA artifacts',()=>{
 const os=require('node:os'),crypto=require('node:crypto');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cle3-release-'));
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const write=(p,d)=>{const f=path.join(tmp,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof d==='string'?d:JSON.stringify(d));};
 try{
  fs.cpSync(path.join(root,'scripts'),path.join(tmp,'scripts'),{recursive:true});
  write('approval.md','User explicitly approved publication.');const state={episodes:{}};
  for(const ep of ['EP002','EP003','EP004','EP005']){
   const base=`episodes/${ep}`,source=`${base}/panels/assets/p1.png`,final=`${base}/panels/final/p1.svg`;
   const row={panel_id:'p1',description:'test scene',text:[]};
   write(source,'fixture source');write(final,'fixture final');
   write(`${base}/panels/panels.json`,{episode_id:ep,panels:[{...row,image_path:source,generation_status:'selected'}]});
   write(`${base}/script/panel-script.json`,{panels:[row]});
   write(`${base}/storyboard/storyboard.json`,{pages:[{panels:[row]}]});
   write(`${base}/panels/text-overlays.json`,{episode_id:ep,panels:[{panel_id:'p1',source_image_path:source,final_image_path:final,source_sha256:hash('fixture source'),canonical_signature:hash(JSON.stringify(row)),status:'approved',overlays:[]}]});
   write(`${base}/qa/qa.json`,{episode_id:ep,overall_score:45,items:Array.from({length:5},()=>({score:9})),final_images:[final],artifact_sha256:{[source]:hash('fixture source'),[final]:hash('fixture final')}});
   write(`${base}/approvals/gates.json`,{episode_id:ep,gates:[{id:'release',status:'approved',approved_by:'User',approved_at:'2026-09-16T00:00:00Z',evidence:['approval.md']}]});
   write(`dist/season/episodes/${ep}/read.html`,`<figure id="p1"><img src="${source}"></figure>`);
   state.episodes[ep]={phases:{phase4:{status:'completed'},phase5:{status:'completed'}}};
  }
  write('state.json',state);
  const run=()=>cp.spawnSync(process.execPath,['scripts/validate-season-readiness.js','--require-release'],{cwd:tmp,encoding:'utf8'});
  const approved=run();assert.equal(approved.status,0,approved.stderr);
  const gatePath='episodes/EP004/approvals/gates.json';const gates=JSON.parse(fs.readFileSync(path.join(tmp,gatePath)));gates.gates[0].status='pending';write(gatePath,gates);
  const pending=run();assert.notEqual(pending.status,0);assert.match(pending.stderr,/EP004: human release approval pending/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
