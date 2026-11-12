using System.Diagnostics;
using System.IO;
using System.Text.Json;
using Microsoft.Win32;
namespace FigmaGifAssistant;
public static class FigmaLocator {
 public record Candidate(string Target,string Version,string Source){public string Label=>$"{Version} · {Target}";}
 static string Config=>Path.Combine(ExtensionCatalog.Home,"figma-target.json");
 static string? selected;
 public static string VersionOf(string target){var folder=Directory.GetParent(Path.GetDirectoryName(target)!)?.Name??"";if(folder.StartsWith("app-"))return folder[4..];try{var exe=Path.Combine(Directory.GetParent(Path.GetDirectoryName(target)!)!.FullName,"Figma.exe");if(File.Exists(exe))return FileVersionInfo.GetVersionInfo(exe).ProductVersion??folder;}catch{}return folder;}
 public static string Normalize(string value){
  var path=Path.GetFullPath(Environment.ExpandEnvironmentVariables(value.Trim().Trim('"')));
  if(File.Exists(path)) {if(Path.GetFileName(path).Equals("Figma.exe",StringComparison.OrdinalIgnoreCase))path=Path.Combine(Path.GetDirectoryName(path)!,"resources","app.asar");else if(!Path.GetFileName(path).Equals("app.asar",StringComparison.OrdinalIgnoreCase))throw new IOException("请选择 Figma.exe、app.asar 或安装目录。");}
  else if(Directory.Exists(path)){if(File.Exists(Path.Combine(path,"resources","app.asar")))path=Path.Combine(path,"resources","app.asar");else if(File.Exists(Path.Combine(path,"app.asar")))path=Path.Combine(path,"app.asar");else throw new IOException("该目录没有直接包含 Figma 的 resources/app.asar；请选择具体 app-版本目录。");}
  if(!File.Exists(path))throw new IOException("未找到 app.asar，请检查 Figma 安装位置。");
  return path;
 }
 public static void Select(string value){var path=Normalize(value);Directory.CreateDirectory(ExtensionCatalog.Home);File.WriteAllText(Config,JsonSerializer.Serialize(path));selected=path;}
 public static string Resolve(){
  if(selected!=null&&File.Exists(selected))return selected;
  selected=null;
  try{if(File.Exists(Config)){var saved=JsonSerializer.Deserialize<string>(File.ReadAllText(Config));if(!string.IsNullOrEmpty(saved)&&File.Exists(saved))return selected=Path.GetFullPath(saved);}}catch{}
  var candidates=Discover();if(candidates.Count==0)throw new IOException("未找到 Figma。已检查运行进程、注册表和常见安装目录；请手动指定 Figma.exe。");
  return selected=candidates.OrderByDescending(c=>c.Source=="运行进程").ThenByDescending(c=>Version.TryParse(c.Version,out var v)?v:new Version()).First().Target;
 }
 public static List<Candidate> Discover(){
  var found=new Dictionary<string,Candidate>(StringComparer.OrdinalIgnoreCase);
  void Add(string? value,string source){if(string.IsNullOrWhiteSpace(value))return;try{
   value=value.Trim().Trim('"');if(value.EndsWith(",0"))value=value[..^2].Trim('"');
   if(File.Exists(value)){try{var p=Normalize(value);found.TryAdd(p,new(p,VersionOf(p),source));}catch{}return;}
   if(!Directory.Exists(value))return;
   try{var p=Normalize(value);found.TryAdd(p,new(p,VersionOf(p),source));}catch{}
   foreach(var dir in Directory.EnumerateDirectories(value,"app-*",SearchOption.TopDirectoryOnly)){try{var p=Normalize(dir);found.TryAdd(p,new(p,VersionOf(p),source));}catch{}}
  }catch{}}
  foreach(var process in Process.GetProcessesByName("Figma")){using(process){try{Add(process.MainModule?.FileName,"运行进程");}catch{}}}
  foreach(var hive in new[]{RegistryHive.CurrentUser,RegistryHive.LocalMachine})foreach(var view in new[]{RegistryView.Registry64,RegistryView.Registry32}){
   try{using var root=RegistryKey.OpenBaseKey(hive,view);using(var app=root.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\App Paths\Figma.exe")){Add(app?.GetValue(null) as string,"注册表 App Paths");Add(app?.GetValue("Path") as string,"注册表 App Paths");}
    using var uninstall=root.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall");if(uninstall==null)continue;
    foreach(var name in uninstall.GetSubKeyNames()){using var entry=uninstall.OpenSubKey(name);var display=entry?.GetValue("DisplayName") as string;if(display==null||!display.StartsWith("Figma",StringComparison.OrdinalIgnoreCase))continue;Add(entry!.GetValue("InstallLocation") as string,"注册表安装记录");Add(entry.GetValue("DisplayIcon") as string,"注册表安装记录");}
   }catch{}
  }
  foreach(var root in new[]{Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)})if(root.Length>0)Add(Path.Combine(root,"Figma"),"常见目录");
  return found.Values.OrderByDescending(c=>Version.TryParse(c.Version,out var v)?v:new Version()).ToList();
 }
}
