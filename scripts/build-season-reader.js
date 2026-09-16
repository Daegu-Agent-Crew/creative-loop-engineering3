#!/usr/bin/env node
// Assemble an offline-readable season without changing release approval records.
const fs=require('fs'),path=require('path');
const {build}=require('./build-comic-reader');
const {renderPanel,escapeXml}=require('./render-panel-overlays');
const root=process.cwd(),out=path.join(root,'dist/season');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
fs.mkdirSync(out,{recursive:true});
const episodes=Array.from({length:5},(_,i)=>`EP${String(i+1).padStart(3,'0')}`);
const cards=[];
for(const ep of episodes){
 const panels=read(`episodes/${ep}/panels/panels.json`).panels;
 const title=read(`episodes/${ep}/script/script.json`).title;
 const dest=path.join(out,'episodes',ep);fs.mkdirSync(dest,{recursive:true});
 if(ep==='EP001'){
  const overlays=read('episodes/EP001/panels/text-overlays.json');
  for(const panel of overlays.panels){
   if(!renderPanel(root,{...panel,final_image_path:`dist/season/episodes/EP001/panels/final/${panel.panel_id}.svg`},{embedSource:true}))throw Error(`EP001 missing final ${panel.panel_id}`);
  }
  let html=fs.readFileSync(path.join(root,'docs/episodes/EP001/index.html'),'utf8');
  html=html.replace(/<p>세 개의 태양[\s\S]*?<\/p>/,'<p>세 개의 태양에서 시작된 질문이 40년 뒤 한 물리학자의 모니터로 되돌아온다.</p>')
   .replace(/<span class="badge pass">.*?<\/span>/,'').replace(/<span class="badge">Release approved<\/span>/,'')
   .replace('← CLE3 홈','← 전체 회차').replace('href="../../"','href="../../season.html"')
   .replace(/<footer class="footer">[\s\S]*?<\/footer>/,'<footer class="footer"><a href="../EP002/read.html">다음 화 · 카운트다운 →</a></footer>');
  fs.writeFileSync(path.join(dest,'index.html'),html);
 }else{
  build(root,ep,{public:true,outputRoot:out});
  for(const p of panels){const target=path.join(out,p.image_path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,p.image_path),target);}
 }
 const link=`episodes/${ep}/${ep==='EP001'?'index.html':'read.html'}`;
 const cover=panels[0].image_path,target=path.join(out,cover);fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target))fs.copyFileSync(path.join(root,cover),target);
 cards.push(`<a class="episode" href="${link}"><img src="${cover}" alt="" loading="lazy"><div><small>${ep}</small><h2>${escapeXml(title)}</h2><p>${Math.max(...panels.map(p=>p.page_number))}페이지 · ${panels.length}컷</p></div><span aria-hidden="true">↗</span></a>`);
}
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>삼체 · 파일럿 시즌 완결</title><style>*{box-sizing:border-box}body{margin:0;background:#0c1017;color:#f4efe5;font-family:'Apple SD Gothic Neo',sans-serif}main{max-width:980px;margin:auto;padding:64px 24px}small{letter-spacing:.16em;color:#d8ad63}h1{font-size:clamp(48px,9vw,90px);margin:18px 0}header p{color:#aab6c7;line-height:1.8;max-width:580px}.start{display:inline-block;margin:20px 0 48px;padding:14px 24px;background:#e3bc78;color:#161b24;border-radius:4px}.episode{display:flex;align-items:center;gap:24px;border-top:1px solid #303844;padding:24px 0;color:inherit}.episode img{width:150px;height:120px;object-fit:cover}.episode div{flex:1}h2{font-size:24px;margin:8px 0}.episode p,footer{color:#96a2b4}a{text-decoration:none}a:hover h2,a:focus h2{text-decoration:underline}footer{margin-top:48px;line-height:1.8}@media(max-width:520px){main{padding:32px 18px}.episode{gap:16px}.episode img{width:92px;height:112px}h2{font-size:21px}}</style><main><header><small>THREE BODY · PILOT SEASON</small><h1>별을 보는 사람들</h1><p>사라진 과학자들, 눈앞의 카운트다운, 그리고 세 개의 태양.<br>밤하늘을 끝까지 바라보는 다섯 편의 이야기.</p><p>전 5화 · 77페이지 · 238컷 · 완결</p><a class="start" href="episodes/EP001/index.html">1화부터 읽기 →</a></header>${cards.join('')}<footer>마지막 장까지, 관찰은 계속된다.<br>파일럿 시즌 EP001–EP005</footer></main></html>`;
fs.writeFileSync(path.join(out,'season.html'),html);fs.writeFileSync(path.join(out,'index.html'),html);
// Keep unpublished review readers outside the public docs deployment tree.
fs.mkdirSync(path.join(root,'reader'),{recursive:true});
fs.mkdirSync(path.join(root,'reader/episodes/EP001'),{recursive:true});
fs.writeFileSync(path.join(root,'reader/episodes/EP001/index.html'),'<html lang="ko"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../../../dist/season/episodes/EP001/index.html"><a href="../../../dist/season/episodes/EP001/index.html">1화 읽기</a></html>');
fs.writeFileSync(path.join(root,'reader/season.html'),html.replaceAll('src="episodes/','src="../episodes/'));
console.log(out);
