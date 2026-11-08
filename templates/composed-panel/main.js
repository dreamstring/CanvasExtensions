window.FigmaExtensions.sdk.compose({
 id:'composed-example',
 defaults:{manual:false,width:64,height:64,mode:'nearest',prefix:'T_UI_',scale:1,format:'png'},
 panel:{title:'Component kit',collapsible:true,collapsed:false,content:[
  {type:'row',children:[
   {type:'select',key:'mode',label:'取整方式',options:[{value:'nearest',label:'最近尺寸'},{value:'up',label:'向上进位'},{value:'down',label:'向下取整'}]},
   {type:'text',key:'prefix',label:'前缀'}
  ]},
  {type:'checkbox',key:'manual',label:'手动尺寸'},
  {type:'row',children:[
   {type:'number',key:'width',label:'宽度',min:1,enabled:ctx=>ctx.state.manual},
   {type:'number',key:'height',label:'高度',min:1,enabled:ctx=>ctx.state.manual}
  ]},
  {type:'segmented',key:'format',label:'格式',options:[{value:'png',label:'PNG'},{value:'jpg',label:'JPG'}]},
  {type:'slider',key:'scale',label:'比例',min:0.1,max:4,step:0.1},
  {type:'row',columns:3,children:[
   {type:'button',key:'run',label:'执行',onClick:ctx=>ctx.status('设置：'+ctx.state.width+' × '+ctx.state.height)},
   {type:'button',key:'outline',label:'次要按钮',variant:'outline'},
   {type:'iconButton',key:'add',label:'添加',icon:'plus'}
  ]},
  {type:'disclosure',title:'Preview',children:[{type:'label',text:'可在这里组合预览或其他内容'}]}
 ]}
});
