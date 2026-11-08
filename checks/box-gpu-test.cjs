/* Optional real Chromium GPU check. Uses a private headless profile, never user tabs. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const chrome=process.env.BOX_CHROME||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
if(!chrome)throw Error('Set BOX_CHROME to a Chromium executable to run this GPU check');
const folder=path.resolve('artifacts/box-gpu-check');fs.mkdirSync(folder,{recursive:true});
const code=fs.readFileSync('modules/box/rules.js','utf8');
const old=code.replace('x.d=x.d.map(v=>Math.round(v*outputScale));y.d=y.d.map(v=>Math.round(v*outputScale));','x.d=x.d.map(v=>v*outputScale);y.d=y.d.map(v=>v*outputScale);');
function wrap(source){return `(()=>{const module={exports:{}};${source}\nreturn module.exports;})()`;}
const html=`<!doctype html><body>pending<script>(async()=>{
 const fixed=${wrap(code)},legacy=${wrap(old)};
 const source=document.createElement('canvas');source.width=118;source.height=52;const s=source.getContext('2d');s.fillStyle='rgba(255,255,255,0.7)';s.fillRect(0,0,118,52);
 const blob=await new Promise(resolve=>source.toBlob(resolve));const bitmap=await createImageBitmap(blob);
 function check(rules,scale=1){const out=document.createElement('canvas');out.width=Math.round(959*scale);out.height=Math.round(340*scale);const ctx=out.getContext('2d');for(const p of rules.plan(118,52,959,340,rules.pixels(118,52,{left:10,top:10,right:90,bottom:90},'percent'),scale))ctx.drawImage(bitmap,...p);const rgba=ctx.getImageData(0,0,out.width,out.height).data;let min=255,max=0;for(let i=3;i<rgba.length;i+=4){min=Math.min(min,rgba[i]);max=Math.max(max,rgba[i]);}return {min,max};}
 document.body.textContent=JSON.stringify({reference:s.getImageData(0,0,1,1).data[3],legacy:check(legacy),fixed:check(fixed),preview:check(fixed,.317)});bitmap.close();
})().catch(e=>document.body.textContent=JSON.stringify({error:e.message}));</script>`;
const file=path.join(folder,'check.html');fs.writeFileSync(file,html);
const run=cp.spawnSync(chrome,['--headless','--no-first-run','--virtual-time-budget=3000','--user-data-dir='+path.join(folder,'profile'),'--dump-dom',new URL('file:///'+file.replaceAll('\\','/')).href],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1024*1024});
if(run.error)throw run.error;assert.equal(run.status,0);
const match=run.stdout.match(/<body>(.*?)<\/body>/s);assert(match,'Chromium must finish the raster check');const result=JSON.parse(match[1]);assert(!result.error,result.error);
assert.deepEqual(result.fixed,{min:result.reference,max:result.reference});assert.deepEqual(result.preview,{min:result.reference,max:result.reference});
fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(result,null,2));
console.log('PASS Chromium: fractional-margin alpha is constant after pixel snapping:',result);
if(result.legacy.min===result.reference)console.log('NOTE: this backend did not reproduce legacy GPU seams; fixed-path pixel checks still passed');
