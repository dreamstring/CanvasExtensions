const assert=require('node:assert/strict'),{plan,pixels}=require('../modules/box/rules.js');
const m={left:10,right:20,top:5,bottom:15};
const parts=plan(100,80,300,200,m);assert.equal(parts.length,9);
assert.deepEqual(parts[0],[0,0,10,5,0,0,10,5]);
assert.deepEqual(parts[4],[10,5,70,60,10,5,270,180]);
assert.deepEqual(parts[8],[80,65,20,15,280,185,20,15]);
// Small targets shrink opposing borders proportionally, never overlap or go negative.
const small=plan(100,80,15,10,m);assert(small.every(p=>p.slice(2,4).every(v=>v>0)&&p.slice(6).every(v=>v>0)));
assert.equal(small.reduce((sum,p)=>sum+p[6]*p[7],0),150);
for(const bad of [-1,NaN,Infinity,100])assert.throws(()=>plan(100,80,300,200,{...m,left:bad}));
assert.equal(plan(100,80,300,200,{left:0,right:0,top:0,bottom:0}).length,1);
console.log('PASS Box nine-slice: fixed corners, stretched center, tiny targets, zero/invalid margins');

assert.deepEqual(pixels(200,100,{left:10,right:20,top:10,bottom:20},'percent'),{left:20,top:10,right:40,bottom:20});
assert.deepEqual(pixels(200,100,m),m);
assert.throws(()=>pixels(200,100,m,'unknown'));
// User's 118x52 source: identity at original size, fixed corner sizes after resizing.
const userMargins=pixels(118,52,{left:27.5,top:17,right:10,bottom:10},'percent');
for(const p of plan(118,52,118,52,userMargins))assert.deepEqual(p.slice(0,4),p.slice(4));
const enlarged=plan(118,52,236,104,userMargins);
assert.deepEqual(enlarged[0].slice(2,4).map(Math.round),enlarged[0].slice(6));
assert(enlarged[4][6]>enlarged[4][2]);assert(enlarged[4][7]>enlarged[4][3]);
const seam=pixels(118,52,{left:10,top:10,right:90,bottom:90},'percent');
const zeroCenter=plan(118,52,236,104,seam);
assert.equal(zeroCenter.length,9);assert(zeroCenter.every(p=>p.every(Number.isFinite)&&p[2]>0&&p[3]>0));
assert.equal(zeroCenter[4][2],1,'collapsed middle must sample one full pixel, not a subpixel rounding residue');
assert.equal(zeroCenter[4][3],1);assert(Number.isInteger(zeroCenter[4][0]));assert(Number.isInteger(zeroCenter[4][1]));
assert(Math.abs(zeroCenter.reduce((sum,p)=>sum+p[6]*p[7],0)-236*104)<1e-6,'zero-width source seams must not leave transparent gaps');

for(const p of plan(118,52,959,340,seam))assert(p.slice(4).every(Number.isInteger),'all destination edges must land on shared pixels');
for(const p of plan(118,52,959,340,seam,.317))assert(p.slice(4).every(Number.isInteger),'preview uses the same pixel snapping in its own output resolution');
