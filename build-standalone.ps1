param([string]$Version='')
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$project=Join-Path $root 'src/FigmaGifAssistant.csproj'
[xml]$metadata=Get-Content -LiteralPath $project
$actualVersion=[string]$metadata.Project.PropertyGroup.Version
if(!$Version){$Version=$actualVersion}
if($Version -ne $actualVersion){throw 'Release filename must match the project version'}
$out=Join-Path $root ('standalone-'+$Version)
& dotnet publish (Join-Path $root 'src/FigmaGifAssistant.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:PublishTrimmed=false -p:DebugType=None -p:DebugSymbols=false -o $out
if($LASTEXITCODE -ne 0){throw 'Single-file publish failed'}
$share=Join-Path $root 'share'
New-Item -ItemType Directory -Force $share | Out-Null
$exe=Join-Path $share ('CanvasExtensions-'+$Version+'-win-x64.exe')
Copy-Item -LiteralPath (Join-Path $out 'FigmaGifAssistant.exe') -Destination $exe -Force
Get-Item -LiteralPath $exe | Select-Object FullName,Length
Get-FileHash -LiteralPath $exe
