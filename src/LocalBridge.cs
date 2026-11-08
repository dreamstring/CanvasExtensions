using System.IO;
using System.IO.Pipes;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
namespace FigmaGifAssistant;
public sealed class LocalBridge : IDisposable {
 readonly CancellationTokenSource cancel=new();
 StreamWriter? writer;
 readonly SemaphoreSlim writeLock=new(1,1);
 bool runtimeReady;
 public event Action<string,bool>? Changed;
 public static string PipeName=>"FigmaGifAssistant-"+Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Environment.UserName.ToLowerInvariant())))[..16].ToLowerInvariant();
 public LocalBridge(){_ = Listen();}
 async Task Listen(){
  while(!cancel.IsCancellationRequested){
   try {
    await using var pipe=new NamedPipeServerStream(PipeName,PipeDirection.InOut,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous|PipeOptions.CurrentUserOnly);
    await pipe.WaitForConnectionAsync(cancel.Token);
    using var reader=new StreamReader(pipe,Encoding.UTF8,false,4096,true);
    using var output=new StreamWriter(pipe,new UTF8Encoding(false),4096,true){AutoFlush=true};writer=output;
    Changed?.Invoke("Figma 已连接 · 正在准备编辑器",false);
    var line=new StringBuilder();var one=new char[1];
    while(await reader.ReadAsync(one.AsMemory(),cancel.Token)>0){
     if(one[0]=='\n'){
      using var message=JsonDocument.Parse(line.ToString());line.Clear();
      var root=message.RootElement;
      if(root.TryGetProperty("event",out var kind)&&kind.GetString()=="status"){
       int ready=root.GetProperty("ready").GetInt32();int mounted=root.GetProperty("mounted").GetInt32();
       runtimeReady=ready>0;
       bool failed=root.TryGetProperty("error",out var error)&&!string.IsNullOrEmpty(error.GetString());
       Changed?.Invoke(failed?"扩展加载异常 · 请查看诊断":ready>0?$"Figma 已连接 · {ready} 个编辑器":"等待打开 Figma Design 文档",runtimeReady&&!failed);
      }else if(root.TryGetProperty("event",out kind)&&kind.GetString()=="result"){
       Changed?.Invoke(root.GetProperty("ok").GetBoolean()?"命令已完成":"命令未完成 · 请聚焦目标 Figma 文档后重试",runtimeReady);
      }
     }else{line.Append(one[0]);if(line.Length>65536)throw new IOException("本地消息过长");}
    }
   }catch(OperationCanceledException){break;}catch(Exception ex){Changed?.Invoke("本地连接断开："+ex.Message,false);}
   finally{writer=null;runtimeReady=false;}
   if(!cancel.IsCancellationRequested){Changed?.Invoke("等待 Figma 加载器连接",false);try{await Task.Delay(1000,cancel.Token);}catch(OperationCanceledException){break;}}
  }
 }
 public Task Send(string action)=>Send("gif",action);
 public async Task Send(string module,string action){
  if(!ExtensionCatalog.List().Any(x=>x.Enabled&&x.Error is null&&x.Info.Id==module&&x.Info.Commands.Contains(action)))throw new ArgumentException("扩展未启用或命令未注册");
  await writeLock.WaitAsync(cancel.Token);try{var output=writer??throw new IOException("尚未连接 Figma");await output.WriteLineAsync(JsonSerializer.Serialize(new {module,action}));}finally{writeLock.Release();}
 }
 public void Dispose(){cancel.Cancel();}
}
