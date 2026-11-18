const fs = require("fs");
const sb = JSON.parse(fs.readFileSync("episodes/EP009/storyboard/storyboard.json","utf8"));
const ps = JSON.parse(fs.readFileSync("episodes/EP009/script/panel-script.json","utf8"));
console.log("storyboard keys:", Object.keys(sb));
const pages = sb.pages || sb.storyboard && sb.storyboard.pages;
if (pages) { console.log("pages:", pages.length); for (const p of pages) { console.log(p.page_id || p.id, "panels:", (p.panels||[]).map(x=>x.panel_id||x.id).join(",")); } }
console.log("panel-script keys:", Object.keys(ps));
const ppanels = ps.panels || [];
console.log("panel-script panels:", ppanels.length);
if (ppanels.length) console.log("first:", JSON.stringify(ppanels[0]).slice(0,600));