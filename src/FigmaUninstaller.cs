using System.Diagnostics;
using System.IO;
namespace FigmaGifAssistant;

public static class FigmaUninstaller {
 public sealed record Plan(string InstallRoot,string Executable,string Arguments,bool OpensSettings);
 public static Plan Resolve(string target){
  var archive=FigmaLocator.Normalize(target);
  var resources=Directory.GetParent(archive)!;
  var app=resources.Parent??throw new IOException("无法确定 Figma 安装目录。");
  if(!resources.Name.Equals("resources",StringComparison.OrdinalIgnoreCase))throw new IOException("无法确定 Figma 安装目录。");
  // Squirrel owns all app-* versions under this root; never delete a version directory ourselves.
  if(app.Name.StartsWith("app-",StringComparison.OrdinalIgnoreCase)&&app.Parent is { } root){
   var update=Path.Combine(root.FullName,"Update.exe");
   if(File.Exists(update)&&File.Exists(Path.Combine(app.FullName,"Figma.exe")))return new(root.FullName,update,"--uninstall",false);
  }
  return new(app.FullName,"ms-settings:appsfeatures","",true);
 }
 public static void Launch(Plan plan){
  if(plan.OpensSettings){Process.Start(new ProcessStartInfo(plan.Executable){UseShellExecute=true});return;}
  Process.Start(new ProcessStartInfo(plan.Executable){Arguments=plan.Arguments,WorkingDirectory=plan.InstallRoot,UseShellExecute=true});
 }
}
