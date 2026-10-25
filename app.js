'use strict';
const $=id=>document.getElementById(id), M=OrbitalModel;
const canvas=$('scene'), ctx=canvas.getContext('2d');
const MAX_ZOOM=300;
const visualMode=()=>$('count').value==='visual'&&!$('single').checked;
const state={selected:7,active:7,atom:true,n:2,l:1,m:1,sublevel:'all',orbital:'all',
  yaw:.55,pitch:.25,zoom:1,drag:null,extent:1,orbitals:[],groups:[],roots:[],lastRefresh:0,dirty:true};
const activeElement=()=>M.elements[state.active-1];
// Display in Aufbau (n + l, then n) order without changing actual occupancies.
const aufbauCompare=(a,b)=>(a.n+a.l)-(b.n+b.l)||a.n-b.n;
function fill(el,items,selected) {
  el.replaceChildren(...items.map(([value,text])=>{
    const option=document.createElement('option');option.value=value;option.textContent=text;return option;
  }));
  el.value=selected;
}
function freeOptions() {
  fill($('n'),Array.from({length:7},(_,i)=>[i+1,`n = ${i+1}`]),state.n);
  fill($('l'),Array.from({length:state.n},(_,i)=>[i,`${M.letters[i]} · ℓ = ${i}`]),state.l);
  fill($('m'),M.components(state.l).map(m=>[m,M.label(state.l,m)]),state.m);
}
function pickElement(z,activate=true) {
  state.selected=z;
  const element=M.elements[z-1];
  document.querySelectorAll('.element').forEach(button=>{
    const selected=+button.dataset.z===z;
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',selected);
  });
  $('selected-name').textContent=`${element.name} · ${element.symbol} · ${z} electrons`;
  $('selected-config').textContent=M.configText(element);
  $('selected-weight').textContent=element.weight.startsWith('[')?`Isotope mass number ${element.weight} · no standard atomic weight`:`Atomic weight ${element.weight}`;
  $('selected-note').textContent=element.predicted ? 'Predicted/reference configuration. Superheavy ground states can differ among models.' : 'Neutral ground-state configuration. Explore all sublevels together or isolate an orbital.';
  $('explore-element').textContent='View cloud ↓';
  if(activate){state.active=z;state.atom=true;state.sublevel='all';state.orbital='all';resetToggles();syncMode();generate();}
}
function buildTable() {
  for(let col=1;col<=18;col++) {
    const heading=document.createElement('span');heading.className='group-number';
    heading.style.gridColumn=col+1;heading.style.gridRow=1;heading.textContent=col;
    $('periodic-table').append(heading);
  }
  for(let period=1;period<=7;period++) {
    const heading=document.createElement('span');heading.className='period-number';
    heading.style.gridColumn=1;heading.style.gridRow=period+1;heading.textContent=period;
    heading.title=`Period ${period}`;$('periodic-table').append(heading);
  }
  for(const e of M.elements) {
    const button=document.createElement('button');button.className=`element block-${e.block}`;
    button.style.gridColumn=e.col+1;button.style.gridRow=e.row+1;button.dataset.z=e.z;
    button.innerHTML=`<small class="element-number">${e.z}</small><b class="element-symbol">${e.symbol}</b><span class="element-name">${e.name}</span><span class="element-weight">${e.weight}</span>`;
    const massLabel=e.weight.startsWith('[')?`isotope mass number ${e.weight}`:`atomic weight ${e.weight}`;
    button.title=`${e.name} (${e.z}) · ${massLabel}`;button.setAttribute('aria-label',`${e.name}, ${e.symbol}, atomic number ${e.z}, ${massLabel}`);
    button.onclick=()=>pickElement(e.z);$('periodic-table').append(button);
  }
  for(const [row,text] of [[7,'57–71 ↙'],[8,'89–103 ↙'],[10,'Lanthanides'],[11,'Actinides']]) {
    const tag=document.createElement('span');tag.className=row<9?'series-label series-placeholder':'series-label';tag.textContent=text;
    tag.style.gridRow=row;tag.style.gridColumn=row<9?'4':'2 / 5';$('periodic-table').append(tag);
  }
  pickElement(state.selected,false);
}
function updateSearch() {
  const query=$('element-search').value.trim().toLowerCase();
  let found=0,first=null;
  for(const button of document.querySelectorAll('.element')) {
    const e=M.elements[+button.dataset.z-1];
    const aliases=e.z===13?' aluminum':e.z===55?' cesium':'';
    const match=!query || (e.name.toLowerCase()+aliases).includes(query) || e.symbol.toLowerCase()===query || String(e.z)===query;
    button.classList.toggle('filtered',!match);button.disabled=!match;
    if(match) {found++;first??=e.z;}
  }
  $('search-status').textContent=query?`${found} matching element${found===1?'':'s'}`:'';
  return first;
}
function syncMode() {
  $('mode').value=state.atom?'atom':'free';
  $('atom-controls').hidden=!state.atom;$('free-controls').hidden=state.atom;
  $('phase-caption').textContent=state.atom?'Color wavefunction signs (off = sublevels)':'Color wavefunction signs';
  freeOptions();
}
const orbitalId=o=>`${o.key}:${o.m}`;
function resetToggles() {
  state.toggleElement=state.active;
  state.enabledSublevels=new Set(activeElement().config.map(s=>s.key));
  state.enabledOrbitals=new Set(M.atomOrbitals(activeElement()).map(orbitalId));
}
function setFocus(sublevel,orbital='all') {
  resetToggles();
  if(sublevel!=='all'){
    state.enabledSublevels=new Set([sublevel]);
    if(orbital!=='all')state.enabledOrbitals=new Set([`${sublevel}:${orbital}`]);
  }
  state.atom=true;state.sublevel=sublevel;state.orbital=String(orbital);syncMode();generate(true);
}
function toggleSelection(set,key) {
  set.has(key)?set.delete(key):set.add(key);
  state.atom=true;state.sublevel='custom';state.orbital='all';syncMode();generate(true);
}
function explore() {
  $('workspace').scrollIntoView({behavior:'smooth',block:'start',inline:'nearest'});
}
function choose(n,l,m) {
  Object.assign(state,{atom:false,n,l,m});syncMode();generate();
}
function currentOrbitals() {
  if(!state.atom) return [{n:state.n,l:state.l,m:state.m,key:state.n+M.letters[state.l],occupancy:1,charge:1,color:'#85d8fa'}];
  return state.atomCache.orbitals.filter(o=>
    state.enabledSublevels.has(o.key)&&state.enabledOrbitals.has(orbitalId(o)));
}
function makeGroups(orbitals) {
  const single=$('single').checked,total=orbitals.reduce((sum,o)=>sum+o.occupancy,0);
  const budget=$('count').value==='visual'?6000:+$('count').value,perElectron=Math.max(1,Math.round(budget/10));
  // Fixed samples per electron for light atoms, capped for heavy atoms. Each
  // retained sample carries its electron-density weight once the cap is reached.
  const count=state.atom?Math.min(budget,total*perElectron):budget;
  const allocations=single?orbitals.map(o=>o.occupancy):visualMode()?orbitals.map(()=>0):M.allocations(orbitals,count);
  return orbitals.map((orbital,i)=>({orbital,cursor:0,
    sampleWeight:!single&&state.atom&&count?total*perElectron/count:1,
    points:Array.from({length:allocations[i]},()=>M.sample(orbital))}));
}
function generate(reuseAtom=false) {
  if(state.atom){
    if(state.toggleElement!==state.active)resetToggles();
    const key=`${state.active}/${$('count').value}/${$('single').checked}`;
    if(reuseAtom!==true||state.atomCache?.key!==key){
      const orbitals=M.atomOrbitals(activeElement());
      state.atomCache={key,orbitals,groups:makeGroups(orbitals),extent:M.mixtureExtent(orbitals)};
    }
  }
  state.orbitals=currentOrbitals();
  state.empty=state.atom && state.orbitals.every(o=>o.occupancy===0);
  $('count').disabled=$('single').checked;
  $('emphasize').disabled=$('single').checked;
  $('live').disabled=visualMode();$('interval').disabled=visualMode();
  $('sample').textContent=visualMode()?'Redraw cloud':'Resample cloud';
  $('emphasis-help').textContent=visualMode()?
    'Shape the glow into translucent density surfaces. Nested regions show the denser parts of each orbital; they are probability contours, not hard boundaries.':
    'Strongly brightens dense lobe interiors and suppresses sparse haze to reveal orbital structure. Visual emphasis only; positions and the radial graph stay unchanged. Available in cloud mode.';
  $('visual-help').hidden=!visualMode();
  $('resampling-help').textContent=visualMode()?
    'Visual cloud shows a continuous orbital field, so it stays steady without resampling. Rotate or zoom to explore it. Numeric sample budgets and electron dots still support continuous resampling.':
    'Refreshes a quarter of the visible cloud each interval, or every electron dot in electron dot mode. Samples are independent possible positions, not moving electrons.';
  state.groups=state.atom?state.atomCache.groups.filter(g=>state.orbitals.includes(g.orbital)):makeGroups(state.orbitals);
  if($('single').checked)state.groups=state.groups.filter(g=>g.points.length);
  state.extent=state.empty?1:M.mixtureExtent(state.orbitals);
  // Keep small atoms on a common scale and preserve the whole-atom scale on focus.
  state.viewExtent=state.atom?Math.max(8,state.atomCache.extent):state.extent;
  if(visualMode()&&state.atom&&state.active>=5&&state.active<=10)state.viewExtent=8;
  const sameSublevel=new Set(state.orbitals.map(o=>o.key)).size===1;
  const first=state.orbitals[0];
  state.roots=sameSublevel&&!state.empty?M.radialDistribution(first.n,first.l).roots.map(r=>r/first.charge):[];
  state.lastRefresh=performance.now();state.dirty=true;
  describe();drawBoxes();plot();
}
function describe() {
  const element=activeElement(), first=state.orbitals[0];
  const electrons=state.orbitals.reduce((sum,o)=>sum+o.occupancy,0), empty=state.atom && !electrons;
  const sublevels=new Set(state.orbitals.map(o=>o.key)).size;
  const none=state.atom&&!state.orbitals.length;
  const focus=none?'all orbitals hidden':state.sublevel==='custom'?`${state.orbitals.length} orbitals shown`:state.sublevel==='all'?'all sublevels':state.orbital==='all'?state.sublevel:first.n+M.label(first.l,first.m);
  $('title').textContent=state.atom?`${element.name} · ${focus}`:state.n+M.label(state.l,state.m);
  const sampleCount=state.groups.reduce((sum,g)=>sum+g.points.length,0);
  $('status').textContent=`${sampleCount.toLocaleString()} ${$('single').checked?'electron dot':'probability sample'}${sampleCount===1?'':'s'} · ${none?'all orbitals hidden':empty?'empty orbital · 0 electrons':$('single').checked?'one dot per electron':state.atom?electrons+' electrons represented':'one-electron orbital'}${state.atom&&element.predicted?' · predicted configuration':''}`;
  if(visualMode())$('status').textContent=`Visual cloud · ${$('emphasize').checked?'translucent density regions':'soft probability glow'} · ${electrons} electron${electrons===1?'':'s'} represented`;
  $('density-intro').textContent=visualMode()?
    'Opacity represents electron probability density. The soft view integrates a continuous density field through each orbital; it contains no point samples. Emphasized regions show nested density contours containing approximately 88% and 60% of each orbital density on a coarse 3D grid. Opacity also reflects orbital occupancy. These surfaces are not solid boundaries; the electron can be found outside them.':
    'Each dot is a possible position sampled from |ψ|². Dense regions mean higher probability per volume. The dots are not electron paths. In element mode, colors identify sublevels. Wavefunction signs show phase, not electric charge.';
  const stats=state.atom ? [
    [electrons,'Electrons in this view'],[sublevels,'Sublevels in this view'],
    [state.orbitals.filter(o=>o.occupancy).length,'Occupied orbitals'],[empty?'—':state.extent.toFixed(2)+' a₀','Model radius enclosing ≈99.5%']
  ] : [[state.n-state.l-1,'Radial nodes'],[state.l,'Angular nodes'],[2*state.l+1,'Orbitals in this sublevel'],[state.extent.toFixed(1)+' a₀','Radius enclosing ≈99.5%']];
  $('stats').innerHTML=stats.map(([value,text])=>`<div class="stat"><b>${value}</b>${text}</div>`).join('');
  $('explanation').textContent=state.atom ? (none?'No orbitals pass both switches. Turn on a sublevel and one of its orbitals, or use All sublevels on.':empty?
    'This orbital contains 0 electrons in the selected ground-state teaching arrangement. Its probability cloud and radial graph are empty.':
    `The visible density combines ${electrons} electrons across ${sublevels} sublevel${sublevels===1?'':'s'}. Each occupied orbital contributes in proportion to its occupancy (one or two electrons). All clouds overlap at the same nucleus. Sizes use an approximate screened hydrogen-like model.`) :
    `This ${state.n}${M.letters[state.l]} orbital has ${state.n-state.l-1} radial nodes and ${state.l} angular nodes (${state.n-1} total). A node is a surface where the wavefunction is zero. Rotate to see its angular structure.`;
  $('view-note').textContent=state.atom&&$('core-lens').checked?
    'Core expansion is on: log(1 + r/a₀) stretches inner shells. Distances in the cloud are distorted; the radial chart and radius statistic retain physical model units.':
    state.atom?'Sizes use the Bohr radius a₀ (≈ 0.0529 nm). Sublevels and individual orbitals retain the whole-atom camera scale and sample allocation. Small atoms share an 8 a₀ viewing scale; larger atoms fit as a whole. The radius statistic describes the selected density.':
    'Sizes use the Bohr radius a₀ (≈ 0.0529 nm). Free orbitals automatically fit the view. The nucleus is exaggerated. Finite samples can miss small inner features.';
  $('plot-note').textContent=none?'All orbitals are hidden.':empty?'No electrons in the enabled orbitals.':state.atom?`Occupancy-weighted radial probability · physical radius in a₀${sublevels===1?' · dashed lines mark radial nodes':' · focus a sublevel to see node guides'}`:'P(r) = r²|R(r)|² · dashed lines mark radial nodes';
  if(visualMode()&&state.atom&&state.active>=5&&state.active<=10)
    $('view-note').textContent+=' Visual cloud uses shared orbital sizes from boron through neon; filling changes opacity. The radial chart and radius statistic retain the element-specific model.';
  updateLegend();
}
function updateLegend() {
  const legend=$('legend');legend.replaceChildren();
  if(state.empty)return;
  const add=(text,color)=>{const span=document.createElement('span');span.textContent=text;span.style.color=color;legend.append(span);};
  if($('phase').checked) {add('● ψ positive','#60ead6');add('● ψ negative','#af8aff');}
  if(state.atom) {
    const sublevels=new Map();
    for(const orbital of state.orbitals){
      if(!sublevels.has(orbital.key))sublevels.set(orbital.key,{...orbital,electrons:0});
      sublevels.get(orbital.key).electrons+=orbital.occupancy;
    }
    for(const s of [...sublevels.values()].sort(aufbauCompare))
      add(`${$('phase').checked?'':'● '}${s.key} · ${s.electrons} e⁻`,$('phase').checked?'#b9c9d7':visualMode()?visualColor(s):s.color);
  } else if(!$('phase').checked)add(visualMode()?'● probability density':'● probability samples',visualMode()?visualColor(state.orbitals[0]):'#85d8fa');
  if(state.roots.length && $('nodes').checked)add('○ radial node','#a7c6dc');
  if($('emphasize').checked&&!$('single').checked)add(visualMode()?'Nested density regions':'Density contrast enhanced','#e6c786');
}
function drawBoxes() {
  const element=activeElement();
  $('occupancy-title').textContent=`${element.name} · ${element.z} electrons`;
  $('occupancy-config').textContent=`${element.predicted?'Reference prediction':'Ground-state filling'}: ${M.configText(element)}.`;
  $('all-orbitals').setAttribute('aria-pressed',state.atom&&state.enabledSublevels.size===element.config.length&&state.enabledOrbitals.size===M.atomOrbitals(element).length);
  $('all-sublevels-off').setAttribute('aria-pressed',state.atom&&state.enabledSublevels.size===0);
  $('boxes').replaceChildren();
  for(const s of [...element.config].sort(aufbauCompare)) {
    const group=document.createElement('div');group.className='boxgroup';
    const sublevelOn=state.enabledSublevels.has(s.key);
    group.classList.toggle('sublevel-off',!sublevelOn);
    const title=document.createElement('button');title.className='sublevel-button';title.textContent=`${s.key} · ${s.electrons} e⁻`;
    title.title=`${s.key} sublevel ${sublevelOn?'on':'off'} — click to toggle`;
    title.onclick=()=>toggleSelection(state.enabledSublevels,s.key);
    title.setAttribute('aria-label',`Toggle ${s.key} sublevel`);
    title.setAttribute('aria-pressed',sublevelOn);
    group.append(title);
    const row=document.createElement('div');row.className='orbital-row';
    M.components(s.l).forEach((m,i)=>{
      const occupied=M.occupancy(s.electrons,s.l,i),button=document.createElement('button');
      button.textContent=occupied===2?'↑↓':occupied===1?'↑':'—';
      button.className=occupied?'':'empty';
      const focused=state.enabledOrbitals.has(`${s.key}:${m}`);
      button.classList.toggle('active',focused);button.setAttribute('aria-pressed',focused);
      const description=`${s.n}${M.label(s.l,m)}: ${occupied} electron${occupied===1?'':'s'}`;
      button.title=`${description} · ${focused?'on':'off'}${focused&&!sublevelOn?' (hidden: sublevel off)':''}`;button.setAttribute('aria-label',description);
      button.onclick=()=>toggleSelection(state.enabledOrbitals,`${s.key}:${m}`);row.append(button);
    });
    group.append(row);
    $('boxes').append(group);
  }
}
function plot() {
  const c=$('plot'),g=c.getContext('2d'),w=c.width,h=c.height,maxR=(state.atom?state.atomCache.extent:state.extent)*1.15;
  g.clearRect(0,0,w,h);
  if(state.empty)return;
  const total=state.atom?activeElement().z:1;
  // Dense samples near the origin resolve tight cores; x coordinates stay linear.
  const data=Array.from({length:1500},(_,i)=>{
    const r=maxR*(i/1499)**3;
    return [r,state.orbitals.reduce((sum,o)=>sum+(total?o.occupancy:1)*M.probability(o,r),0)/(total||1)];
  });
  const peak=state.atom?(state.atomCache.plotPeak??=state.sublevel==='all'?Math.max(...data.map(p=>p[1])):
    Math.max(...data.map(([r])=>state.atomCache.orbitals.reduce((sum,o)=>sum+o.occupancy*M.probability(o,r),0)/total))):Math.max(...data.map(p=>p[1]));
  g.clearRect(0,0,w,h);g.strokeStyle='#344958';g.beginPath();g.moveTo(35,10);g.lineTo(35,145);g.lineTo(w-10,145);g.stroke();
  g.strokeStyle='#69dfce';g.beginPath();
  data.forEach(([r,p],i)=>{const x=35+r/maxR*(w-50),y=145-120*p/peak;i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();
  g.setLineDash([3,4]);g.strokeStyle='#ac8cf7';
  for(const r of state.roots) {const x=35+r/maxR*(w-50);g.beginPath();g.moveTo(x,15);g.lineTo(x,145);g.stroke();}
  g.setLineDash([]);g.fillStyle='#91aabd';g.font='12px Segoe UI';g.fillText('0',30,165);g.fillText(maxR.toFixed(2)+' a₀',w-80,165);g.fillText('P(r)',2,15);
}
function project(x,y,z,w,h) {
  const lens=state.atom&&$('core-lens').checked;
  if(lens) {const r=Math.hypot(x,y,z),f=r?Math.log1p(r)/r:1;x*=f;y*=f;z*=f;}
  const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
  const xx=x*cy+z*sy,zz=-x*sy+z*cy,yy=y*cp-zz*sp;
  const scale=Math.min(w,h)*.36*state.zoom/(lens?Math.log1p(state.viewExtent):state.viewExtent);
  return [w/2+xx*scale,h/2-yy*scale,y*sp+zz*cp];
}
function line3(points,w,h,color) {
  ctx.strokeStyle=color;ctx.beginPath();
  points.forEach((p,i)=>{const q=project(...p,w,h);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.stroke();
}
function densityLayers(group) {
  if(group.emphasisLayers)return group.emphasisLayers;
  const densities=group.points.map(p=>p[5]).sort((a,b)=>a-b);
  // Scale each orbital separately so outer shells retain visible structure.
  // Stronger contrast suppresses low-density haze and lifts the lobe interiors.
  const reference=densities[Math.floor(densities.length*.85)]||1;
  const layers=Array.from({length:12},(_,i)=>({alpha:.004+.996*(i/11)**1.35,points:[]}));
  for(const p of group.points) {
    const strength=Math.min(1,p[5]/reference)**1.3;
    layers[Math.min(11,Math.floor(strength*12))].points.push(p);
  }
  group.emphasisLayers=layers;
  return layers;
}
const visualPalette=[[255,221,115],[96,181,255],[185,139,255],[255,143,198],[124,233,178],[255,174,116],[163,187,255]];
const visualColor=o=>'rgb('+visualPalette[o.l].join(',')+')';
const visualReferenceCharges=new Map(M.atomOrbitals(M.elements[5]).map(o=>[o.key,o.charge]));
function visualOrbital(o) {
  return state.atom&&state.active>=5&&state.active<=10?{...o,charge:visualReferenceCharges.get(o.key)}:o;
}
let volumeCanvas;
function drawGlow(w,h) {
  volumeCanvas??=document.createElement('canvas');
  const lens=state.atom&&$('core-lens').checked;
  const scale=Math.min(w,h)*.36*state.zoom/(lens?Math.log1p(state.viewExtent):state.viewExtent);
  ctx.globalCompositeOperation='source-over';
  // Paint broad outer fields first, then the compact core, without washing
  // overlapping yellow and blue fields out to additive white.
  const orbitals=state.groups.map(g=>visualOrbital(g.orbital)).filter(o=>o.occupancy)
    .sort((a,b)=>M.radialDistribution(b.n,b.l).extent/b.charge-M.radialDistribution(a.n,a.l).extent/a.charge);
  for(const o of orbitals) {
    const image=OrbitalVisual.projectVolume(o,{width:w,height:h,scale,yaw:state.yaw,pitch:state.pitch,
      lens,cut:$('cut').value,slice:state.viewExtent*.065,phase:$('phase').checked,color:visualPalette[o.l],
      maxSize:state.groups.length<=3?224:state.groups.length>16?80:144});
    volumeCanvas.width=image.width;volumeCanvas.height=image.height;
    const g=volumeCanvas.getContext('2d'),pixels=g.createImageData(image.width,image.height);
    pixels.data.set(image.pixels);g.putImageData(pixels,0,0);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(volumeCanvas,image.left,image.top,image.screenWidth,image.screenHeight);
  }
  ctx.globalCompositeOperation='source-over';
}
function clipSurface(points,limit,keepBelow) {
  const result=[];
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length],insideA=keepBelow?a[2]<=limit:a[2]>=limit,insideB=keepBelow?b[2]<=limit:b[2]>=limit;
    if(insideA)result.push(a);
    if(insideA!==insideB){const t=(limit-a[2])/(b[2]-a[2]);result.push(a.map((v,k)=>v+t*(b[k]-v)));}
  }
  return result;
}
function drawDensitySurfaces(w,h) {
  const triangles=[],phase=$('phase').checked,cut=$('cut').value;
  // Keep the mesh quality stable when hiding other orbitals.
  const resolution=state.atom?(state.atomCache.orbitals.length>16?12:20):28;
  const groups=state.groups;
  const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
  const lens=state.atom&&$('core-lens').checked;
  const scale=Math.min(w,h)*.36*state.zoom/(lens?Math.log1p(state.viewExtent):state.viewExtent);
  const projectVertex=(x,y,z)=>{
    if(lens){const r=Math.hypot(x,y,z),f=r?Math.log1p(r)/r:1;x*=f;y*=f;z*=f;}
    const xx=x*cy+z*sy,zz=-x*sy+z*cy,yy=y*cp-zz*sp;
    return [w/2+xx*scale,h/2-yy*scale,y*sp+zz*cp];
  };
  for(const group of groups) {
    const o=visualOrbital(group.orbital);if(!o.occupancy)continue;
    const model=OrbitalVisual.surface(o,resolution);
    model.layers.forEach((layer,layerIndex)=>{
      const faces=layer.faces;
      const projected=[];
      if(cut==='none')for(let j=0;j<layer.vertices.length;j+=3)
        projected.push(projectVertex(layer.vertices[j]/o.charge,layer.vertices[j+1]/o.charge,layer.vertices[j+2]/o.charge));
      for(let i=0;i<faces.length;i+=13) {
        let q;
        if(cut==='none'){const j=i/13*3;q=[projected[layer.indices[j]],projected[layer.indices[j+1]],projected[layer.indices[j+2]]];}
        else {
          let points=[0,3,6].map(j=>[faces[i+j]/o.charge,faces[i+j+1]/o.charge,faces[i+j+2]/o.charge]);
          if(cut==='half')points=clipSurface(points,0,true);
          if(cut==='slice'){points=clipSurface(points,state.viewExtent*.065,true);points=clipSurface(points,-state.viewExtent*.065,false);}
          if(points.length<3)continue;
          q=points.map(p=>projectVertex(...p));
        }
        if(q.every(p=>p[0]<0)||q.every(p=>p[0]>w)||q.every(p=>p[1]<0)||q.every(p=>p[1]>h))continue;
        const nx=faces[i+9]*cy+faces[i+11]*sy;
        const nz=-faces[i+9]*sy+faces[i+11]*cy;
        const ny=faces[i+10]*cp-nz*sp;
        const depthNormal=faces[i+10]*sp+nz*cp;
        const light=.35+.65*Math.abs(nx*-.35+ny*.45+depthNormal*.82);
        const color=phase?(faces[i+12]?'#60ead6':'#af8aff'):visualColor(o);
        triangles.push({q,color,depth:q.reduce((sum,p)=>sum+p[2],0)/q.length,
          alpha:(1-(1-(layerIndex?.23:.11))**o.occupancy)*light});
      }
    });
  }
  triangles.sort((a,b)=>a.depth-b.depth);
  for(const face of triangles) {
    ctx.fillStyle=face.color;ctx.globalAlpha=face.alpha;ctx.beginPath();
    face.q.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();
  }
  ctx.globalAlpha=1;
}
function draw() {
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)) {canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  if(state.empty)return;
  if($('nodes').checked) for(const r of state.roots)for(let axis=0;axis<3;axis++) {
    const ring=Array.from({length:101},(_,j)=>{const a=2*Math.PI*j/100,p=[r*Math.cos(a),r*Math.sin(a),0];return axis===1?[p[0],0,p[1]]:axis===2?[0,p[0],p[1]]:p;});
    line3(ring,w,h,'#a7c6dc38');
  }
  const cut=$('cut').value,phase=$('phase').checked;
  const single=$('single').checked;
  const emphasis=$('emphasize').checked&&!single;
  if(visualMode())emphasis?drawDensitySurfaces(w,h):drawGlow(w,h);
  else for(const group of state.groups)
  for(const layer of emphasis?densityLayers(group):[{alpha:single?1:.36,points:group.points}])
  for(const sign of phase?[false,true]:[null]) {
    ctx.globalAlpha=single?1:1-(1-layer.alpha)**group.sampleWeight;
    ctx.fillStyle=phase?(sign?'#60ead6':'#af8aff'):state.atom?group.orbital.color:'#85d8fa';ctx.beginPath();
    for(const p of layer.points) {
      if((phase&&p[3]!==sign)||(cut==='half'&&p[2]>0)||(cut==='slice'&&Math.abs(p[2])>state.viewExtent*.065))continue;
      const q=project(p[0],p[1],p[2],w,h);
      if(single){ctx.moveTo(q[0]+4,q[1]);ctx.arc(q[0],q[1],4,0,Math.PI*2);}
      else ctx.rect(q[0],q[1],1.5,1.5);
    }
    ctx.fill();
  }
  ctx.globalAlpha=1;
  if($('axes').checked)['x','y','z'].forEach((name,i)=>{
    const p=[0,0,0];p[i]=state.viewExtent*1.05;line3([[0,0,0],p],w,h,['#ea9393','#a1dba2','#9ebcf6'][i]);
    const q=project(...p,w,h);ctx.fillStyle='#cad8e8';ctx.font='12px Segoe UI';ctx.fillText(name,q[0]+5,q[1]);
  });
  if(!single&&!visualMode()){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(w/2,h/2,3,0,Math.PI*2);ctx.fill();}
}
let lastFrame=0;
function render(time) {
  const delta=Math.min(50,time-lastFrame);lastFrame=time;
  if(!document.hidden) {
    if($('spin').checked&&!state.drag) {state.yaw+=delta*.00018;state.dirty=true;}
    if($('live').checked&&!visualMode()&&time-state.lastRefresh>=+$('interval').value) {
      for(const group of state.groups) {
        const amount=$('single').checked?group.points.length:Math.ceil(group.points.length/4);
        for(let i=0;i<amount;i++) {group.points[group.cursor]=M.sample(group.orbital);group.cursor=(group.cursor+1)%group.points.length;}
        group.emphasisLayers=null;
      }
      state.lastRefresh=time;state.dirty=true;
    }
    if(state.dirty) {draw();state.dirty=false;}
  }
  requestAnimationFrame(render);
}
function reset() {state.yaw=.55;state.pitch=.25;state.zoom=1;$('zoom').value=1;state.dirty=true;}
$('explore-element').onclick=explore;
$('element-search').oninput=updateSearch;
$('element-search').onkeydown=event=>{if(event.key==='Enter'){const first=updateSearch();if(first)pickElement(first);}};
$('mode').onchange=()=>{state.atom=$('mode').value==='atom';syncMode();generate();};
$('all-orbitals').onclick=()=>setFocus('all');
$('all-sublevels-off').onclick=()=>{
  state.enabledSublevels.clear();
  state.atom=true;state.sublevel='custom';state.orbital='all';syncMode();generate(true);
};
$('n').onchange=()=>choose(+$('n').value,Math.min(state.l,+$('n').value-1),0);
$('l').onchange=()=>choose(state.n,+$('l').value,0);
$('m').onchange=()=>choose(state.n,state.l,+$('m').value);
$('count').onchange=generate;$('sample').onclick=generate;
$('single').onchange=()=>{if($('single').checked)$('live').checked=true;generate();};
$('core-lens').onchange=()=>{describe();state.dirty=true;};
for(const id of ['phase','nodes','axes','cut','emphasize'])$(id).onchange=()=>{describe();state.dirty=true;};
$('live').onchange=()=>state.lastRefresh=performance.now();
$('reset').onclick=reset;canvas.ondblclick=reset;
$('zoom').oninput=()=>{state.zoom=+$('zoom').value;state.dirty=true;};
canvas.onpointerdown=e=>{state.drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{
  if(!state.drag)return;
  state.yaw+=(e.clientX-state.drag[0])*.008;state.pitch=Math.max(-1.55,Math.min(1.55,state.pitch+(e.clientY-state.drag[1])*.008));
  state.drag=[e.clientX,e.clientY];state.dirty=true;
};
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>state.drag=null;
canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(.4,Math.min(MAX_ZOOM,state.zoom*Math.exp(-e.deltaY*.001)));$('zoom').value=state.zoom;state.dirty=true;},{passive:false});
new ResizeObserver(()=>state.dirty=true).observe(canvas);
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>choose(...b.dataset.preset.split(',').map(Number)));
buildTable();syncMode();generate();requestAnimationFrame(render);
