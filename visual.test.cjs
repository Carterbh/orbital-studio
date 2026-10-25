'use strict';
const assert=require('node:assert/strict');
const V=require('./visual-cloud.js');
const sphere=V.surface({n:1,l:0,m:0});
assert.equal(sphere,V.surface({n:1,l:0,m:0,charge:2,occupancy:2}),'charge and occupancy reuse geometry');
assert.ok(sphere.layers[0].level<sphere.layers[1].level);
for(const layer of sphere.layers) {
  const expectedRadius=-Math.log(layer.level*4*Math.PI)/2;
  for(let i=0;i<layer.faces.length;i+=13)for(const j of [0,3,6]) {
    const radius=Math.hypot(...layer.faces.slice(i+j,i+j+3));
    assert.ok(Math.abs(radius-expectedRadius)<.18,'1s surface is spherical at its density threshold');
  }
}
for(const [n,l,m] of [[2,0,0],[2,1,1],[3,2,0],[4,3,2],[7,6,0]]) {
  const model=V.surface({n,l,m});
  for(const layer of model.layers){
    assert.ok(layer.faces.length>0);
    assert.equal(layer.faces.length%13,0);
    assert.ok(layer.faces.every(Number.isFinite));
  }
  if(l===1){
    const signs=new Set();
    for(const layer of model.layers)for(let i=0;i<layer.faces.length;i+=13){
      const xs=[0,3,6].map(j=>layer.faces[i+j]);
      assert.ok(xs.every(x=>x>0)||xs.every(x=>x<0),'p lobes do not bridge the angular node');
      signs.add(layer.faces[i+12]);
    }
    assert.deepEqual([...signs].sort(),[0,1]);
  }
  if(n===2&&l===0){
    const signs=new Set();
    for(const layer of model.layers)for(let i=0;i<layer.faces.length;i+=13)signs.add(layer.faces[i+12]);
    assert.deepEqual([...signs].sort(),[0,1],'2s retains inner and outer radial regions');
  }
}
console.log('PASS: spherical 1s density contours, 2s radial regions, separate signed p lobes, finite d/f/i surfaces, and reusable geometry.');
