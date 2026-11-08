using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
namespace FigmaGifAssistant;
public partial class MainWindow : Window {
 string? reviewedHash,reviewedPayload;
 string observedState="";
 readonly LocalBridge bridge;
 readonly System.Windows.Threading.DispatcherTimer processTimer=new(){Interval=TimeSpan.FromSeconds(2)};
 bool light,busy,pending;
 string runtimeConnection="等待 Figma 连接";
 void MinimizeWindow(object sender,RoutedEventArgs e)=>SystemCommands.MinimizeWindow(this);
 void ToggleMaximizeWindow(object sender,RoutedEventArgs e){if(WindowState==WindowState.Maximized)SystemCommands.RestoreWindow(this);else SystemCommands.MaximizeWindow(this);}
 void CloseManagerWindow(object sender,RoutedEventArgs e)=>SystemCommands.CloseWindow(this);
 void RefreshCaption(){bool maximized=WindowState==WindowState.Maximized;MaximizeGlyph.Data=Geometry.Parse(maximized?"M2.5,0.5 L9.5,0.5 L9.5,7.5 M0.5,2.5 L7.5,2.5 L7.5,9.5 L0.5,9.5 Z":"M0.5,0.5 L9.5,0.5 L9.5,9.5 L0.5,9.5 Z");MaximizeButton.ToolTip=maximized?"还原窗口":"最大化";System.Windows.Automation.AutomationProperties.SetName(MaximizeButton,maximized?"还原窗口":"最大化");}
 void ToggleTheme(object sender,RoutedEventArgs e){SetTheme(!light);try{Directory.CreateDirectory(ExtensionCatalog.Home);File.WriteAllText(Path.Combine(ExtensionCatalog.Home,"theme.txt"),light?"light":"dark");}catch(Exception ex){Feedback.Text=ex.Message;}}
 internal void SetTheme(bool value){light=value;var colors=value?new[]{"#FFFFFF","#F5F5F5","#E6E6E6","#1E1E1E","#F0F0F0","#757575","#E5F4FF","#E6E6E6","#0D99FF","#996500","#008043"}:new[]{"#2C2C2C","#252525","#444444","#FFFFFF","#383838","#B3B3B3","#4A5878","#444444","#0C8CE9","#F5C66F","#85E0A3"};var keys=new[]{"Canvas","Surface","Divider","Text","Control","Muted","Selected","Hover","Brand","Warning","Success"};for(int i=0;i<keys.Length;i++)Resources[keys[i]]=new SolidColorBrush((Color)ColorConverter.ConvertFromString(colors[i]));SetNav(ExtensionsPage.Visibility==Visibility.Visible);SunGlyph.Visibility=light?Visibility.Collapsed:Visibility.Visible;MoonGlyph.Visibility=light?Visibility.Visible:Visibility.Collapsed;ThemeButton.ToolTip=light?"切换到深色":"切换到浅色";System.Windows.Automation.AutomationProperties.SetName(ThemeButton,ThemeButton.ToolTip.ToString());NativeTitleBar.Apply(this,light);}
 public MainWindow(){
  InitializeComponent();var hostVersion=typeof(MainWindow).Assembly.GetName().Version?.ToString(3)??"未知";HostVersion.Text=hostVersion;Title="Canvas extensions · "+hostVersion;try{SetTheme(File.Exists(Path.Combine(ExtensionCatalog.Home,"theme.txt"))&&File.ReadAllText(Path.Combine(ExtensionCatalog.Home,"theme.txt"))=="light");}catch{SetTheme(false);}
  LoadFigmaCandidates();LoadExtensions();RefreshInstallation();Report.Text="点击“检查更新计划”查看本次更改。";
  bridge=new LocalBridge();bridge.Changed+=(text,available)=>Dispatcher.BeginInvoke(()=>runtimeConnection=text);
  SourceInitialized+=(_,_)=>NativeTitleBar.Apply(this,light);StateChanged+=(_,_)=>RefreshCaption();RefreshCaption();
  processTimer.Tick+=(_,_)=>{RefreshExternalState();RefreshGate();};Activated+=(_,_)=>{RefreshExternalState();RefreshGate();};processTimer.Start();RefreshGate();Closed+=(_,_)=>{processTimer.Stop();bridge.Dispose();};
 }
 void LoadFigmaCandidates(){try{var list=FigmaLocator.Discover();FigmaCandidates.ItemsSource=list;string? target=null;try{target=Installer.Target;FigmaPathInput.Text=target;}catch{}FigmaCandidates.SelectedItem=list.FirstOrDefault(x=>string.Equals(x.Target,target,StringComparison.OrdinalIgnoreCase));}catch(Exception ex){Feedback.Text=ex.Message;}}
 void FindFigma(object sender,RoutedEventArgs e)=>LoadFigmaCandidates();
 void UseFigmaCandidate(object sender,RoutedEventArgs e){if(FigmaCandidates.SelectedItem is FigmaLocator.Candidate item)SelectFigmaTarget(item.Target);}
 void UseFigmaPath(object sender,RoutedEventArgs e)=>SelectFigmaTarget(FigmaPathInput.Text);
 void SelectFigmaTarget(string path){if(busy)return;try{FigmaLocator.Select(path);FigmaPathInput.Text=Installer.Target;reviewedHash=null;reviewedPayload=null;RefreshInstallation();RefreshGate();Feedback.Text="已切换安装位置，请检查兼容性";}catch(Exception ex){Feedback.Text=ex.Message;}}
 void CompatibilityChanged(object sender,RoutedEventArgs e){Installer.ExperimentalCompatibility=ExperimentalVersion.IsChecked==true;reviewedHash=null;reviewedPayload=null;if(IsInitialized){RefreshInstallation();RefreshGate();}}
 void CheckCompatibility(object sender,RoutedEventArgs e){try{Report.Text=Installer.CompatibilityJson();Feedback.Text="兼容性检查完成；结构相容不代表实机验证";}catch(Exception ex){Report.Text=ex.Message;Feedback.Text="兼容性检查未通过";}}
 void SetNav(bool extensions){ExtensionsNav.Background=(Brush)FindResource(extensions?"Selected":"Surface");SettingsNav.Background=(Brush)FindResource(extensions?"Surface":"Selected");}
 void ShowExtensions(object sender,RoutedEventArgs e){ExtensionsPage.Visibility=Visibility.Visible;SettingsPage.Visibility=Visibility.Collapsed;SetNav(true);}
 void ShowSettings(object sender,RoutedEventArgs e){ExtensionsPage.Visibility=Visibility.Collapsed;SettingsPage.Visibility=Visibility.Visible;SetNav(false);}
 internal void RenderSettings()=>ShowSettings(this,new RoutedEventArgs());
 void LoadExtensions(){try{var modules=ExtensionCatalog.List();ExtensionList.ItemsSource=modules;ExtensionCount.Text=$"已发现 {modules.Count} 个扩展";}catch(Exception ex){Feedback.Text=ex.Message;}}
 void RefreshInstallation(){try{Detection.Text=Installer.DetectLabel();pending=!Installer.IsCurrent();InstallState.Text=$"已安装增强：{Installer.InstalledVersion()} · "+(pending?"有更改待注入，应用并重启后生效":"已注入，打开 Design 文档后自动加载");observedState=Installer.StateStamp();}catch(Exception ex){pending=true;InstallState.Text=ex.Message;}}
 void RefreshExternalState(){if(busy)return;try{if(Installer.StateStamp()!=observedState){reviewedHash=null;reviewedPayload=null;LoadExtensions();RefreshInstallation();}}catch(Exception ex){Feedback.Text=ex.Message;}}
 void RefreshGate(){
  if(busy)return;
  ApplyButton.Content=pending?"应用扩展（注入）":"重新注入";
  try{var reason=Installer.ApplyBlockReason();
   GateReason.Text=reason.Length>0?reason:pending?"Figma 已退出。可直接应用扩展，点击时会自动检查计划。":"当前已是最新版，仍可重新注入。完成后重新打开 Figma 生效。";
   ApplyButton.IsEnabled=reason.Length==0;
  }catch(Exception ex){GateReason.Text=ex.Message;ApplyButton.IsEnabled=false;}
 }
 void ExtensionToggled(object sender,RoutedEventArgs e){var toggle=(CheckBox)sender;if(toggle.Tag is not ExtensionCatalog.Extension module)return;try{if(module.Error is not null)throw new IOException(module.Error);ExtensionCatalog.SetEnabled(module.Info.Id,toggle.IsChecked==true);reviewedHash=null;reviewedPayload=null;RefreshInstallation();RefreshGate();Feedback.Text="扩展选择已保存 · 待应用";}catch(Exception ex){Feedback.Text=ex.Message;LoadExtensions();}}
 void Rescan(object sender,RoutedEventArgs e){reviewedHash=null;LoadExtensions();RefreshInstallation();RefreshGate();Feedback.Text="扩展列表已刷新";}
 void OpenExtensions(object sender,RoutedEventArgs e){try{Directory.CreateDirectory(ExtensionCatalog.CustomDirectory);Process.Start(new ProcessStartInfo("explorer.exe",'"'+ExtensionCatalog.CustomDirectory+'"'){UseShellExecute=true});}catch(Exception ex){Feedback.Text=ex.Message;}}
 void StartFigma(object sender,RoutedEventArgs e){
  if(busy)return;
  try{var executable=Path.GetFullPath(Path.Combine(Path.GetDirectoryName(Installer.Target)!,"..","Figma.exe"));if(!File.Exists(executable))throw new FileNotFoundException("未找到 Figma 启动文件，请先检查安装路径。",executable);
   Process.Start(new ProcessStartInfo(executable){UseShellExecute=true,WorkingDirectory=Path.GetDirectoryName(executable)!});Feedback.Text="已发送 Figma 启动请求";
  }catch(Exception ex){Feedback.Text=ex.Message;}
 }
 async void CloseFigma(object sender,RoutedEventArgs e){
  if(busy)return;
  var count=Process.GetProcessesByName("Figma");var total=count.Length;foreach(var process in count)process.Dispose();
  if(total==0){Feedback.Text="没有正在运行的 Figma 进程";RefreshGate();return;}
  if(!ThemeDialog.Ask(this,"关闭全部 Figma",$"将强制结束 {total} 个 Figma 进程，包括后台进程。\n\n未保存或尚未同步的内容可能丢失，请先保存文档。","关闭全部进程",true))return;
  busy=true;Feedback.Text="正在关闭全部 Figma 进程…";
  try{var failures=await System.Threading.Tasks.Task.Run(()=>{
   var errors=new List<string>();foreach(var process in Process.GetProcessesByName("Figma")){using(process){try{if(!process.HasExited){process.Kill(entireProcessTree:true);if(!process.WaitForExit(5000))errors.Add($"进程 {process.Id} 仍在退出");}}catch(InvalidOperationException){}catch(Exception ex){errors.Add($"进程 {process.Id}：{ex.Message}");}}}return errors;
  });Feedback.Text=failures.Count==0?"全部 Figma 进程已关闭":"部分进程未关闭，请查看诊断";if(failures.Count>0){DiagnosticReport.Text=string.Join("\n",failures);DiagnosticExpander.IsExpanded=true;}}
  catch(Exception ex){Feedback.Text=ex.Message;}finally{busy=false;RefreshGate();}
 }
 void ReadDiagnostic(object sender,RoutedEventArgs e){try{var path=Installer.DiagnosticPath();string compatibility;try{compatibility=Installer.CompatibilityJson();}catch(Exception error){compatibility=error.Message;}DiagnosticReport.Text=runtimeConnection+"\n\n"+compatibility+"\n\n"+(File.Exists(path)?File.ReadAllText(path):"尚无加载诊断。请确认已应用扩展并重新打开 Figma。");}catch(Exception ex){DiagnosticReport.Text=ex.Message;}DiagnosticExpander.IsExpanded=true;}
 void CopyDiagnostic(object sender,RoutedEventArgs e){ReadDiagnostic(sender,e);try{Clipboard.SetText(DiagnosticReport.Text);Feedback.Text="诊断已复制";}catch(Exception ex){Feedback.Text=ex.Message;}}
 async void CheckPlan(object sender,RoutedEventArgs e){if(busy)return;busy=true;ApplyButton.IsEnabled=false;Feedback.Text="正在检查…";try{var result=await System.Threading.Tasks.Task.Run(()=> (Plan:Installer.PlanJson(),Hash:Installer.Hash(Installer.Target),Fingerprint:Installer.ReviewFingerprint()));Report.Text=result.Plan;Report.ScrollToHome();reviewedHash=result.Hash;reviewedPayload=result.Fingerprint;RefreshInstallation();Feedback.Text=pending?"检查完成 · 更改待应用":"已是当前版本";}catch(Exception ex){reviewedHash=null;Report.Text=ex.Message;Feedback.Text="检查失败，请查看计划";}finally{busy=false;RefreshGate();}}
 async void Apply(object sender,RoutedEventArgs e){
  if(busy)return;
  bool reinstall=!pending;busy=true;ApplyButton.IsEnabled=false;ExtensionList.IsEnabled=false;Feedback.Text=reinstall?"正在重新注入…":"正在检查并注入…";
  try{
   if(reviewedHash is null||reviewedPayload is null){
    var prepared=await System.Threading.Tasks.Task.Run(()=>(Plan:Installer.PlanJson(),Hash:Installer.Hash(Installer.Target),Fingerprint:Installer.ReviewFingerprint()));
    Report.Text=prepared.Plan;reviewedHash=prepared.Hash;reviewedPayload=prepared.Fingerprint;
   }
   await System.Threading.Tasks.Task.Run(()=>Installer.Apply(reviewedHash,reviewedPayload));
   reviewedHash=null;reviewedPayload=null;RefreshInstallation();Feedback.Text=reinstall?"已重新注入 · 请重新打开 Figma":"已注入 · 请重新打开 Figma";
  }catch(Exception ex){reviewedHash=null;reviewedPayload=null;Report.Text=ex.Message;Feedback.Text="注入未完成，请查看计划";}
  finally{busy=false;ExtensionList.IsEnabled=true;RefreshGate();}
 }
 async void Restore(object sender,RoutedEventArgs e){if(busy)return;if(Installer.IsRunning()){Feedback.Text="请先保存并正常退出 Figma";return;}if(!ThemeDialog.Ask(this,"恢复原始资源","恢复后将移除已注入扩展的加载入口。\n\n扩展文件和选择会保留，可以稍后重新注入。","恢复资源"))return;busy=true;try{await System.Threading.Tasks.Task.Run(Installer.Restore);reviewedHash=null;RefreshInstallation();Feedback.Text="已恢复原始资源";}catch(Exception ex){DiagnosticReport.Text=ex.Message;DiagnosticExpander.IsExpanded=true;Feedback.Text="恢复未完成，请查看诊断";}finally{busy=false;RefreshGate();}}
}
