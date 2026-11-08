(function createNativeExport(dependencies) {
 'use strict';
 const {fs,path,crypto,shell,dialog,BrowserWindow}=dependencies;
 const sessions=new Map();
 function directory(value){if(typeof value!=='string'||!path.isAbsolute(value)||value.includes('\0'))throw Error('请输入完整的输出目录路径');return path.resolve(value);}
 function entry(value){
  if(!value||!Number.isInteger(value.width)||!Number.isInteger(value.height)||value.width<1||value.height<1||value.width>8192||value.height>8192)throw Error('输出尺寸无效');
  const name=String(value.name||'');
  if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)||name.length>200||/[<>:"/\\|?*\x00-\x1f]/.test(name)||name!==path.basename(name)||!name.endsWith('.png'))throw Error('输出文件名无效');
  const suffix=new RegExp(value.width+'x'+value.height+'_(\\d{3,})\\.png$');const match=name.match(suffix);if(!match)throw Error('文件名尺寸与图片尺寸不一致');
  return {...value,stem:name.slice(0,match.index),sequence:Number(match[1])};
 }
 function expires(){const now=Date.now();for(const [key,s]of sessions)if(now-s.time>30*60*1000)sessions.delete(key);}
 async function prepare(owner,payload){
  expires();if(sessions.size>=16)throw Error('导出任务过多，请稍后重试');
  const folder=directory(payload.directory);
  if(!Array.isArray(payload.items)||payload.items.length<1||payload.items.length>1000)throw Error('每批支持 1–1000 个对象');
  const items=payload.items.map(entry),reserved=new Set();
  await fs.promises.mkdir(folder,{recursive:true});
  for(const item of items){
   let sequence=item.sequence;
   while(true){const name=item.stem+item.width+'x'+item.height+'_'+String(sequence).padStart(3,'0')+'.png';
    let exists=false;try{await fs.promises.access(path.join(folder,name));exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
    if(!exists&&!reserved.has(name.toLowerCase())){item.name=name;item.sequence=sequence;reserved.add(name.toLowerCase());break;}
    if(++sequence>999999)throw Error('序号过多，请更换目录或名称');
   }
  }
  const id=crypto.randomBytes(18).toString('hex');sessions.set(id,{owner,folder,items,written:new Set(),time:Date.now()});
  return {batchId:id,names:items.map(x=>x.name)};
 }
 async function save(owner,payload){
  expires();const session=sessions.get(payload.batchId);if(!session||session.owner!==owner)throw Error('导出任务已失效');
  if(!Number.isInteger(payload.index)||payload.index<0||payload.index>=session.items.length||session.written.has(payload.index))throw Error('图片序号无效或已保存');
  if(typeof payload.base64!=='string'||payload.base64.length>90*1024*1024||(payload.base64.length%4!==0)||!/^[A-Za-z0-9+/]*={0,2}$/.test(payload.base64))throw Error('PNG 数据无效或过大');
  const bytes=Buffer.from(payload.base64,'base64'),item=session.items[payload.index];
  if(bytes.length<33||bytes.length>64*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==item.width||bytes.readUInt32BE(20)!==item.height)throw Error('PNG 数据或实际像素尺寸与计划不一致');
  let file=path.join(session.folder,item.name);
  try{await fs.promises.writeFile(file,bytes,{flag:'wx'});}catch(error){if(error.code==='EEXIST')throw Error('同名文件刚被其他任务创建，请重新导出');throw error;}
  session.written.add(payload.index);session.time=Date.now();return {name:item.name,path:file};
 }
 return {
  async handle(owner,module,operation,payload){
   if(operation==='export-png'){
    if(payload?.action==='prepare')return await prepare(owner,payload);
    if(payload?.action==='write')return await save(owner,payload);
    if(payload?.action==='finish'||payload?.action==='cancel'){const session=sessions.get(payload.batchId);if(!session||session.owner!==owner)throw Error('导出任务已失效');sessions.delete(payload.batchId);return {written:session.written.size};}
    throw Error('未知导出操作');
   }
   if(operation==='choose-export-folder'){const options={title:'选择输出目录',properties:['openDirectory','createDirectory']};if(payload?.directory&&path.isAbsolute(payload.directory))options.defaultPath=directory(payload.directory);const parent=BrowserWindow?.fromWebContents(owner);const result=parent?await dialog.showOpenDialog(parent,options):await dialog.showOpenDialog(options);return result.canceled||!result.filePaths.length?{cancelled:true}:{cancelled:false,directory:directory(result.filePaths[0])};}
   if(operation==='open-export-folder'){const folder=directory(payload?.directory);const stat=await fs.promises.stat(folder);if(!stat.isDirectory())throw Error('输出路径不是目录');const error=await shell.openPath(folder);if(error)throw Error(error);return {opened:true};}
   throw Error('未注册的本地操作');
  },
  disposeOwner(owner){for(const [key,value]of sessions)if(value.owner===owner)sessions.delete(key);}
 };
})

