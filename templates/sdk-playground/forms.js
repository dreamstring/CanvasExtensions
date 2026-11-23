(() => {
  const button = (label, onClick, enabled) => ({ type: 'button', label, onClick, enabled });
  const text = read => ({ type: 'label', text: read });
  const progress = window.FigmaExtensions.sdk.services.progressTask();
  let run = 0;
  function cancel(ctx) {
    run++;
    progress.cancel();
    ctx.patch({ queueStatus: '已取消' });
  }
  function start(ctx) {
    const ticket = ++run;
    const items = Array.from({length: ctx.state.queueSize}, (_, i) => i);
    ctx.patch({ queueStatus: '运行中', queueDone: 0 });
    progress.run(items, () => new Promise(resolve => setTimeout(resolve, 350)), ({completed}) => {
      if (ticket === run) ctx.patch({ queueDone: completed });
    }).then(result => {
      if (ticket === run && result.status === 'completed') ctx.patch({ queueStatus: '已完成' });
    }).catch(error => {
      if (ticket === run) ctx.patch({ queueStatus: String(error.message || error) });
    });
  }
  const idle = ctx => ctx.state.queueStatus !== '运行中';
  const queue = [
    text(ctx => ctx.state.queueStatus + ' · ' + ctx.state.queueDone + '/' + ctx.state.queueSize),
    window.FigmaExtensions.sdk.collections.control({
      key:'jobs', label:'模拟输出队列', selectable:false,
      watchKeys:['queueSize','queueDone','queueStatus'],
      items:({state})=>Array.from({length:state.queueSize},(_,index)=>{
        const phase=index<state.queueDone?'已完成':index===state.queueDone&&state.queueStatus==='运行中'?'处理中':'等待';
        return {id:index,label:'合成 '+String(index+1).padStart(2,'0')+' · '+phase};
      })
    }),
    {type:'row',children:[
      button('添加任务',ctx=>ctx.patch({queueSize:ctx.state.queueSize+1}),ctx=>idle(ctx)&&ctx.state.queueSize<12),
      button('开始队列',start,idle),
      button('取消运行',cancel,ctx=>!idle(ctx))
    ]}
  ];

  const toolbar = [
    {type:'row',children:['左','中','右'].map((name,i)=>button(name+'对齐',ctx=>ctx.patch({align:i})))},
    {type:'custom',key:'alignmentSample',label:'排列预览',mount(container,ctx,life){
      container.style.cssText='display:grid;gap:4px;padding:8px;background:var(--color-bg-secondary,#383838)';
      for(const width of ['24%','50%','32%']){
        const layer=document.createElement('div');
        layer.style.cssText='height:8px;background:var(--color-bg-brand,#0d99ff);width:'+width;
        container.append(layer);
      }
      life.add(ctx.model.subscribe(s=>s.align,value=>{
        container.style.justifyItems=['start','center','end'][value];
        container.setAttribute('aria-label',['左对齐','中对齐','右对齐'][value]);
      },{immediate:true}));
    }}
  ];
  const steps=['选择范围','设置格式','确认'];
  const wizard = [
    text(ctx=>'步骤 '+(ctx.state.stage+1)+'/3 · '+steps[ctx.state.stage]),
    {type:'select',key:'targetSet',label:'图层范围',visible:ctx=>ctx.state.stage===0,
     options:[{value:'所选图层',label:'所选图层'},{value:'整个合成',label:'整个合成'}]},
    {type:'segmented',key:'outputKind',label:'输出格式',visible:ctx=>ctx.state.stage===1,
     options:['PNG','JPEG'].map(value=>({value,label:value}))},
    {type:'label',visible:ctx=>ctx.state.stage===2,text:ctx=>'模拟输出：'+ctx.state.targetSet+' → '+ctx.state.outputKind},
    {type:'row',children:[
      button('上一步',ctx=>ctx.patch({stage:ctx.state.stage-1,wizardResult:''}),ctx=>ctx.state.stage>0),
      button('下一步',ctx=>ctx.patch({stage:ctx.state.stage+1,wizardResult:''}),ctx=>ctx.state.stage<2),
      button('确认模拟输出',ctx=>ctx.patch({wizardResult:'已模拟输出 '+ctx.state.outputKind}),ctx=>ctx.state.stage===2)
    ]},text(ctx=>ctx.state.wizardResult)
  ];
  window.CanvasPlaygroundForms={
    defaults:{queueSize:2,queueDone:0,queueStatus:'待运行',align:0,stage:0,targetSet:'所选图层',outputKind:'PNG',wizardResult:''},
    queue,toolbar,wizard,
    setup(ctx){
      if(ctx.state.queueStatus==='运行中')cancel(ctx);
      ctx.scope.add(()=>{run++;progress.dispose();});
    }
  };
})();
