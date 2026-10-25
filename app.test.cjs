'use strict';
// Local integration harness: executes the actual app handlers without a browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const noop=()=>{};
const context2d=new Proxy({}, {get:(o,k)=>o[k]??(k==='createRadialGradient'?()=>({addColorStop:noop}):k==='createImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4)}):noop),set:(o,k,v)=>(o[k]=v,true)});
class Element {
  constructor(tag='div') {Object.assign(this,{tag,children:[],style:{},dataset:{},attributes:{},value:'',checked:false,disabled:false,hidden:false,className:'',clientWidth:900,clientHeight:550,width:520,height:180});}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(name,value){this.attributes[name]=value;}
  get classList(){return {toggle:(name,on)=>{const set=new Set(this.className.split(' '));on?set.add(name):set.delete(name);this.className=[...set].join(' ');}};}
  getContext(){return context2d;}
  addEventListener(name,fn){this['on'+name]=fn;}
  scrollIntoView(){}
  setPointerCapture(){}
}
const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(match=>[match[1],new Element()]));
for(const [id,value] of Object.entries({count:'6000',interval:'500',cut:'none',zoom:'1'}))ids.get(id).value=value;
for(const id of ['nodes','axes'])ids.get(id).checked=true;
const presets=[...html.matchAll(/data-preset="([^"]+)"/g)].map(match=>{const e=new Element('button');e.dataset.preset=match[1];return e;});
const document={hidden:false,getElementById:id=>ids.get(id)??null,createElement:tag=>new Element(tag),
  querySelector:()=>new Element(),querySelectorAll:selector=>selector==='[data-preset]'?presets:
    selector==='.element'?ids.get('periodic-table').children.filter(e=>e.className.split(' ').includes('element')):[]};
const sandbox={document,performance,console,devicePixelRatio:1,requestAnimationFrame:noop,ResizeObserver:class{observe(){}}};
vm.createContext(sandbox);
for(const name of ['elements.js','visual-cloud.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),sandbox,{filename:name});
const run=source=>vm.runInContext(source,sandbox);
assert.equal(document.querySelectorAll('.element').length,118);
for(const button of document.querySelectorAll('.element')){
  assert.match(button.innerHTML,/class="element-name"/);
  assert.match(button.innerHTML,/class="element-weight"/);
  assert.match(button.attributes['aria-label'],/atomic weight|isotope mass number/);
}
assert.match(ids.get('title').textContent,/Nitrogen/);
assert.match(ids.get('selected-weight').textContent,/14.007/);
run(`for(let z=1;z<=118;z++){pickElement(z);if(state.active!==z||!Number.isFinite(state.extent)||state.groups.reduce((s,g)=>s+g.points.length,0)!==Math.min(6000,z*600))throw Error('Invalid view '+z);if(Math.abs(state.groups.reduce((s,g)=>s+g.points.length*g.sampleWeight,0)-z*600)>1e-6)throw Error('Wrong density weight '+z);draw();}`);
assert.match(ids.get('status').textContent,/118 electrons represented/);
run(`pickElement(6);explore();setFocus('2p',0);`);
assert.match(ids.get('status').textContent,/empty orbital · 0 electrons/);
assert.equal(run('state.groups[0].orbital.occupancy'),0);
assert.equal(run('state.groups.reduce((s,g)=>s+g.points.length,0)'),0);
assert.equal(run('state.roots.length'),0);
// Both canvases must be cleared without drawing any geometry for an empty slot.
const geometry=[];
for(const name of ['rect','arc','lineTo'])context2d[name]=()=>geometry.push(name);
run(`draw();plot();$('live').checked=true;render(performance.now()+2000);`);
assert.equal(geometry.length,0);
assert.equal(run('state.groups.reduce((s,g)=>s+g.points.length,0)'),0);
for(const name of ['rect','arc','lineTo'])context2d[name]=noop;
assert.ok(!ids.has('sublevel-focus')&&!ids.has('orbital-focus'),'dropdowns removed');
assert.ok(html.indexOf('id="boxes"')<html.indexOf('id="scene"'),'diagram moved to controls');
// Parent and child switches are independent, with AND gating for visibility.
let carbonP=ids.get('boxes').children[2];
carbonP.children[0].onclick();
assert.equal(run(`state.enabledSublevels.has('2p')`),false);
assert.equal(run('state.orbitals.length'),0);
assert.equal(run(`state.enabledOrbitals.has('2p:0')`),true,'parent off preserves children');
carbonP=ids.get('boxes').children[2];
carbonP.children[1].children[0].onclick();
assert.equal(run(`state.enabledOrbitals.has('2p:1')`),true);
assert.equal(run(`state.enabledSublevels.has('2p')`),false,'child on must not turn parent on');
assert.equal(run('state.orbitals.length'),0,'off parent masks enabled children');
carbonP=ids.get('boxes').children[2];
assert.equal(carbonP.children[1].children[0].attributes['aria-pressed'],true);
carbonP.children[0].onclick();
assert.equal(run(`state.enabledSublevels.has('2p')`),true);
assert.equal(run('state.orbitals.reduce((sum,o)=>sum+o.occupancy,0)'),1);
carbonP=ids.get('boxes').children[2];
carbonP.children[1].children[0].onclick();
assert.equal(run(`state.enabledSublevels.has('2p')`),true,'child off must not turn parent off');
assert.equal(run('state.groups.reduce((sum,g)=>sum+g.points.length,0)'),0);
carbonP=ids.get('boxes').children[2];
carbonP.children[0].onclick();
carbonP=ids.get('boxes').children[2];
carbonP.children[0].onclick();
assert.equal(run(`state.enabledOrbitals.has('2p:1')`),false,'parent cycling preserves disabled child');
ids.get('all-orbitals').onclick();
assert.equal(run('state.sublevel'),'all');
assert.equal(run('state.orbitals.reduce((sum,o)=>sum+o.occupancy,0)'),6);
ids.get('all-orbitals').onclick();
assert.equal(run('state.orbitals.reduce((sum,o)=>sum+o.occupancy,0)'),6,'all on is idempotent');
const toggleScale=run('state.viewExtent');
const retainedPoints=run(`state.atomCache.groups.find(g=>g.orbital.key==='2p'&&g.orbital.m===1).points`);
run(`toggleSelection(state.enabledSublevels,'1s');toggleSelection(state.enabledSublevels,'2s');toggleSelection(state.enabledOrbitals,'2p:-1');`);
assert.equal(run('state.orbitals.reduce((sum,o)=>sum+o.occupancy,0)'),1);
assert.equal(run('state.viewExtent'),toggleScale);
assert.equal(run(`state.groups.find(g=>g.orbital.m===1).points`),retainedPoints);
run(`toggleSelection(state.enabledSublevels,'2p');draw();plot();$('single').checked=true;$('single').onchange();render(state.lastRefresh+501);`);
assert.equal(run('state.groups.length'),0,'all hidden works during electron resampling');
assert.match(ids.get('title').textContent,/all orbitals hidden/);
run(`$('single').checked=false;$('single').onchange();`);
ids.get('all-orbitals').onclick();
assert.equal(run('state.orbitals.reduce((sum,o)=>sum+o.occupancy,0)'),6);
console.log('PASS: independent orbital/sublevel switches, all four AND-gate cases, persisted child states, all-on reset, empty view, and stable samples/scale.');
run(`setFocus('2p','all')`);
run(`$('live').checked=true;render(performance.now()+2000);`);
assert.equal(run('state.groups.reduce((s,g)=>s+g.points.length,0)'),1200);
run(`$('core-lens').checked=true;$('core-lens').onchange();draw();`);
assert.match(ids.get('view-note').textContent,/Distances in the cloud are distorted/);
run(`pickElement(86);explore();$('count').value='26000';$('count').onchange();draw();`);
assert.equal(run('state.groups.reduce((s,g)=>s+g.points.length,0)'),26000);
run(`$('count').value='6000';for(let nn=1;nn<=7;nn++)for(let ll=0;ll<nn;ll++)for(const mm of M.components(ll)){choose(nn,ll,mm);draw();}`);
assert.equal(ids.get('mode').value,'free');
assert.equal(ids.get('atom-controls').hidden,true);
for(const preset of presets)preset.onclick();
assert.equal(run('state.atom'),false);
run(`$('element-search').value='Xe';updateSearch();`);
assert.equal(document.querySelectorAll('.element').filter(e=>!e.disabled).length,1);
run(`$('element-search').value='nothingmatches';updateSearch();`);
assert.match(ids.get('search-status').textContent,/0 matching/);
run(`$('element-search').value='';updateSearch();$('mode').value='atom';$('mode').onchange();`);
assert.equal(document.querySelectorAll('.element').filter(e=>!e.disabled).length,118);
assert.equal(ids.get('free-controls').hidden,true);
run(`canvas.onwheel({preventDefault(){},deltaY:-100000});`);
assert.equal(run('state.zoom'),300);
assert.equal(+ids.get('zoom').value,300);
assert.match(html,/id="zoom"[^>]*max="300"/);
run(`$('zoom').value='200';$('zoom').oninput();`);
assert.equal(run('state.zoom'),200);
run(`reset()`);
assert.equal(run('state.zoom'),1);
// Electron dots follow actual occupancy, including two in paired orbitals.
run(`pickElement(6);explore();$('single').checked=true;$('single').onchange();`);
assert.equal(ids.get('count').disabled,true);
assert.equal(ids.get('live').checked,true);
assert.equal(run('state.groups.reduce((sum,g)=>sum+g.points.length,0)'),6);
assert.match(ids.get('status').textContent,/6 electron dots · one dot per electron/);
run(`
  const originalRandom=Math.random;
  let seed=12345;
  Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<200;i++){
    const previous=state.groups.map(group=>({orbital:group.orbital,points:[...group.points]}));
    render(state.lastRefresh+501);
    if(state.groups.length!==4)throw Error('Expected four occupied carbon orbitals');
    state.groups.forEach((group,j)=>{
      if(group.points.length!==group.orbital.occupancy||!group.orbital.occupancy)throw Error('Expected one dot per electron');
      if(group.orbital!==previous[j].orbital||group.points[0]===previous[j].points[0])throw Error('Each dot must resample within its own orbital');
    });
  }
  setFocus('2p','all');
  if(state.groups.length!==2)throw Error('Carbon 2p should have two dots');
  setFocus('1s','all');
  if(state.groups.length!==1||state.groups[0].points.length!==2)throw Error('A paired orbital must have two dots');
  choose(2,1,1);
  const phases=new Set();
  for(let i=0;i<100;i++){render(state.lastRefresh+501);phases.add(state.groups[0].points[0][3]);}
  if(phases.size!==2)throw Error('Did not sample both p-orbital phases');
  Math.random=originalRandom;
`);
// Pausing preserves the one point; an interval of 50 ms replaces it on time.
run(`$('live').checked=false;`);
const paused=run('state.groups[0].points[0]');
run(`render(state.lastRefresh+500);`);
assert.equal(run('state.groups[0].points[0]'),paused);
run(`$('interval').value='50';$('live').checked=true;state.lastRefresh=1000;render(state.lastRefresh+49);`);
assert.equal(run('state.groups[0].points[0]'),paused);
run(`render(state.lastRefresh+50);`);
assert.notEqual(run('state.groups[0].points[0]'),paused);
run(`setFocus('2p',0);render(state.lastRefresh+50);draw();plot();`);
assert.equal(run('state.groups.length'),0);
run(`setFocus('2p',1);`);
let circles=0;
context2d.arc=()=>circles++;
run(`draw()`);
assert.equal(circles,1,'one visible dot, without an extra nucleus dot');
context2d.arc=noop;
run(`$('single').checked=false;$('single').onchange();`);
assert.equal(ids.get('count').disabled,false);
assert.equal(run('state.groups.reduce((sum,g)=>sum+g.points.length,0)'),600);
console.log('PASS: one dot per electron, independent resampling, sublevel focus, paired and empty slots, both phase signs, pause/resume, 50 ms interval, and cloud restoration.');
const cloudBefore=run('state.groups[0].points');
const extentBefore=run('state.extent');
run(`$('emphasize').checked=true;$('emphasize').onchange();draw();`);
assert.equal(run('state.groups[0].points'),cloudBefore,'contrast must not resample positions');
assert.equal(run('state.extent'),extentBefore,'contrast must not change radius');
assert.equal(run('state.groups[0].emphasisLayers.reduce((sum,layer)=>sum+layer.points.length,0)'),600);
run(`
  const sparse=[0,0,0,true,'red',.001],dense=[0,0,0,true,'red',1];
  const layers=densityLayers({points:[sparse,dense]});
  if(layers.find(layer=>layer.points.includes(dense)).alpha<=layers.find(layer=>layer.points.includes(sparse)).alpha)
    throw Error('Dense samples must be brighter');
  const oldLayers=state.groups[0].emphasisLayers;
  $('live').checked=true;render(state.lastRefresh+51);
  if(state.groups[0].emphasisLayers===oldLayers)throw Error('Contrast cache was not refreshed');
  $('single').checked=true;$('single').onchange();draw();
`);
assert.equal(ids.get('emphasize').disabled,true);
assert.equal(run('state.groups[0].points.length'),1);
run(`setFocus('2p',0);draw();`);
assert.equal(run('state.groups.length'),0,'empty orbital remains blank');
run(`$('single').checked=false;$('single').onchange();setFocus('2p',1);$('emphasize').checked=false;$('emphasize').onchange();draw();`);
assert.equal(ids.get('emphasize').disabled,false);
assert.equal(run('state.groups[0].points.length'),600);
// Clicking a table tile immediately loads the atom. H and He share the camera
// scale but differ in occupancy, density, and the model's radial contraction.
document.querySelectorAll('.element')[0].onclick();
assert.equal(run('state.active'),1);
const hydrogenScale=run('state.viewExtent');
const hydrogenRadius=run('state.extent');
assert.equal(run('state.groups[0].points.length'),600);
document.querySelectorAll('.element')[1].onclick();
assert.equal(run('state.active'),2);
assert.equal(run('state.groups[0].points.length'),1200);
assert.equal(run('state.viewExtent'),hydrogenScale);
assert.ok(run('state.extent')<hydrogenRadius);
run(`$('single').checked=true;$('single').onchange();`);
assert.equal(run('state.groups[0].points.length'),2);
run(`for(let z=1;z<=118;z++){pickElement(z);if(state.groups.reduce((sum,g)=>sum+g.points.length,0)!==z)throw Error('Wrong electron count '+z);}`);
// Isolating an orbital hides other groups; its existing points, world scale,
// camera orientation, zoom, and full-atom chart scale are preserved.
run(`$('single').checked=false;pickElement(8);$('live').checked=false;state.zoom=2;`);
const wholeScale=run('state.viewExtent');
const projection=Array.from(run('project(1,2,3,900,550)'));
const wholePoints=run(`state.groups.find(g=>g.orbital.key==='2p'&&g.orbital.m===1).points`);
const wholePeak=run('state.atomCache.plotPeak');
run(`setFocus('2p',1);`);
assert.equal(run('state.viewExtent'),wholeScale);
assert.equal(run('state.zoom'),2);
assert.equal(run('state.groups[0].points'),wholePoints);
assert.equal(run('state.atomCache.plotPeak'),wholePeak);
assert.deepEqual(Array.from(run('project(1,2,3,900,550)')),projection);
run(`setFocus('1s');setFocus('all');`);
assert.equal(run(`state.groups.find(g=>g.orbital.key==='2p'&&g.orbital.m===1).points`),wholePoints);
const beforeResample=run('state.groups[0].points');
run(`$('sample').onclick({type:'click'});`);
assert.notEqual(run('state.groups[0].points'),beforeResample,'resample click must refresh cached clouds');
console.log('PASS: immediate element selection, all 118 electron counts, H/He occupancy and size, capped electron-density weights, and stable focus scale/samples.');
// Both annotated lists follow filling order, retaining exception occupancies.
run(`pickElement(60);$('phase').checked=false;updateLegend();`);
const ndOrder=['1s','2s','2p','3s','3p','4s','3d','4p','5s','4d','5p','6s','4f'];
const boxLabels=()=>ids.get('boxes').children.map(group=>group.children[0].textContent);
const legendLabels=()=>ids.get('legend').children.map(span=>span.textContent).filter(text=>text.includes('e⁻'));
assert.deepEqual(boxLabels().map(text=>text.split(' · ')[0]),ndOrder);
assert.deepEqual(legendLabels().map(text=>text.replace('● ','').split(' · ')[0]),ndOrder);
assert.equal(legendLabels().reduce((sum,text)=>sum+Number(text.match(/· (\d+) e⁻/)[1]),0),60);
assert.ok(legendLabels().includes('● 4f · 4 e⁻'));
run(`pickElement(24);`);
assert.deepEqual(boxLabels().slice(-2),['4s · 1 e⁻','3d · 5 e⁻']);
assert.deepEqual(legendLabels().slice(-2),['● 4s · 1 e⁻','● 3d · 5 e⁻']);
run(`setFocus('3d',-2);`);
assert.deepEqual(legendLabels(),['● 3d · 1 e⁻']);
run(`$('phase').checked=true;updateLegend();`);
assert.deepEqual(legendLabels(),['3d · 1 e⁻']);
run(`pickElement(46);`);
assert.ok(!boxLabels().some(text=>text.startsWith('5s')),'do not invent occupancy for Aufbau exceptions');
console.log('PASS: Aufbau ordering in both lists and correct total/focused electron counts, including Cr and Pd exceptions.');
console.log('PASS: density contrast brightens dense samples without changing positions or radius, refreshes during animation, and preserves single/empty-orbital behavior.');
console.log('PASS: app startup, 118 element views, 140 free-orbital views, empty and partial occupancy, live resampling, core lens, Radon at 26,000 samples, presets, search, and mode switching. Visual browser QA still required.');
assert.match(html,/<option value="visual">Visual cloud<\/option>/);
let glowDraws=0;
context2d.drawImage=()=>glowDraws++;
run(`$('count').value='visual';$('single').checked=false;$('emphasize').checked=false;pickElement(2);draw();`);
assert.ok(glowDraws>0,'visual mode paints soft glow sprites');
assert.match(ids.get('status').textContent,/Visual cloud/);
assert.equal(run('state.groups.reduce((sum,g)=>sum+g.points.length,0)'),0,'visual clouds contain no point samples');
run(`$('single').checked=true;$('single').onchange();draw();`);
assert.equal(run('state.groups.reduce((sum,g)=>sum+g.points.length,0)'),2,'electron dots override visual mode');
run(`$('single').checked=false;$('single').onchange();$('emphasize').checked=true;$('emphasize').onchange();draw();`);
assert.match(ids.get('status').textContent,/translucent density regions/);
const surfacePoints=run('JSON.stringify(state.groups[0].points)');
run(`$('live').checked=true;render(state.lastRefresh+1000);`);
assert.equal(run('JSON.stringify(state.groups[0].points)'),surfacePoints,'analytic surfaces stay stable during live resampling');
run(`$('all-sublevels-off').onclick();draw();plot();`);
assert.equal(run('state.empty'),true);
run(`$('all-orbitals').onclick();pickElement(6);setFocus('2p',0);draw();`);
assert.equal(run('state.empty'),true,'empty orbitals have no visual surface');
run(`choose(2,1,1);$('phase').checked=true;for(const cut of ['half','slice','none']){$('cut').value=cut;draw();}`);
run(`pickElement(118);$('core-lens').checked=true;draw();`);
assert.ok(run('state.groups.reduce((sum,g)=>sum+g.points.length,0)')<=6000,'visual sample budget stays bounded');
run(`$('emphasize').checked=false;$('count').value='14000';$('count').onchange();draw();`);
assert.equal(run('state.groups.reduce((sum,g)=>sum+g.points.length,0)'),14000,'numeric cloud mode restores normally');
console.log('PASS: visual glows and density surfaces, electron-dot priority, stable contours, empty selections, phase/cutaways, heavy atoms, and numeric-mode restoration.');
run(`$('count').value='visual';$('phase').checked=false;$('emphasize').checked=true;
  var surfaceCalls=[];var originalSurface=OrbitalVisual.surface;
  OrbitalVisual.surface=(o,r)=>{surfaceCalls.push({...o});return originalSurface(o,r);};
  pickElement(7);draw();`);
assert.deepEqual(Array.from(run('surfaceCalls.filter(o=>o.l===1).map(o=>o.m)').values()).sort(),[-1,0,1],
  'nitrogen keeps all three p dumbbells with phase colors off');
assert.ok(run('surfaceCalls.every(o=>o.m!=="all")'),'never replace individual fields with a spherical sublevel');
run('OrbitalVisual.surface=originalSurface;');
const reference=run('state.orbitals.map(o=>visualOrbital(o).charge).join()');
for(const z of [6,9,10]) {
  run(`pickElement(${z});`);
  assert.equal(run('state.orbitals.map(o=>visualOrbital(o).charge).join()'),reference,'B–Ne fields share visual sizes');
  assert.equal(run('state.viewExtent'),8);
}
run(`$('emphasize').checked=false;$('emphasize').onchange();draw();`);
assert.equal(ids.get('live').disabled,true,'continuous fields do not pretend to resample particles');
assert.equal(run('state.groups.flatMap(g=>g.points).length'),0);
console.log('PASS: all three nitrogen p fields remain distinct and carbon/fluorine/neon share field sizes with occupancy-driven opacity.');
run(`choose(7,1,1);$('spin').checked=false;$('core-lens').checked=false;
  var projectionCalls=[];var originalProjection=OrbitalVisual.projectVolume;
  OrbitalVisual.projectVolume=(o,options)=>{projectionCalls.push(options);return {width:2,height:2,left:0,top:0,screenWidth:2,screenHeight:2,pixels:new Uint8ClampedArray(16)};};
  canvas.onpointerdown({clientX:0,clientY:0,pointerId:1});
  canvas.onpointermove({clientX:10,clientY:5});render(performance.now());`);
assert.ok(run('projectionCalls.every(o=>o.maxSize<=80&&o.raySteps===32)'),'dragging uses bounded preview work');
assert.equal(run('glowNeedsRefinement'),true);
run(`canvas.onpointerup();glowPreviewUntil=0;projectionCalls=[];render(performance.now());`);
assert.ok(run('projectionCalls.length>0&&projectionCalls.every(o=>o.maxSize===224&&o.raySteps===128)'),
  'stopping restores sharp high-shell detail even without another input event');
assert.equal(run('glowNeedsRefinement'),false);
run('projectionCalls=[];render(performance.now());');
assert.equal(run('projectionCalls.length'),0,'the settled cloud does not recompute every frame');
run('OrbitalVisual.projectVolume=originalProjection;');
console.log('PASS: fast interaction preview, automatic full-detail refinement, and no repeated idle projection.');
