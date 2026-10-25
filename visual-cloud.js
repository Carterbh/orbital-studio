'use strict';
// Density contours are calculated once in hydrogenic coordinates, then scaled
// by effective nuclear charge at draw time. They are display surfaces, not walls.
const OrbitalVisual = (() => {
  const M=typeof OrbitalModel!=='undefined'?OrbitalModel:require('./elements.js');
  const cache=new Map();
  const tetrahedra=[[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];
  const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  function amplitude(o,x,y,z) {
    const r=Math.hypot(x,y,z);
    const angular=o.m==='all'?Math.sqrt((2*o.l+1)/(4*Math.PI)):M.angular(o.l,o.m,r?z/r:1,Math.atan2(y,x));
    return M.radialValue(o.n,o.l,r)*angular;
  }
  function simplify(faces,extent,resolution) {
    // Merge tetrahedron subdivisions into shared, curved surface vertices.
    // The same warped grid keeps inner shells from collapsing into the core.
    const vertices=[],bins=new Map(),indices=[];
    for(let i=0;i<faces.length;i+=13)for(const j of [0,3,6]) {
      const p=faces.slice(i+j,i+j+3),sign=faces[i+12];
      const key=p.map(x=>Math.round(Math.sign(x)*Math.abs(x/extent)**(2/3)*resolution/2)).join('/')+'/'+sign;
      let id=bins.get(key);
      if(id===undefined){id=vertices.length;bins.set(key,id);vertices.push([0,0,0,0]);}
      const v=vertices[id];for(let k=0;k<3;k++)v[k]+=p[k];v[3]++;indices.push(id);
    }
    for(const v of vertices)for(let k=0;k<3;k++)v[k]/=v[3];
    const output=[],triangles=[],seen=new Set();
    for(let i=0;i<indices.length;i+=3) {
      const ids=indices.slice(i,i+3);if(new Set(ids).size<3)continue;
      const key=[...ids].sort((a,b)=>a-b).join('/');if(seen.has(key))continue;seen.add(key);
      const [a,b,c]=ids.map(id=>vertices[id].slice(0,3));
      const u=b.map((x,k)=>x-a[k]),v=c.map((x,k)=>x-a[k]);
      const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal);
      if(length<1e-14)continue;
      output.push(...a,...b,...c,...normal.map(x=>x/length),faces[i/3*13+12]);
      triangles.push(...ids);
    }
    return {faces:new Float32Array(output),vertices:new Float32Array(vertices.flatMap(v=>v.slice(0,3))),indices:new Uint32Array(triangles)};
  }
  function surface(o,resolution=28) {
    const key=`${o.n}/${o.l}/${o.m}/${resolution}`;
    if(cache.has(key))return cache.get(key);
    const extent=M.radialDistribution(o.n,o.l).extent;
    const size=resolution+1,index=(x,y,z)=>(x*size+y)*size+z;
    // A nonuniform grid resolves the compact core as well as outer radial lobes.
    const axis=Array.from({length:size},(_,i)=>{
      const u=2*i/resolution-1;return extent*Math.sign(u)*Math.abs(u)**1.5;
    });
    const values=new Float64Array(size**3),cells=[];
    for(let x=0;x<size;x++)for(let y=0;y<size;y++)for(let z=0;z<size;z++)
      values[index(x,y,z)]=amplitude(o,axis[x],axis[y],axis[z])**2;
    let mass=0;
    for(let x=0;x<resolution;x++)for(let y=0;y<resolution;y++)for(let z=0;z<resolution;z++) {
      const a=amplitude(o,(axis[x]+axis[x+1])/2,(axis[y]+axis[y+1])/2,(axis[z]+axis[z+1])/2);
      const density=a*a,weight=density*(axis[x+1]-axis[x])*(axis[y+1]-axis[y])*(axis[z+1]-axis[z]);
      cells.push([density,weight]);mass+=weight;
    }
    cells.sort((a,b)=>b[0]-a[0]);
    const levels=[.88,.60].map(fraction=>{
      let sum=0;for(const [density,weight] of cells){sum+=weight;if(sum>=fraction*mass)return density;}
      return cells.at(-1)[0];
    });
    const layers=levels.map((level,layer)=>{
      const faces=[];
      for(let x=0;x<resolution;x++)for(let y=0;y<resolution;y++)for(let z=0;z<resolution;z++) {
        const corners=Array.from({length:8},(_,i)=>{
          const ix=x+(i&1),iy=y+((i>>1)&1),iz=z+((i>>2)&1);
          return [axis[ix],axis[iy],axis[iz],values[index(ix,iy,iz)]];
        });
        if(corners.every(p=>p[3]<level)||corners.every(p=>p[3]>=level))continue;
        for(const tetra of tetrahedra) {
          const points=[];
          for(const [i,j] of edges) {
            const a=corners[tetra[i]],b=corners[tetra[j]];
            if((a[3]>=level)===(b[3]>=level))continue;
            const t=(level-a[3])/(b[3]-a[3]);
            points.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])]);
          }
          if(points.length<3)continue;
          // Order the intersection polygon on its plane (a quad has four edges).
          const center=[0,1,2].map(k=>points.reduce((sum,p)=>sum+p[k],0)/points.length);
          const u=points[0].map((v,k)=>v-center[k]);
          const v=points[1].map((v,k)=>v-center[k]);
          const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
          const length=Math.hypot(...normal);if(length<1e-14)continue;
          for(let k=0;k<3;k++)normal[k]/=length;
          const tangent=[normal[1]*u[2]-normal[2]*u[1],normal[2]*u[0]-normal[0]*u[2],normal[0]*u[1]-normal[1]*u[0]];
          const angle=p=>Math.atan2(p.reduce((sum,x,k)=>sum+(x-center[k])*tangent[k],0),p.reduce((sum,x,k)=>sum+(x-center[k])*u[k],0));
          points.sort((a,b)=>angle(a)-angle(b));
          const sign=amplitude(o,...center)>=0?1:0;
          for(let i=1;i<points.length-1;i++)faces.push(...points[0],...points[i],...points[i+1],...normal,sign);
        }
      }
      return {fraction:layer===0?.88:.60,level,...simplify(faces,extent,resolution)};
    });
    const result={extent,layers,resolution};
    if(cache.size>=96)cache.delete(cache.keys().next().value);
    cache.set(key,result);return result;
  }
  return {amplitude,surface};
})();
if(typeof module!=='undefined')module.exports=OrbitalVisual;
