using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
namespace FigmaGifAssistant;
public static class BundledAssets {
 static readonly Lazy<string> root=new(Prepare);
 public static string Root=>root.Value;
 static string Hash(byte[] bytes)=>Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
 static string Prepare(){
  var assembly=Assembly.GetExecutingAssembly();
  var names=assembly.GetManifestResourceNames().Where(name=>name.StartsWith("Bundle/",StringComparison.Ordinal)).OrderBy(name=>name,StringComparer.Ordinal).ToArray();
  if(names.Length==0)return AppContext.BaseDirectory;
  var files=names.Select(name=>{using var stream=assembly.GetManifestResourceStream(name)??throw new IOException("内置文件缺失："+name);using var copy=new MemoryStream();stream.CopyTo(copy);return (Name:name[7..].Replace('\\','/'),Bytes:copy.ToArray());}).ToArray();
  string digest=Hash(Encoding.UTF8.GetBytes(string.Join("\n",files.Select(file=>file.Name+":"+Hash(file.Bytes)))));
  var destination=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"FigmaGifAssistant","assets",digest);
  Directory.CreateDirectory(destination);string prefix=Path.GetFullPath(destination)+Path.DirectorySeparatorChar;
  foreach(var file in files){
   string target=Path.GetFullPath(Path.Combine(destination,file.Name));if(!target.StartsWith(prefix,StringComparison.OrdinalIgnoreCase))throw new IOException("内置文件路径无效。");
   if(File.Exists(target)&&Hash(File.ReadAllBytes(target))==Hash(file.Bytes))continue;
   Directory.CreateDirectory(Path.GetDirectoryName(target)!);string temp=target+"."+Guid.NewGuid().ToString("N")+".tmp";
   try{File.WriteAllBytes(temp,file.Bytes);File.Move(temp,target,true);}finally{if(File.Exists(temp))File.Delete(temp);}
  }
  return destination;
 }
}
