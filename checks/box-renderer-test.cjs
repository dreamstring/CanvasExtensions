const assert=require('node:assert/strict'),{create}=require('../modules/box/renderer.js'),rules=require('../modules/box/rules.js');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 let metadata='',writes=0,decodes=0,closed=0,encode;
 const node={id:'box',width:100,height:80,fills:[{type:'IMAGE',imageHash:'source'}],getSharedPluginData:()=>metadata,setSharedPluginData:(ns,key,value)=>metadata=value};
 const renderer=create({rules,api:{getImageByHash:()=>({getBytesAsync:async()=>new Uint8Array([1])}),createImage:()=>({hash:'output'+(++writes)})},decode:async()=>{decodes++;return {width:40,height:40,close(){closed++;}};},document:{createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:cb=>encode=()=>cb(new Blob(['png']))})}});
 const settings={index:0,paint:node.fills[0],margins:{left:10,right:10,top:10,bottom:10},unit:'percent'};
 const first=renderer.request(node,settings);await turn();
 const second=renderer.request(node,{...settings,margins:{...settings.margins,left:20}});encode();assert.equal(await first,false);await turn();encode();assert.equal(await second,true);
 assert.equal(writes,1);assert.equal(JSON.parse(metadata).margins.left,20);assert.equal(decodes,1,'same original bitmap is decoded once');
 let saved=JSON.parse(metadata);const resizing=renderer.request(node,saved);await turn();node.width=101;encode();assert.equal(await resizing,false);assert.equal(writes,1,'obsolete dimensions never replace the image');
 const undone=renderer.request(node,saved);await turn();metadata='';encode();assert.equal(await undone,false);assert.equal(writes,1,'undo during encoding cannot be overwritten');
 const disposed=renderer.request(node,{...settings,paint:{type:'IMAGE',imageHash:'output1'}});await turn();renderer.dispose();encode();assert.equal(await disposed,false);assert.equal(writes,1);await turn();assert.equal(closed,2,'all cached source bitmaps are closed after in-flight encoder releases its lease');
 const beforeMetadata=metadata,beforeFills=JSON.stringify(node.fills);
 const missing=create({rules,api:{getImageByHash:()=>null},document:{},decode:()=>assert.fail('missing sources must not reach decode')});
 await assert.rejects(missing.request(node,settings),/原图资源不可用/);
 assert.equal(metadata,beforeMetadata);assert.equal(JSON.stringify(node.fills),beforeFills);missing.dispose();
 console.log('PASS Box encoder: latest request wins, one source decode, stale resize/undo/dispose cannot write');
})().catch(error=>{console.error(error);process.exit(1);});
