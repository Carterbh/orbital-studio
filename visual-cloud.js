'use strict';
// Density contours are calculated once in hydrogenic coordinates, then scaled
// by effective nuclear charge at draw time. They are display surfaces, not walls.
const OrbitalVisual = (() => {
  const M=typeof OrbitalModel!=='undefined'?OrbitalModel:require('./elements.js');
  const cache=new Map();
  const volumes=new Map();
  const tetrahedra=[[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];
  const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  function amplitude(o,x,y,z) {
    const r=Math.hypot(x,y,z);
    const angular=M.angular(o.l,o.m,r?z/r:1,Math.atan2(y,x));
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
  function volume(o) {
    const key=`${o.n}/${o.l}/${o.m}`;
    if(volumes.has(key))return volumes.get(key);
    const size=o.n>=4?65:41,extent=M.radialDistribution(o.n,o.l).extent,data=new Float32Array(size**3);
    let peak=0;
    for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const px=2*x/(size-1)-1,py=2*y/(size-1)-1,pz=2*z/(size-1)-1;
      const a=px*px+py*py+pz*pz<=1?amplitude(o,px*extent,py*extent,pz*extent):0;
      data[(z*size+y)*size+x]=a;peak=Math.max(peak,Math.abs(a));
    }
    // Normalize exposure once, independently of occupancy and camera direction.
    const columns=[new Float64Array(size*size),new Float64Array(size*size),new Float64Array(size*size)];
    for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const index=(z*size+y)*size+x;data[index]/=peak||1;const density=data[index]**2;
      columns[0][y*size+x]+=density;columns[1][z*size+x]+=density;columns[2][z*size+y]+=density;
    }
    let columnPeak=0;for(const column of columns)for(const value of column)columnPeak=Math.max(columnPeak,value);
    const result={size,extent,data,exposure:2.4/(columnPeak*2/(size-1)||1)};
    if(volumes.size>=64)volumes.delete(volumes.keys().next().value);
    volumes.set(key,result);return result;
  }
  function field(grid,x,y,z) {
    if(Math.abs(x)>1||Math.abs(y)>1||Math.abs(z)>1)return 0;
    const n=grid.size,s=n-1,xx=(x+1)*s/2,yy=(y+1)*s/2,zz=(z+1)*s/2;
    const ix=Math.min(n-2,Math.floor(xx)),iy=Math.min(n-2,Math.floor(yy)),iz=Math.min(n-2,Math.floor(zz));
    const fx=xx-ix,fy=yy-iy,fz=zz-iz,d=grid.data,i=(iz*n+iy)*n+ix;
    const a=d[i]*(1-fx)+d[i+1]*fx,b=d[i+n]*(1-fx)+d[i+n+1]*fx;
    const c=d[i+n*n]*(1-fx)+d[i+n*n+1]*fx,e=d[i+n*n+n]*(1-fx)+d[i+n*n+n+1]*fx;
    return (a*(1-fy)+b*fy)*(1-fz)+(c*(1-fy)+e*fy)*fz;
  }
  function projectVolume(o,{width,height,scale,yaw,pitch,lens=false,cut='none',slice=1,phase=false,color=[255,220,110],maxSize=144,raySteps=o.n>=4?128:64}) {
    const grid=volume(o),physicalExtent=grid.extent/(o.charge||1);
    const displayExtent=lens?Math.log1p(physicalExtent):physicalExtent,radius=displayExtent*scale;
    const left=Math.max(0,width/2-radius),top=Math.max(0,height/2-radius);
    const screenWidth=Math.min(width,width/2+radius)-left,screenHeight=Math.min(height,height/2+radius)-top;
    const downscale=Math.min(1,maxSize/Math.max(screenWidth,screenHeight));
    const w=Math.max(2,Math.ceil(screenWidth*downscale)),h=Math.max(2,Math.ceil(screenHeight*downscale));
    const pixels=new Uint8ClampedArray(w*h*4),cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const u=(left+(x+.5)*screenWidth/w-width/2)/radius,v=-(top+(y+.5)*screenHeight/h-height/2)/radius;
      const rr=u*u+v*v;if(rr>=1)continue;
      const half=Math.sqrt(1-rr),steps=raySteps,step=2*half/steps;let positive=0,negative=0;
      for(let j=0;j<steps;j++) {
        const depth=-half+(j+.5)*step,yy=v*cp+depth*sp,zz=-v*sp+depth*cp;
        let px=u*cy-zz*sy,py=yy,pz=u*sy+zz*cy;
        if(lens){const r=Math.sqrt(rr+depth*depth),factor=r?Math.expm1(r*displayExtent)/(r*physicalExtent):displayExtent/physicalExtent;px*=factor;py*=factor;pz*=factor;}
        if((cut==='half'&&pz>0)||(cut==='slice'&&Math.abs(pz*physicalExtent)>slice))continue;
        const a=field(grid,px,py,pz);if(a>=0)positive+=a*a;else negative+=a*a;
      }
      const sum=positive+negative;if(!sum)continue;
      const density=1-Math.exp(-sum*step*grid.exposure*o.occupancy);
      // An S-curve separates dim gaps from bright bands without clipping either.
      const opacity=density**3.5/(density**3.5+(1-density)**3.5),offset=(y*w+x)*4;
      const tint=phase?[96,234,214].map((c,k)=>(c*positive+[175,138,255][k]*negative)/sum):color;
      for(let k=0;k<3;k++)pixels[offset+k]=tint[k]+(255-tint[k])*opacity**4*.1;
      pixels[offset+3]=255*opacity*.995;
    }
    return {width:w,height:h,left,top,screenWidth,screenHeight,pixels};
  }
  // Integrate all fields into shared depth bins. Front density absorbs the
  // light behind it, so drawing order cannot put the core over an outer lobe.
  function projectCloud(orbitals,{width,height,scale,yaw,pitch,lens=false,cut='none',slice=1,phase=false,maxSize=144,raySteps=64}) {
    const models=orbitals.filter(o=>o.occupancy>0).map(o=>{
      const grid=volume(o),physicalExtent=grid.extent/(o.charge||1);
      return {o,grid,physicalExtent,extent:lens?Math.log1p(physicalExtent):physicalExtent};
    }).sort((a,b)=>a.o.n-b.o.n||a.o.l-b.o.l||a.o.m-b.o.m);
    const extent=Math.max(1e-6,...models.map(m=>m.extent)),radius=extent*scale;
    const left=Math.max(0,width/2-radius),top=Math.max(0,height/2-radius);
    const screenWidth=Math.min(width,width/2+radius)-left,screenHeight=Math.min(height,height/2+radius)-top;
    const downscale=Math.min(1,maxSize/Math.max(screenWidth,screenHeight));
    const w=Math.max(2,Math.ceil(screenWidth*downscale)),h=Math.max(2,Math.ceil(screenHeight*downscale));
    const pixels=new Uint8ClampedArray(w*h*4),cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const bins=raySteps*2,tau=new Float64Array(bins),red=new Float64Array(bins),green=new Float64Array(bins),blue=new Float64Array(bins);
    const values=new Float64Array(raySteps),depths=new Uint16Array(raySteps);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const u=(left+(x+.5)*screenWidth/w-width/2)/scale,v=-(top+(y+.5)*screenHeight/h-height/2)/scale;
      const rr=u*u+v*v;if(rr>=extent*extent)continue;
      tau.fill(0);red.fill(0);green.fill(0);blue.fill(0);
      for(const model of models) {
        const {o,grid,physicalExtent,extent:localExtent}=model;
        if(rr>=localExtent*localExtent)continue;
        const half=Math.sqrt(localExtent*localExtent-rr),step=2*half/raySteps;
        let sum=0;
        for(let j=0;j<raySteps;j++) {
          const depth=-half+(j+.5)*step,yy=v*cp+depth*sp,zz=-v*sp+depth*cp;
          let px=u*cy-zz*sy,py=yy,pz=u*sy+zz*cy;
          if(lens){const r=Math.sqrt(rr+depth*depth),factor=r?Math.expm1(r)/r:1;px*=factor;py*=factor;pz*=factor;}
          const a=(cut==='half'&&pz>0)||(cut==='slice'&&Math.abs(pz)>slice)?0:field(grid,px/physicalExtent,py/physicalExtent,pz/physicalExtent);
          values[j]=Math.sign(a)*a*a;sum+=a*a;
          depths[j]=Math.min(bins-1,Math.max(0,Math.floor((depth/extent+1)*bins/2)));
        }
        if(!sum)continue;
        const density=1-Math.exp(-sum*step/localExtent*grid.exposure*o.occupancy);
        const opacity=.995*density**3.5/(density**3.5+(1-density)**3.5);
        // Stronger depth absorption makes overlapping dense fields read as
        // volumes while preserving transparent nodal gaps.
        const weight=-3*Math.log1p(-opacity)/sum;
        for(let j=0;j<raySteps;j++) {
          const amount=Math.abs(values[j])*weight;if(!amount)continue;
          const i=depths[j],color=phase?(values[j]>=0?[96,234,214]:[175,138,255]):o.visualColor;
          tau[i]+=amount;red[i]+=amount*color[0];green[i]+=amount*color[1];blue[i]+=amount*color[2];
        }
      }
      let transmission=1,r=0,g=0,b=0;
      // Positive camera depth is nearest to the viewer.
      for(let i=bins-1;i>=0&&transmission>.001;i--)if(tau[i]) {
        const alpha=-Math.expm1(-tau[i]),weight=transmission*alpha/tau[i];
        r+=red[i]*weight;g+=green[i]*weight;b+=blue[i]*weight;transmission*=1-alpha;
      }
      const alpha=1-transmission,offset=(y*w+x)*4;
      if(alpha){pixels[offset]=r/alpha;pixels[offset+1]=g/alpha;pixels[offset+2]=b/alpha;pixels[offset+3]=alpha*255;}
    }
    return {width:w,height:h,left,top,screenWidth,screenHeight,pixels};
  }
  return {amplitude,surface,volume,field,projectVolume,projectCloud};
})();
if(typeof module!=='undefined')module.exports=OrbitalVisual;
