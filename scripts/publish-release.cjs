'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os'),crypto=require('crypto');
const request=require('../.github/release-request.json'),version=require('../package.json').version;
if(request.version!==version||!/^\d+\.\d+\.\d+$/.test(version))throw Error('Version mismatch');
if(!process.env.GITHUB_ACTIONS||!process.env.GH_REPO||!process.env.GITHUB_SHA)throw Error('Use GitHub Actions');
function gh(args){return cp.execFileSync('gh',args,{encoding:'utf8'});}
const tag='v'+version,file=path.resolve('share/CanvasExtensions-'+version+'-win-x64.exe');
const notes=path.join(os.tmpdir(),'canvas-release-notes.md');fs.writeFileSync(notes,request.notes+'\n\nSource: '+process.env.GITHUB_SHA+'\n');
let found=false;try{gh(['release','view',tag]);found=true;}catch(error){if(!String(error.stderr).includes('release not found'))throw error;}
if(!found)gh(['release','create',tag,'--target',process.env.GITHUB_SHA,'--title','Canvas Extensions '+version,'--notes-file',notes]);
gh(['release','upload',tag,file,'--clobber']);
gh(['release','edit',tag,'--notes-file',notes,'--latest']);
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'canvas-release-'));gh(['release','download',tag,'--pattern',path.basename(file),'--dir',folder]);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');if(hash(file)!==hash(path.join(folder,path.basename(file))))throw Error('Published EXE verification failed');
console.log('Verified standalone release '+tag);
