using System.Diagnostics;
using System.IO;
using Microsoft.VisualBasic.FileIO;
namespace FigmaGifAssistant;

public static class FigmaUninstaller {
 public sealed record Plan(string Target,string VersionDirectory,string Version);
 public static Plan Resolve(string target){
  var archive=FigmaLocator.Normalize(target);
  var resources=Directory.GetParent(archive)!;
  var app=resources.Parent??throw new IOException("无法确定版本目录。");
  if(!resources.Name.Equals("resources",StringComparison.OrdinalIgnoreCase)||!app.Name.StartsWith("app-",StringComparison.OrdinalIgnoreCase)||!Version.TryParse(app.Name[4..],out _))throw new IOException("只允许移除 app-版本号/resources/app.asar 对应的版本目录。");
  if(!File.Exists(Path.Combine(app.FullName,"Figma.exe")))throw new IOException("版本目录中没有 Figma.exe，拒绝移除。");
  // Reject links in ancestors and descendants before handing this exact directory to the recycle bin.
  for(DirectoryInfo? directory=app;directory!=null;directory=directory.Parent)if((directory.Attributes&FileAttributes.ReparsePoint)!=0)throw new IOException("版本目录不能经过符号链接或目录联接。");
  var pending=new Stack<DirectoryInfo>();pending.Push(app);
  while(pending.Count>0)foreach(var entry in pending.Pop().EnumerateFileSystemInfos()){
   if((entry.Attributes&FileAttributes.ReparsePoint)!=0)throw new IOException("版本目录中包含链接，拒绝移除。");
   if(entry is DirectoryInfo child)pending.Push(child);
  }
  return new(archive,app.FullName,app.Name[4..]);
 }
 public static void Remove(Plan reviewed){
  var processes=Process.GetProcessesByName("Figma");var running=processes.Length>0;foreach(var process in processes)process.Dispose();
  if(running)throw new IOException("请先保存并退出全部 Figma 进程。");
  var current=Resolve(reviewed.Target);
  if(!string.Equals(current.VersionDirectory,reviewed.VersionDirectory,StringComparison.OrdinalIgnoreCase))throw new IOException("版本目录已变化，请重新选择。");
  FileSystem.DeleteDirectory(current.VersionDirectory,UIOption.OnlyErrorDialogs,RecycleOption.SendToRecycleBin,UICancelOption.ThrowException);
 }
}
