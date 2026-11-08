window.FigmaExtensions.sdk.define({
 id:'sdk-example',
 defaults:{enabled:false,width:64,label:'T_UI_',scale:1},
 panel:{title:'SDK example',visible:ctx=>ctx.selection().length>0,rows:[
  [{key:'enabled',type:'checkbox',label:'手动尺寸'}],
  [{key:'width',type:'number',label:'宽度',min:1,enabled:ctx=>ctx.state.enabled}],
  [{key:'label',type:'text',label:'前缀'}],
  [{key:'scale',type:'slider',label:'比例',min:0.1,max:4,step:0.1}],
  [{key:'inspect',type:'button',label:'读取选区',onClick:ctx=>ctx.status('已选 '+ctx.selection().length+' 个对象')}]
 ]}
});
