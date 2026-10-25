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
const options={width:160,height:160,scale:18,yaw:0,pitch:0,maxSize:80};
const hydrogen={n:1,l:0,m:0,occupancy:1,charge:1};
const glow=V.projectVolume(hydrogen,options),paired=V.projectVolume({...hydrogen,occupancy:2},options);
assert.equal(glow.width,paired.width);
let brighter=0;
for(let i=3;i<glow.pixels.length;i+=4){assert.ok(paired.pixels[i]>=glow.pixels[i]);if(paired.pixels[i]>glow.pixels[i])brighter++;}
assert.ok(brighter>0,'paired occupation increases opacity without changing field dimensions');
assert.deepEqual(V.projectVolume(hydrogen,options).pixels,glow.pixels,'continuous fields are deterministic');
const center=(Math.floor(glow.height/2)*glow.width+Math.floor(glow.width/2))*4+3;
assert.ok(glow.pixels[center]>glow.pixels[3],'1s is brightest at the origin');
for(const [m,axis] of [[1,[.3,0,0]],[-1,[0,.3,0]],[0,[0,0,.3]]]){
  const grid=V.volume({n:2,l:1,m});
  assert.ok(Math.abs(V.field(grid,...axis))>.01,'each p orientation has its own axial field');
  const perpendicular=axis[0]?[0,.3,0]:[.3,0,0];
  assert.ok(Math.abs(V.field(grid,...perpendicular))<1e-6,'p angular nodes stay empty');
}
assert.ok(V.projectVolume({...hydrogen,occupancy:0},options).pixels.every((value,i)=>i%4!==3||value===0));
console.log('PASS: continuous deterministic density projections, centered s glow, three distinct p axes, and occupancy-only opacity changes.');
const outerP={n:7,l:1,m:1,charge:1,occupancy:2};
const bands=V.projectVolume(outerP,{width:448,height:448,scale:210/V.volume(outerP).extent,yaw:0,pitch:0,maxSize:224});
const mid=Math.floor(bands.width/2),row=Math.floor(bands.height/2);
const profile=Array.from({length:mid},(_,x)=>bands.pixels[(row*bands.width+mid+x)*4+3]);
const peaks=[];
for(let x=1;x<profile.length-1;x++)if(profile[x]>80&&profile[x]>=profile[x-1]&&profile[x]>profile[x+1])peaks.push(x);
let separated=0;
for(let i=1;i<peaks.length;i++){
  const valley=Math.min(...profile.slice(peaks[i-1],peaks[i]+1));
  if(valley<Math.min(profile[peaks[i-1]],profile[peaks[i]])*.5)separated++;
}
assert.ok(profile[0]<5,'the p nodal plane remains dark');
assert.ok(separated>=3,'high-shell p fields retain at least four bright bands separated by dark valleys');
console.log('PASS: distinct high-shell p bands with dark gaps at focused-view detail.');
