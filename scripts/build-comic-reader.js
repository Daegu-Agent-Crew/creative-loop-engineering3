#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const {escapeXml}=require('./render-panel-overlays');
function build(root,episode,options={}){
 const assetPrefix=options.public ? "../../" : "../../../";
 const base=path.join(root,'episodes',episode);
 const panels=JSON.parse(fs.readFileSync(path.join(base,'panels/panels.json'))).panels;
 const script=JSON.parse(fs.readFileSync(path.join(base,'script/panel-script.json')));
 const title=JSON.parse(fs.readFileSync(path.join(base,'script/script.json'))).title;
 const byId=new Map(script.panels.map(p=>[p.panel_id,p]));
 const missing=panels.filter(p=>!fs.existsSync(path.join(root,p.image_path)));
 if(missing.length)throw Error(`${episode}: missing ${missing.length} panels; refusing incomplete reader`);
 const output=path.join(options.outputRoot || path.join(root,'reader'), 'episodes',episode,'read.html');fs.mkdirSync(path.dirname(output),{recursive:true});
 let page=0;
 const content=panels.map(p=>{const row=byId.get(p.panel_id);if(!row||row.description!==p.description)throw Error(`mapping mismatch ${p.panel_id}`);const heading=p.page_number!==page?`<h2 id="page-${p.page_number}">${String(p.page_number).padStart(2,'0')}</h2>`:'';page=p.page_number;return `${heading}<figure id="${p.panel_id}"><img src="${assetPrefix}${escapeXml(p.image_path)}" alt="${escapeXml(p.description)}" loading="lazy" decoding="async"><figcaption>${row.text.map(t=>`<p class="${escapeXml(t.kind)}">${t.speaker?`<strong>${escapeXml(t.speaker)}</strong>`:''}${escapeXml(t.text)}</p>`).join('')}</figcaption></figure>`}).join('\n');
 const index=Number(episode.slice(2));const previous=index===2?'../EP001/':`../EP${String(index-1).padStart(3,'0')}/read.html`;const next=index<5?`<a href="../EP${String(index+1).padStart(3,'0')}/read.html">다음 화 →</a>`:'<span>파일럿 시즌 완결</span>';
 const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(title)} · ${episode}</title><style>*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#0c1017;color:#f4efe5;font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;line-height:1.7}header,main,footer{max-width:920px;margin:auto}header{padding:50px 24px 28px}header small{color:#d8ad63;letter-spacing:.15em}h1{font-size:clamp(30px,5vw,48px);margin:8px 0}header p{color:#9ea7b5}nav{display:flex;justify-content:space-between;gap:20px;align-items:center}a{color:#e8c891;text-decoration:none}a:hover,a:focus{text-decoration:underline}h2{font-size:13px;font-weight:400;color:#8d96a5;letter-spacing:.2em;text-align:center;margin:64px 0 28px}figure{margin:0 0 24px;background:#141a23;border:1px solid #252d39}img{width:100%;height:auto;display:block}figcaption:empty{display:none}figcaption{padding:14px 24px}figcaption p{margin:8px 0;font-size:clamp(17px,2.1vw,21px);word-break:keep-all;overflow-wrap:anywhere}strong{display:block;font-size:12px;color:#d8ad63;letter-spacing:.06em;margin-bottom:3px}.narration,.caption{color:#c1ccda}.screen{font-family:monospace;color:#9ce5ed}.sfx{font-weight:800}footer{padding:50px 24px 90px;border-top:1px solid #303844;margin-top:80px}@media(max-width:600px){header{padding-top:28px}figure{border-left:0;border-right:0}figcaption{padding:12px 18px}h2{margin-top:42px}}@media print{body{background:white;color:black}figure{break-inside:avoid}nav{display:none}}</style><header><small>THREE BODY · ${episode}</small><h1>${escapeXml(title)}</h1><p>그림과 기록으로 따라가는 다섯 편의 이야기</p><nav><a href="${previous}">← 이전 화</a><a href="../../season.html">전체 회차</a></nav></header><main>${content}</main><footer><nav><a href="#">맨 위로</a>${next}</nav></footer></html>`;
 fs.writeFileSync(output,html);return {episode,panels:panels.length,pages:page,output};
}
module.exports={build};if(require.main===module)console.log(build(process.cwd(),process.argv[2]||'EP002',{public:process.argv.includes('--public')}));
