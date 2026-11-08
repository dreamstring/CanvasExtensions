using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
namespace FigmaGifAssistant;
public static class Installer {
 public const string SupportedHash="af0f2aa0d8ea138704217fdf23b5589be6dc1d77fd31df8a4465bda09d247ac5";
 public const string InstallationHoldReason="";
 internal static string? TestTarget {get;set;}
 internal static string? TestHome {get;set;}
 internal static Func<bool>? TestRunning {get;set;}
 public static string Target=>TestTarget??FigmaLocator.Resolve();
 public static bool ExperimentalCompatibility {get;set;}=true;
 public static string TargetVersion=>FigmaLocator.VersionOf(Target);
 static string Home=>TestHome??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"FigmaGifAssistant");
 static string LegacyRecord=>Path.Combine(Home,"installation.json");
 static string Record {get {if(TestTarget!=null)return LegacyRecord;try{if(File.Exists(LegacyRecord)&&string.Equals(JsonSerializer.Deserialize<Installation>(File.ReadAllText(LegacyRecord))?.Target,Target,StringComparison.OrdinalIgnoreCase))return LegacyRecord;}catch{}return Path.Combine(Home,"installations",TargetKey(Target),"installation.json");}}
 internal static string TargetKey(string path)=>Digest(Encoding.UTF8.GetBytes(Path.GetFullPath(path).ToLowerInvariant()))[..24];
 static string BackupPath=>Path.Combine(Path.GetDirectoryName(Record)!,"app.asar.original");
 public static string StateStamp()=>string.Join(":",new[]{Record,Target,Path.Combine(ExtensionCatalog.Home,"extensions.json")}.Select(path=>File.Exists(path)?File.GetLastWriteTimeUtc(path).Ticks.ToString():"missing"));
 public static string Hash(string path)=>Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant();
 static bool Running()=>TestRunning?.Invoke()??Process.GetProcessesByName("Figma").Length>0;
 public static string DetectLabel(){if(!File.Exists(Target))return "安装路径已失效，请重新选择 Figma";try{var original=ReadBaseline();return "Figma "+TargetVersion+" · "+(Digest(original)==SupportedHash?"已验证资源":"实验兼容 · 待实机验收")+(IsInstalled()?" · 已注入":"");}catch{return "Figma "+TargetVersion+" · 需要兼容性检查";}}
 static void CheckExpectedStructure(byte[] bytes){
  if(!Asar.HasFigmaSizeTrailer(bytes))throw new IOException("未识别到已支持的 Figma 长度标记，不能尝试此版本。");
  Asar.VerifyPackedMember(bytes,"main.js");Asar.VerifyPackedMember(bytes,"package.json");
  var package=JsonNode.Parse(Asar.ReadPackedText(bytes,"package.json"))!;
  if(package["main"]?.GetValue<string>()!="main.js")throw new IOException("此版本的启动入口不是 main.js，需要单独适配。");
  var name=package["name"]?.GetValue<string>()??"";if(!name.Contains("figma",StringComparison.OrdinalIgnoreCase))throw new IOException("资源不是已识别的 Figma 桌面包。");
  _=Asar.AppendMain(bytes,"/* read-only compatibility probe */");
 }
 public static string CompatibilityJson(){
  var current=File.ReadAllBytes(Target);var bytes=current;
  if(File.Exists(Record)){var installed=JsonSerializer.Deserialize<Installation>(File.ReadAllText(Record));if(installed!=null&&installed.Installed==Digest(current)&&string.Equals(installed.Target,Target,StringComparison.OrdinalIgnoreCase)){bytes=File.ReadAllBytes(installed.Backup);if(Digest(bytes)!=installed.Original)throw new IOException("原始备份校验失败。");}}
  bool known=Digest(bytes)==SupportedHash;string structure="";try{if(!known)CheckExpectedStructure(bytes);}catch(Exception ex){structure=ex.Message;}
  return JsonSerializer.Serialize(new {target=Target,version=TargetVersion,current_sha256=Digest(current),original_sha256=Digest(bytes),verified_original=known,structure_compatible=structure.Length==0,structure_error=structure,experimental_selected=ExperimentalCompatibility,note="结构相容不代表启动、控件和运行接口已验证；未知版本仅供实验验收。"},new JsonSerializerOptions{WriteIndented=true,Encoder=System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping});
 }
 static byte[] ReadBaseline(){
  var current=File.ReadAllBytes(Target);if(Digest(current)==SupportedHash)return current;
  if(File.Exists(Record)){
   var r=JsonSerializer.Deserialize<Installation>(File.ReadAllText(Record))??throw new IOException("安装记录无效。");
   if(!string.Equals(r.Target,Target,StringComparison.OrdinalIgnoreCase)||r.Installed!=Digest(current))throw new IOException("当前资源与此安装位置的记录不匹配，拒绝覆盖。");
   var original=File.ReadAllBytes(r.Backup);if(Digest(original)!=r.Original)throw new IOException("原始备份校验失败。");
   if(r.Original!=SupportedHash){CheckExpectedStructure(original);if(!ExperimentalCompatibility)throw new IOException("此安装为未验证版本，请重新勾选实验兼容后更新；恢复原版不受影响。");}return original;
  }
  CheckExpectedStructure(current);if(!ExperimentalCompatibility)throw new IOException("Figma "+TargetVersion+" 尚未实机验证。结构检查通过后，可勾选实验兼容进行验收。");return current;
 }
 static string PayloadPath(string hash)=>Path.Combine(Home,"payloads",hash+".js");
 static string Payload()=>ExtensionCatalog.Payload();
 static string Loader(string payloadHash)=>File.ReadAllText(Path.Combine(BundledAssets.Root,"runtime","loader.cjs")).Replace("__PAYLOAD_PATH__",JsonSerializer.Serialize(PayloadPath(payloadHash))).Replace("__PAYLOAD_SHA256__",payloadHash).Replace("__COMMANDS__",ExtensionCatalog.CommandMap()).Replace("__NATIVE_MAP__",ExtensionCatalog.NativeMap()).Replace("__NATIVE_EXPORT_FACTORY__",File.ReadAllText(Path.Combine(BundledAssets.Root,"runtime","native-export.cjs"))).Replace("__STARTUP_SOURCE__",JsonSerializer.Serialize(File.ReadAllText(Path.Combine(BundledAssets.Root,"runtime","startup.js"))));
 static string Digest(byte[] bytes)=>Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
 public static string ReviewFingerprint()=>Digest(Encoding.UTF8.GetBytes(Payload()+Loader(Digest(Encoding.UTF8.GetBytes(Payload())))));
 public static bool CanApply()=>ApplyBlockReason().Length==0;
 public static string ApplyBlockReason(){if(Running())return "请先保存并正常退出 Figma，再应用更改。";try{ReadBaseline();return "";}catch(Exception ex){return ex.Message;}}
 public static bool IsRunning()=>Running();
 public static bool IsInstalled()=>File.Exists(Record)&&File.Exists(Target)&&JsonSerializer.Deserialize<Installation>(File.ReadAllText(Record))?.Installed==Hash(Target);
 public static bool IsCurrent(){if(!IsInstalled())return false;using var p=JsonDocument.Parse(PlanJson());return p.RootElement.GetProperty("current_sha256").GetString()==p.RootElement.GetProperty("proposed_sha256").GetString();}
 public static string PlanJson(){
  var original=ReadBaseline(); var payload=Encoding.UTF8.GetBytes(Payload());
  var patched=Asar.AppendMain(original,Loader(Digest(payload)));
  return JsonSerializer.Serialize(new {version=TargetVersion,compatibility=Digest(original)==SupportedHash?"verified-resource":"experimental-structural-only",target=Target,current_sha256=Hash(Target),original_sha256=Digest(original),expected_sha256=Digest(original),original_bytes=original.Length,proposed_bytes=patched.Length,native_size_trailer_valid=Asar.HasFigmaSizeTrailer(patched),original_size_trailer=Encoding.ASCII.GetString(original,original.Length-8,8),proposed_size_trailer=Encoding.ASCII.GetString(patched,patched.Length-8,8),installation_hold=InstallationHoldReason,proposed_sha256=Digest(patched),payload_sha256=Digest(payload),figma_running=Running(),can_apply=CanApply(),backup=BackupPath,changes=new[]{"main.js 追加加载入口；更新 ASAR 成员偏移和完整性字段","外部本地 payload；不修改 Figma.exe；不关闭进程"},risks=new[]{"客户端加载、侧栏定位、主题尚未运行验收","Figma 更新需要重新检查版本；存在自定义完整性检查的可能","复杂遮罩、透明 GIF、图层合成存在预览限制"}},new JsonSerializerOptions{WriteIndented=true,Encoder=System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping});
 }
 public static void Apply(string reviewedHash,string reviewedPayload){

  if(Running())throw new InvalidOperationException("请先正常退出所有 Figma 进程，工具不会关闭进程。");
  if(Hash(Target)!=reviewedHash||ReviewFingerprint()!=reviewedPayload)throw new InvalidOperationException("文件、脚本或安装记录已变化，请重新检查计划。");
  var original=ReadBaseline();var payload=Encoding.UTF8.GetBytes(Payload());var patched=Asar.AppendMain(original,Loader(Digest(payload)));
  if(!Asar.HasFigmaSizeTrailer(patched))throw new IOException("Figma 原生长度标记校验失败，拒绝写入。");
  Directory.CreateDirectory(Path.GetDirectoryName(Record)!);var backup=BackupPath;
  if(File.Exists(backup)&&Hash(backup)!=Digest(original))throw new InvalidOperationException("已有不同备份，拒绝覆盖。");
  if(!File.Exists(backup))File.WriteAllBytes(backup,original);
  string payloadFile=PayloadPath(Digest(payload));Directory.CreateDirectory(Path.GetDirectoryName(payloadFile)!);
  if(File.Exists(payloadFile)&&Hash(payloadFile)!=Digest(payload))throw new IOException("同名脚本哈希不匹配，拒绝覆盖。");
  if(!File.Exists(payloadFile))File.WriteAllBytes(payloadFile,payload);
  // Record first so a crash after replacement still leaves recovery information.
  var record=new Installation(Target,backup,Digest(original),Digest(patched),reviewedHash,payloadFile,"0.6.2",ExtensionCatalog.List().Where(x=>x.Enabled&&x.Error is null).Select(x=>x.Info.Id).ToArray());
  File.WriteAllText(Record,JsonSerializer.Serialize(record));
  Replace(patched,reviewedHash);
 }
 public static void ApplyPlanFile(string path){

  using var reviewed=JsonDocument.Parse(File.ReadAllText(path));using var current=JsonDocument.Parse(PlanJson());
  foreach(var key in new[]{"version","target","original_sha256","current_sha256","proposed_sha256","payload_sha256"})if(reviewed.RootElement.GetProperty(key).GetString()!=current.RootElement.GetProperty(key).GetString())throw new IOException("计划已过期："+key);
  Apply(reviewed.RootElement.GetProperty("current_sha256").GetString()!,ReviewFingerprint());
 }
 public static void ApplyStartupAcceptancePlan(string path){
  // Explicit experimental CLI only; the ordinary installation UI remains on hold.
  using var reviewed=JsonDocument.Parse(File.ReadAllText(path));using var current=JsonDocument.Parse(PlanJson());
  foreach(var key in new[]{"version","target","original_sha256","current_sha256","proposed_sha256","payload_sha256"})if(reviewed.RootElement.GetProperty(key).GetString()!=current.RootElement.GetProperty(key).GetString())throw new IOException("验收计划已过期："+key);
  Apply(reviewed.RootElement.GetProperty("current_sha256").GetString()!,ReviewFingerprint());
 }
 static void Replace(byte[] bytes,string expected){
  if(Running()||Hash(Target)!=expected)throw new InvalidOperationException("进程或资源发生变化，操作已停止。");
  string temporary=Target+".fga-"+Guid.NewGuid().ToString("N")+".tmp";
  try{File.WriteAllBytes(temporary,bytes);if(Hash(temporary)!=Digest(bytes))throw new IOException("临时文件校验失败。");if(Running()||Hash(Target)!=expected)throw new IOException("提交前状态发生变化。");File.Replace(temporary,Target,null);}finally{if(File.Exists(temporary))File.Delete(temporary);}
 }
 public static void Restore(){
  var r=JsonSerializer.Deserialize<Installation>(File.ReadAllText(Record))??throw new IOException("安装记录无效。");
  if(!string.Equals(r.Target,Target,StringComparison.OrdinalIgnoreCase)||Hash(r.Backup)!=r.Original)throw new IOException("备份或目标校验失败。");
  var current=Hash(Target);if(current!=r.Installed&&current!=r.Original&&current!=r.PreviousInstalled)throw new IOException("当前文件被更新或修改，拒绝覆盖。");
  Replace(File.ReadAllBytes(r.Backup),current);File.Move(Record,Record+".restored-"+DateTime.UtcNow.Ticks);
 }
 public static string DiagnosticPath(){var r=File.Exists(Record)?JsonSerializer.Deserialize<Installation>(File.ReadAllText(Record)):null;var file=r?.PayloadFile??Path.Combine(Home,"payload.js");if(!Path.GetFullPath(file).StartsWith(Path.GetFullPath(Home)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new IOException("诊断路径不在助手目录内。");return file+".diagnostic.jsonl";}
 public static string InstalledVersion(){if(!IsInstalled())return "未安装";var r=JsonSerializer.Deserialize<Installation>(File.ReadAllText(Record))!;return r.FrameworkVersion??(r.Installed=="8c0f5292e07c4c2943b470601596ba194658c7cd94514921a5050f9c20f68c2e"?"0.1.5":"旧版");}
 public record Installation(string Target,string Backup,string Original,string Installed,string? PreviousInstalled=null,string? PayloadFile=null,string? FrameworkVersion=null,string[]? EnabledModules=null);
}
public static class Asar {
 public static void VerifyPackedMember(byte[] input,string name){
  var root=JsonNode.Parse(Encoding.UTF8.GetString(input,16,checked((int)BitConverter.ToUInt32(input,12))))!;var member=root["files"]?[name]??throw new IOException("ASAR member missing: "+name);var integrity=member["integrity"];
  if(integrity?["algorithm"]?.GetValue<string>()!="SHA256")throw new IOException("此版本缺少可识别的成员完整性信息："+name);
  var actual=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(ReadPackedText(input,name)))).ToLowerInvariant();if(actual!=integrity["hash"]?.GetValue<string>())throw new IOException("资源成员完整性不匹配："+name);
 }
 public static string ReadPackedText(byte[] input,string name){
  if(input.Length<16)throw new IOException("ASAR header too short");int start=checked(8+(int)BitConverter.ToUInt32(input,4)),len=checked((int)BitConverter.ToUInt32(input,12));if(len<2||start>input.Length||16+len>start)throw new IOException("Invalid ASAR header");
  var root=JsonNode.Parse(Encoding.UTF8.GetString(input,16,len))!;var member=root["files"]?[name]??throw new IOException("ASAR member missing: "+name);int offset=int.Parse(member["offset"]!.GetValue<string>()),size=member["size"]!.GetValue<int>();if(offset<0||size<0||start+(long)offset+size>input.Length)throw new IOException("Invalid ASAR member bounds");return Encoding.UTF8.GetString(input,start+offset,size);
 }

 public static byte[] AppendMain(byte[] input,string loader){
  if(input.Length<16)throw new IOException("ASAR header too short");
  int start=checked(8+(int)BitConverter.ToUInt32(input,4)),len=checked((int)BitConverter.ToUInt32(input,12));
  if(len<2||start>input.Length||16+len>start)throw new IOException("Invalid ASAR header");
  var root=JsonNode.Parse(Encoding.UTF8.GetString(input,16,len))!.AsObject();
  var members=new List<JsonObject>(); Walk(root["files"]!.AsObject(),members);
  var main=root["files"]!["main.js"]!.AsObject();int offset=int.Parse(main["offset"]!.GetValue<string>()),size=main["size"]!.GetValue<int>();
  foreach(var m in members){long n=m["size"]?.GetValue<long>()??0;if(n<0)continue;long o=long.Parse(m["offset"]!.GetValue<string>());if(o<0||start+o+n>input.LongLength)throw new IOException("Invalid packed member bounds");}
  var oldMain=Encoding.UTF8.GetString(input,start+offset,size);if(oldMain.Contains("FGA_LOADER_BEGIN"))throw new IOException("加载入口已存在，拒绝重复追加。");
  var suffix=Encoding.UTF8.GetBytes("\n;/* FGA_LOADER_BEGIN */\n"+loader+"\n/* FGA_LOADER_END */\n");
  var newMain=new byte[size+suffix.Length];Buffer.BlockCopy(input,start+offset,newMain,0,size);suffix.CopyTo(newMain,size);
  foreach(var m in members){if(ReferenceEquals(m,main)||m["size"]!.GetValue<long>()<0)continue;long o=long.Parse(m["offset"]!.GetValue<string>());if(o>=offset+size)m["offset"]=(o+suffix.Length).ToString();else if(o+m["size"]!.GetValue<long>()>offset)throw new IOException("Overlapping ASAR member");}
  main["size"]=newMain.Length;var blocks=new JsonArray();const int blockSize=4194304;for(int i=0;i<newMain.Length;i+=blockSize)blocks.Add(Convert.ToHexString(SHA256.HashData(newMain.AsSpan(i,Math.Min(blockSize,newMain.Length-i)))).ToLowerInvariant());
  main["integrity"]=new JsonObject{["algorithm"]="SHA256",["hash"]=Convert.ToHexString(SHA256.HashData(newMain)).ToLowerInvariant(),["blockSize"]=blockSize,["blocks"]=blocks};
  var json=Encoding.UTF8.GetBytes(root.ToJsonString());int padded=(json.Length+3)&~3;var output=new byte[16+padded+input.Length-start+suffix.Length];
  BitConverter.GetBytes(4u).CopyTo(output,0);BitConverter.GetBytes((uint)(8+padded)).CopyTo(output,4);BitConverter.GetBytes((uint)(4+padded)).CopyTo(output,8);BitConverter.GetBytes((uint)json.Length).CopyTo(output,12);json.CopyTo(output,16);
  Buffer.BlockCopy(input,start,output,16+padded,offset+size);suffix.CopyTo(output,16+padded+offset+size);Buffer.BlockCopy(input,start+offset+size,output,16+padded+offset+size+suffix.Length,input.Length-start-offset-size);
  // Figma's native bindings independently check an 8-byte base36 size trailer.
  // It is outside the ordinary ASAR member graph and is not Electron's fuse validation.
  if(HasFigmaSizeTrailer(input))Encoding.ASCII.GetBytes(ToBase36(output.LongLength-8).PadLeft(8,'0')).CopyTo(output,output.Length-8);
  return output;
 }
 public static bool HasFigmaSizeTrailer(byte[] bytes){
  if(bytes.Length<8)return false;long value=0;
  foreach(byte ch in bytes.AsSpan(bytes.Length-8)){int n=ch>=(byte)'0'&&ch<=(byte)'9'?ch-'0':ch>=(byte)'a'&&ch<=(byte)'z'?ch-'a'+10:-1;if(n<0)return false;value=checked(value*36+n);}
  return value==bytes.LongLength-8;
 }
 static string ToBase36(long value){const string digits="0123456789abcdefghijklmnopqrstuvwxyz";var result=new StringBuilder();do{result.Insert(0,digits[(int)(value%36)]);value/=36;}while(value>0);if(result.Length>8)throw new IOException("Figma size trailer overflow");return result.ToString();}
 static void Walk(JsonObject files,List<JsonObject> members){foreach(var entry in files){var m=entry.Value!.AsObject();if(m["files"] is JsonObject child)Walk(child,members);else if(m["offset"]!=null&&m["unpacked"]?.GetValue<bool>()!=true)members.Add(m);}}
}




