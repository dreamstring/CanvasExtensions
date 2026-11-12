/* Real Skia Canvas pixels, not mocked drawImage or destination-area accounting. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas}=require('@napi-rs/canvas'),{plan,pixels}=require('../modules/box/rules');
const source=createCanvas(118,52),brush=source.getContext('2d');
brush.fillStyle='#bfbfbf';brush.fillRect(0,0,118,52);
brush.fillStyle='#fff';brush.fillRect(0,0,118,1);
brush.fillStyle='#ff0000';brush.fillRect(0,0,5,4);
brush.fillStyle='#0000ff';brush.fillRect(114,48,4,4);
const margins=pixels(118,52,{left:10,right:90,top:10,bottom:90},'percent');
function render(planner){const output=createCanvas(959,340),ctx=output.getContext('2d');for(const part of planner(118,52,959,340,margins))ctx.drawImage(source,...part);return {output,ctx,rgba:ctx.getImageData(0,0,959,340).data};}
const actual=render(plan);
for(let p=3;p<actual.rgba.length;p+=4)assert.equal(actual.rgba[p],255,'opaque source must not gain a transparent seam or empty center');
assert.deepEqual([...actual.ctx.getImageData(479,170,1,1).data],[191,191,191,255]);
assert.deepEqual([...actual.ctx.getImageData(1,1,1,1).data],[255,0,0,255]);
assert.deepEqual([...actual.ctx.getImageData(957,338,1,1).data],[0,0,255,255]);
// Prove this fixture detects the previous bug, rather than merely exercising code.
const legacy={module:{exports:{}}};vm.runInNewContext(fs.readFileSync('runtime/services.js','utf8').replace('a[2]<=sw*1e-10','a[2]===0').replace('a[3]<=sh*1e-10','a[3]===0'),legacy);
const broken=render(legacy.module.exports.nineSlice.plan);assert.equal(broken.ctx.getImageData(479,170,1,1).data[3],0,'legacy fractional zero source strip reproduces the missing center');
fs.mkdirSync('artifacts/box-raster',{recursive:true});fs.writeFileSync('artifacts/box-raster/fixed-959x340.png',actual.output.toBuffer('image/png'));fs.writeFileSync('artifacts/box-raster/legacy-959x340.png',broken.output.toBuffer('image/png'));
console.log('PASS real Skia raster: 118x52 to 959x340, full opaque center, no alpha seams, fixed corner colors; old bug reproduced');
