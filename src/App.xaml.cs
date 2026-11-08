using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
namespace FigmaGifAssistant;
public partial class App : Application {
 protected override void OnStartup(StartupEventArgs e) {
  base.OnStartup(e);
  try {
   if(e.Args.Length==2 && e.Args[0]=="--locate-figma") {string? selected=null,error=null;try{selected=FigmaLocator.Resolve();}catch(Exception ex){error=ex.Message;}File.WriteAllText(e.Args[1],System.Text.Json.JsonSerializer.Serialize(new {selected,error,candidates=FigmaLocator.Discover()},new System.Text.Json.JsonSerializerOptions{WriteIndented=true}));Shutdown();return;}
   if(e.Args.Length==2 && e.Args[0]=="--package-info") {File.WriteAllText(e.Args[1],System.Text.Json.JsonSerializer.Serialize(new {assetRoot=BundledAssets.Root,modules=ExtensionCatalog.List().Select(x=>new {x.Info.Id,x.Info.Version,x.Enabled,x.Error}),licenses=Directory.GetFiles(Path.Combine(BundledAssets.Root,"licenses")),runtime=Directory.GetFiles(Path.Combine(BundledAssets.Root,"runtime"))},new System.Text.Json.JsonSerializerOptions{WriteIndented=true}));Shutdown();return;}
   if(e.Args.Length==2 && e.Args[0]=="--plan") { File.WriteAllText(e.Args[1], Installer.PlanJson()); Shutdown(); return; }
   if(e.Args.Length==2 && e.Args[0]=="--apply-plan") { Installer.ApplyPlanFile(e.Args[1]); File.WriteAllText(e.Args[1]+".result","Applied; runtime verification pending.");Shutdown();return; }
   if(e.Args.Length==2 && e.Args[0]=="--apply-startup-acceptance-plan") {Installer.ApplyStartupAcceptancePlan(e.Args[1]);File.WriteAllText(e.Args[1]+".result","Experimental startup acceptance installed; editor UI verification pending.");Shutdown();return;}
   if(e.Args.Length==2 && e.Args[0]=="--monitor-runtime") {_ = MonitorRuntime(e.Args[1]);return;}
   if(e.Args.Length==1 && e.Args[0]=="--restore") {Installer.Restore();Shutdown();return;}
   var window=new MainWindow();
   if(e.Args.Length==2 && (e.Args[0]=="--render-confirmation"||e.Args[0]=="--render-confirmation-light")) {
    window.SetTheme(e.Args[0].EndsWith("-light"));
    var dialog=new ThemeDialog(window,"关闭全部 Figma","将强制结束 13 个 Figma 进程，包括后台进程。\n\n未保存或尚未同步的内容可能丢失，请先保存文档。","关闭全部进程",true);
    dialog.DialogRoot.Measure(new Size(440,double.PositiveInfinity));var size=dialog.DialogRoot.DesiredSize;dialog.DialogRoot.Arrange(new Rect(size));dialog.DialogRoot.UpdateLayout();
    var bitmap=new RenderTargetBitmap((int)Math.Ceiling(size.Width),(int)Math.Ceiling(size.Height),96,96,PixelFormats.Pbgra32);bitmap.Render(dialog.DialogRoot);
    var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));using(var stream=File.Create(e.Args[1]))encoder.Save(stream);Shutdown();return;
   }
   if(e.Args.Length==2 && e.Args[0]=="--check-titlebar") {
    window.SetTheme(false);var dark=NativeTitleBar.Inspect(window,false);
    window.SetTheme(true);var light=NativeTitleBar.Inspect(window,true);
    File.WriteAllText(e.Args[1],System.Text.Json.JsonSerializer.Serialize(new {scope="Own hidden helper window only; no Figma window operations",dark,light},new System.Text.Json.JsonSerializerOptions{WriteIndented=true}));Shutdown();return;
   }
   if(e.Args.Length==2 && (e.Args[0]=="--render-preview"||e.Args[0]=="--render-light"||e.Args[0]=="--render-settings")) {
    if(e.Args[0]=="--render-light")window.SetTheme(true);
    if(e.Args[0]=="--render-settings")window.RenderSettings();
    window.ContentRoot.Measure(new Size(1060,730)); window.ContentRoot.Arrange(new Rect(0,0,1060,730)); window.ContentRoot.UpdateLayout();
    var bitmap=new RenderTargetBitmap(1060,730,96,96,PixelFormats.Pbgra32); bitmap.Render(window.ContentRoot);
    var encoder=new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
    using(var stream=File.Create(e.Args[1])) encoder.Save(stream); Shutdown(); return;
   }
   ShutdownMode=ShutdownMode.OnMainWindowClose; MainWindow=window; window.Show();
  } catch(Exception ex) { if(e.Args.Length>0) {File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"startup-error.txt"),ex.ToString()); Shutdown(1);} else {ThemeDialog.ShowError(ex.Message);Shutdown(1);} }
 }
 async Task MonitorRuntime(string path){
  try{
   var ready=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
   File.WriteAllText(path,DateTime.UtcNow.ToString("O")+" waiting for loader\n");
   using(var bridge=new LocalBridge()){
    bridge.Changed+=(message,available)=>{File.AppendAllText(path,DateTime.UtcNow.ToString("O")+" "+message+"\n");if(available)ready.TrySetResult();};
    await Task.WhenAny(ready.Task,Task.Delay(TimeSpan.FromMinutes(3)));
    await Task.Delay(400);
   }
   Shutdown();
  }catch(Exception ex){File.AppendAllText(path,ex.Message+"\n");Shutdown(1);}
 }
}
