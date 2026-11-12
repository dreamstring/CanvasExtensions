using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
namespace FigmaGifAssistant;
public static class ExtensionCatalog {
 internal static string? TestHome {get;set;}
 public static string Home=>TestHome??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"FigmaGifAssistant");
 public static string CustomDirectory=>Path.Combine(Home,"extensions");
 static readonly JsonSerializerOptions Json=new(){PropertyNameCaseInsensitive=true,WriteIndented=true};
 public sealed record Manifest(int SchemaVersion,string Id,string Name,string Version,string Description,string Permission,string[] Scripts,string[] Commands,string[]? NativeCapabilities=null,string? MinimumSdk=null);
 public sealed record Extension(Manifest Info,string Folder,bool BuiltIn,bool Enabled,string? Error) {
  public string State=>Error??(Enabled?"已选择启用":"已选择停用");
  public string PermissionLabel=>(Info.Permission=="write-design"?"修改设计内容":"只读设计")+(Info.NativeCapabilities?.Contains("export-png")==true?" · 导出本地图片":"");
 }
 public static List<Extension> List(){
  SeedExtensions();var selection=ReadSelection();var result=new List<Extension>();var ids=new HashSet<string>(StringComparer.Ordinal);
  foreach(var root in new[]{CustomDirectory}){
   if(!Directory.Exists(root))continue;
   foreach(var folder in Directory.GetDirectories(root).OrderBy(x=>x,StringComparer.Ordinal)){
    try{
     var m=JsonSerializer.Deserialize<Manifest>(File.ReadAllText(Path.Combine(folder,"module.json")),Json)??throw new IOException("扩展清单为空");
     if(m.SchemaVersion!=1||(m.Id is null||!Regex.IsMatch(m.Id,"^[a-z][a-z0-9-]{0,47}$"))||string.IsNullOrWhiteSpace(m.Name)||m.Scripts is null||m.Scripts.Length==0||m.Commands is null||m.Commands.Any(c=>!Regex.IsMatch(c,"^[a-zA-Z][a-zA-Z0-9]{0,47}$"))||m.Commands.Distinct().Count()!=m.Commands.Length||m.Permission is not ("read-design" or "write-design"))throw new IOException("扩展清单格式不受支持");
     if(m.MinimumSdk is not null&&(!Version.TryParse(m.MinimumSdk,out var required)||required>new Version(2,1,0)))throw new IOException("扩展需要更高版本 SDK："+m.MinimumSdk);
     if(!ids.Add(m.Id))throw new IOException("扩展 ID 重复");
     if(m.NativeCapabilities?.Any(x=>x is not ("export-png" or "open-export-folder" or "choose-export-folder"))==true)throw new IOException("扩展声明了不受支持的本地能力");
     bool builtin=false;var extension=new Extension(m,folder,builtin,selection.GetValueOrDefault(m.Id,File.Exists(Path.Combine(folder,".bundled-seed"))),null);
     foreach(var script in m.Scripts)_=ReadScript(extension,script);result.Add(extension);
    }catch(Exception ex){result.Add(new Extension(new Manifest(1,Path.GetFileName(folder),Path.GetFileName(folder),"—","无法加载此扩展","read-design",[],[]),folder,false,false,ex.Message));}
   }
  }return result;
 }
 public static void SeedExtensions(){
  Directory.CreateDirectory(CustomDirectory);
  var source=Path.Combine(BundledAssets.Root,"modules");if(!Directory.Exists(source))return;
  foreach(var folder in Directory.GetDirectories(source)){
   var target=Path.Combine(CustomDirectory,Path.GetFileName(folder));if(Directory.Exists(target))continue;
   Directory.CreateDirectory(target);
   foreach(var file in Directory.GetFiles(folder,"*",SearchOption.AllDirectories)){
    var dest=Path.Combine(target,Path.GetRelativePath(folder,file));Directory.CreateDirectory(Path.GetDirectoryName(dest)!);File.Copy(file,dest,false);
   }
   File.WriteAllText(Path.Combine(target,".bundled-seed"),"Initial example package; local edits are never overwritten.");
  }
 }
 static Dictionary<string,bool> ReadSelection()=>File.Exists(Path.Combine(Home,"extensions.json"))?JsonSerializer.Deserialize<Dictionary<string,bool>>(File.ReadAllText(Path.Combine(Home,"extensions.json")),Json)??new():new();
 public static void SetEnabled(string id,bool enabled){var module=List().Single(x=>x.Info.Id==id&&x.Error is null);var state=ReadSelection();state[module.Info.Id]=enabled;Directory.CreateDirectory(Home);File.WriteAllText(Path.Combine(Home,"extensions.json"),JsonSerializer.Serialize(state,Json));}
 public static string ReadScript(Extension module,string relative){
  var allowed=Path.TrimEndingDirectorySeparator(Path.GetFullPath(module.BuiltIn?BundledAssets.Root:module.Folder))+Path.DirectorySeparatorChar;
  var file=Path.GetFullPath(Path.Combine(module.Folder,relative));
  if(!file.StartsWith(allowed,StringComparison.OrdinalIgnoreCase)||!file.EndsWith(".js",StringComparison.OrdinalIgnoreCase))throw new IOException("扩展脚本必须位于允许的本地目录");
  // Reject linked paths so a package cannot escape its declared folder.
  for(var item=new FileInfo(file) as FileSystemInfo;item!=null&&item.FullName.Length>=allowed.Length-1;item=item is FileInfo?((FileInfo)item).Directory:((DirectoryInfo)item).Parent)if((item.Attributes&FileAttributes.ReparsePoint)!=0)throw new IOException("扩展不支持符号链接");
  var bytes=File.ReadAllBytes(file);if(bytes.Length>4*1024*1024)throw new IOException("单个扩展脚本超过 4 MB");return System.Text.Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF');
 }
 public static string Payload(){
  var enabled=List().Where(x=>x.Enabled&&x.Error is null).ToArray();
  var builder=new System.Text.StringBuilder(File.ReadAllText(Path.Combine(BundledAssets.Root,"runtime","framework.js")));
  builder.Append(File.ReadAllText(Path.Combine(BundledAssets.Root,"runtime","component-reference.js")));
  builder.Append(File.ReadAllText(Path.Combine(BundledAssets.Root,"runtime","native-ui.js")));
  builder.Append(File.ReadAllText(Path.Combine(BundledAssets.Root,"runtime","services.js")));
  builder.Append(File.ReadAllText(Path.Combine(BundledAssets.Root,"runtime","editor-services.js")));
  builder.Append(File.ReadAllText(Path.Combine(BundledAssets.Root,"runtime","sdk.js")));
  builder.Append(File.ReadAllText(Path.Combine(BundledAssets.Root,"runtime","component-kit.js")));
  foreach(var module in enabled){
   builder.Append("\n;window.FigmaExtensions.begin(").Append(JsonSerializer.Serialize(module.Info.Id)).Append(',').Append(JsonSerializer.Serialize(module.Info.Commands)).Append(',').Append(JsonSerializer.Serialize(module.Info.NativeCapabilities??[])).Append(");try{\n");
   foreach(var file in module.Info.Scripts)builder.Append(ReadScript(module,file)).Append('\n');

   builder.Append("}catch(error){window.FigmaExtensions.fail(").Append(JsonSerializer.Serialize(module.Info.Id)).Append(",String(error));}finally{window.FigmaExtensions.end();window.FigmaAssistant=window.FigmaExtensions;}\n");
  }return builder.Append("\nvoid 0;\n").ToString();
 }
 public static string CommandMap()=>JsonSerializer.Serialize(List().Where(x=>x.Enabled&&x.Error is null).ToDictionary(x=>x.Info.Id,x=>x.Info.Commands));
 public static string NativeMap()=>JsonSerializer.Serialize(List().Where(x=>x.Enabled&&x.Error is null&&x.Info.NativeCapabilities?.Length>0).ToDictionary(x=>x.Info.Id,x=>x.Info.NativeCapabilities));
}
