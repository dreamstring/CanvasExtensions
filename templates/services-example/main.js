/* Demonstrates SDK services without changing nodes or writing files. */
(()=>{
 const sdk=window.FigmaExtensions.sdk,S=sdk.services;
 const progress=S.progressTask(),images=S.editorImages(window.figma);
 async function inspect(ctx){
  const nodes=await S.selectionNodes(ctx.api,{deep:ctx.state.deep});
  const result=await progress.run(nodes,async(node,task)=>{
   const hash=Array.isArray(node.fills)&&node.fills.find(p=>p.type==='IMAGE')?.imageHash;
   const format=hash?await images.identify(hash):'none';task.check();return format;
  },({completed,total})=>ctx.status(completed+' / '+total));
  if(result.status==='completed')ctx.status('已检查 '+result.value.length+' 个对象');
 }
 sdk.compose({id:'services-example',defaults:{directory:'',deep:false},panel:{title:'Services example',content:[
  {type:'checkbox',key:'deep',label:'包含子层'},
  {type:'path',key:'directory',label:'目录（仅选择，不输出）'},
  {type:'imagePreview',key:'preview',label:'Preview',source:()=>''},
  {type:'button',label:'检查图片格式',onClick:inspect}
 ]},setup(ctx){ctx.scope.add(()=>progress.dispose());ctx.scope.add(()=>images.dispose());const selection=S.watchSelection(ctx.api,{delay:250,run:({nodes})=>ctx.status(nodes.length+' selected'),onStart:()=>progress.cancel()});ctx.scope.add(()=>selection.dispose());},commands:{inspect}});
})();
