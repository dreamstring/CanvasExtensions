'use strict';
const fs=require('fs'),cp=require('child_process'),path=require('path');
process.chdir(path.resolve(__dirname,'..'));
for(const file of ['engine-test.cjs','loader-test.cjs','sdk-test.cjs','section-header-test.cjs','sidebar-test.cjs','texture-export-test.cjs','box-test.cjs','box-raster-test.cjs','box-renderer-test.cjs','box-runtime-test.cjs','box-placement-test.cjs']){const r=cp.spawnSync(process.execPath,['checks/'+file],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
