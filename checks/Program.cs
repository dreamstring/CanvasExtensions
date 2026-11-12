using FigmaGifAssistant;
using System.Text;
using System.Text.Json.Nodes;
using System.Security.Cryptography;
static void Assert(bool value,string label){if(!value)throw new Exception(label);Console.WriteLine("PASS "+label);}
static string Digest(byte[] b)=>Convert.ToHexString(SHA256.HashData(b)).ToLowerInvariant();
// Synthetic archive only. No installed Figma files or private backups are read.
static byte[] Fixture(){
 var main=Encoding.UTF8.GetBytes("console.log('synthetic fixture');");
 var package=Encoding.UTF8.GetBytes("{\"name\":\"figma-test\",\"main\":\"main.js\",\"version\":\"126.10.7\"}");
 JsonObject Entry(byte[] data,int offset)=>new(){["size"]=data.Length,["offset"]=offset.ToString(),["integrity"]=new JsonObject{["algorithm"]="SHA256",["hash"]=Digest(data),["blockSize"]=4194304,["blocks"]=new JsonArray(Digest(data))}};
 var files=new JsonObject{["main.js"]=Entry(main,0),["package.json"]=Entry(package,main.Length)};
 var json=Encoding.UTF8.GetBytes(new JsonObject{["files"]=files}.ToJsonString());int padded=(json.Length+3)&~3;
 var bytes=new byte[16+padded+main.Length+package.Length+8];
 BitConverter.GetBytes(4u).CopyTo(bytes,0);BitConverter.GetBytes((uint)(8+padded)).CopyTo(bytes,4);BitConverter.GetBytes((uint)(4+padded)).CopyTo(bytes,8);BitConverter.GetBytes((uint)json.Length).CopyTo(bytes,12);
 json.CopyTo(bytes,16);main.CopyTo(bytes,16+padded);package.CopyTo(bytes,16+padded+main.Length);
 long length=bytes.Length-8;string trailer="";do{trailer="0123456789abcdefghijklmnopqrstuvwxyz"[(int)(length%36)]+trailer;length/=36;}while(length>0);
 Encoding.ASCII.GetBytes(trailer.PadLeft(8,'0')).CopyTo(bytes,bytes.Length-8);return bytes;
}
var sandbox=Path.Combine(Path.GetTempPath(),"CanvasExtensions-check-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(sandbox);
ExtensionCatalog.TestHome=Path.Combine(sandbox,"catalog");Installer.TestHome=Path.Combine(sandbox,"backup");Installer.TestTarget=Path.Combine(sandbox,"app.asar");Installer.TestRunning=()=>false;
var input=Fixture();File.WriteAllBytes(Installer.Target,input);
Assert(Installer.KnownResource("65223ed24b6e8107852c71c1784984f13bfe6888fcef27b8c3d2461a81330641"),"repository compatibility registry recognizes accepted injection hash");
Assert(!Installer.KnownResource(new string('0',64)),"unknown resources remain experimental");
Asar.VerifyPackedMember(input,"main.js");Assert(Asar.HasFigmaSizeTrailer(input),"synthetic archive trailer");
var extensions=ExtensionCatalog.List();Assert(extensions.Count==3&&extensions.All(x=>!x.BuiltIn&&x.Error==null),"bundled extensions use ordinary directory manifests");
var gif=extensions.Single(x=>x.Info.Id=="gif");Assert(gif.Folder.StartsWith(ExtensionCatalog.CustomDirectory),"bundled extension seeded into custom directory");
File.AppendAllText(Path.Combine(gif.Folder,"main.js"),"\n/* local edit */");ExtensionCatalog.SeedExtensions();Assert(File.ReadAllText(Path.Combine(gif.Folder,"main.js")).EndsWith("/* local edit */"),"local extension edits preserved");
ExtensionCatalog.SetEnabled("gif",false);Assert(!ExtensionCatalog.List().Single(x=>x.Info.Id=="gif").Enabled,"module selection persisted");ExtensionCatalog.SetEnabled("gif",true);
try{ExtensionCatalog.ReadScript(gif,"../escape.js");throw new Exception("path escape accepted");}catch(IOException){Console.WriteLine("PASS script path escape rejected");}
Installer.Apply(Installer.Hash(Installer.Target),Installer.ReviewFingerprint());var installed=File.ReadAllBytes(Installer.Target);Assert(!installed.SequenceEqual(input),"synthetic installation applies loader");
Installer.Apply(Installer.Hash(Installer.Target),Installer.ReviewFingerprint());Assert(installed.SequenceEqual(File.ReadAllBytes(Installer.Target)),"repeated injection is deterministic");
Installer.TestRunning=()=>true;Assert(!Installer.CanApply(),"running client blocks mutation");Installer.TestRunning=()=>false;
Installer.Restore();Assert(input.SequenceEqual(File.ReadAllBytes(Installer.Target)),"restore returns original synthetic archive");
Console.WriteLine("All installer checks used disposable synthetic files: "+sandbox);

var uninstallRoot=Path.Combine(sandbox,"uninstall-fixture");var uninstallApp=Path.Combine(uninstallRoot,"app-1.2.3");Directory.CreateDirectory(Path.Combine(uninstallApp,"resources"));var uninstallTarget=Path.Combine(uninstallApp,"resources","app.asar");File.WriteAllText(uninstallTarget,"fixture");File.WriteAllText(Path.Combine(uninstallApp,"Figma.exe"),"");File.WriteAllText(Path.Combine(uninstallRoot,"Update.exe"),"");
try{FigmaUninstaller.Resolve(uninstallTarget);throw new Exception("last version accepted");}catch(IOException){Console.WriteLine("PASS blocks removal of last available version");}
var sibling=Path.Combine(uninstallRoot,"app-2.0.0");Directory.CreateDirectory(Path.Combine(sibling,"resources"));File.WriteAllText(Path.Combine(sibling,"Figma.exe"),"");File.WriteAllText(Path.Combine(sibling,"resources","app.asar"),"fixture");
var uninstallPlan=FigmaUninstaller.Resolve(uninstallTarget);Assert(uninstallPlan.VersionDirectory==uninstallApp&&uninstallPlan.Version=="1.2.3","removal plan targets selected OLD version only; never executed on installed Figma");
try{FigmaUninstaller.Resolve(Path.Combine(sibling,"resources","app.asar"));throw new Exception("latest version accepted");}catch(IOException){Console.WriteLine("PASS blocks removal of latest version even with older version present");}
Assert(Directory.Exists(sibling)&&File.Exists(Path.Combine(uninstallRoot,"Update.exe")),"planning preserves sibling versions and updater");
var invalid=Path.Combine(uninstallRoot,"resources");Directory.CreateDirectory(invalid);File.WriteAllText(Path.Combine(invalid,"app.asar"),"fixture");try{FigmaUninstaller.Resolve(Path.Combine(invalid,"app.asar"));throw new Exception("root accepted");}catch(IOException){Console.WriteLine("PASS refuses installation root instead of version folder");}

FigmaLocator.Select(uninstallTarget);File.Delete(uninstallTarget);try{Assert(!string.Equals(FigmaLocator.Resolve(),uninstallTarget,StringComparison.OrdinalIgnoreCase),"stale configured path is not returned after archive disappears");}catch(IOException){Console.WriteLine("PASS missing installation reports an error instead of returning stale path");}
