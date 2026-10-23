'use strict';
const assert=require('node:assert/strict');
const M=require('./elements.js');
assert.equal(M.elements.length,118);
const cells=new Set();
for(const e of M.elements){
  assert.match(e.weight,/^(?:\d+(?:\.\d+)?|\[\d+\])$/,e.symbol+' atomic weight');
  assert.equal(e.config.reduce((sum,s)=>sum+s.electrons,0),e.z,e.symbol+' electron total');
  assert.ok(!cells.has(`${e.row},${e.col}`),'unique table position');cells.add(`${e.row},${e.col}`);
  assert.ok(e.col>=1&&e.col<=18);
  for(const s of e.config)assert.ok(s.electrons>0&&s.electrons<=2*(2*s.l+1));
  const orbitals=M.atomOrbitals(e);
  assert.equal(orbitals.reduce((sum,o)=>sum+o.occupancy,0),e.z);
  for(const count of [6000,14000,26000]){
    const sizes=M.allocations(orbitals,count);
    assert.equal(sizes.reduce((a,b)=>a+b,0),count);
    sizes.forEach((size,i)=>{if(!orbitals[i].occupancy)assert.equal(size,0);});
  }
  const extent=M.mixtureExtent(orbitals);
  const enclosed=orbitals.reduce((s,o)=>s+o.occupancy*M.probability(o,extent,true),0)/e.z;
  assert.ok(Math.abs(enclosed-.995)<1e-8,'mixture radius');
  for(const o of orbitals){
    assert.ok(o.charge>=1&&Number.isFinite(o.charge));
    assert.ok(M.sample(o).slice(0,3).every(Number.isFinite));
  }
}
const expected={24:'[Ar] 3d⁵ 4s¹',29:'[Ar] 3d¹⁰ 4s¹',46:'[Kr] 4d¹⁰',58:'[Xe] 4f¹ 5d¹ 6s²',
  78:'[Xe] 4f¹⁴ 5d⁹ 6s¹',92:'[Rn] 5f³ 6d¹ 7s²',103:'[Rn] 5f¹⁴ 7s² 7p¹',
  110:'[Rn] 5f¹⁴ 6d⁹ 7s¹',111:'[Rn] 5f¹⁴ 6d¹⁰ 7s¹',118:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶'};
for(const [z,text] of Object.entries(expected))assert.equal(M.configText(M.elements[z-1]),text);
for(const [z,weight] of [[1,'1.0080'],[26,'55.845'],[40,'91.222'],[43,'[97]'],[61,'[145]'],[92,'238.03'],[118,'[294]']])
  assert.equal(M.elements[z-1].weight,weight);
assert.deepEqual(M.atomOrbitals(M.elements[5]).filter(o=>o.key==='2p').map(o=>o.occupancy),[1,1,0]);
assert.deepEqual(M.atomOrbitals(M.elements[7]).filter(o=>o.key==='2p').map(o=>o.occupancy),[2,1,1]);
const empty=M.atomOrbitals(M.elements[4]).find(o=>o.occupancy===0);
assert.deepEqual(M.allocations([empty],6000),[0]);
// Every allowed free orbital: normalized angular density, node count, finite samples.
for(let n=1;n<=7;n++)for(let l=0;l<n;l++){
  const d=M.radialDistribution(n,l);
  assert.equal(d.roots.length,n-l-1,`${n}${M.letters[l]} nodes`);
  for(const m of M.components(l)){
    let integral=0;
    for(let i=0;i<200;i++)for(let j=0;j<64;j++)integral+=M.angular(l,m,-1+(i+.5)/100,2*Math.PI*j/64)**2*2/200*2*Math.PI/64;
    assert.ok(Math.abs(integral-1)<.003,`${n},${l},${m} angular normalization: ${integral}`);
    assert.ok(M.sample({n,l,m,charge:1}).slice(0,3).every(Number.isFinite));
  }
}
// Analytic hydrogen 1s: mean radius 1.5 a0 and radial node for 2s at 2 a0.
const h=M.radialDistribution(1,0);
assert.ok(Math.abs(h.rows.reduce((sum,r)=>sum+r[0]*r[2]*h.step,0)-1.5)<.01);
assert.ok(Math.abs(M.radialDistribution(2,0).roots[0]-2)<1e-6);
console.log('PASS: all 118 configurations and budgets, occupancy, exception fixtures, mixture radii, all 140 free orbitals, and hydrogen analytic checks.');
