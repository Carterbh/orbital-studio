'use strict';

// Neutral configurations: NIST / PDG (2024), with RSC conventions for Ds/Rg.
// 109–118 are reference predictions; this is not a relativistic atom solver.
const OrbitalModel = (() => {
  const letters = ['s', 'p', 'd', 'f', 'g', 'h', 'i'];
  const identities = `H Hydrogen,He Helium,Li Lithium,Be Beryllium,B Boron,C Carbon,N Nitrogen,O Oxygen,F Fluorine,Ne Neon,Na Sodium,Mg Magnesium,Al Aluminium,Si Silicon,P Phosphorus,S Sulfur,Cl Chlorine,Ar Argon,K Potassium,Ca Calcium,Sc Scandium,Ti Titanium,V Vanadium,Cr Chromium,Mn Manganese,Fe Iron,Co Cobalt,Ni Nickel,Cu Copper,Zn Zinc,Ga Gallium,Ge Germanium,As Arsenic,Se Selenium,Br Bromine,Kr Krypton,Rb Rubidium,Sr Strontium,Y Yttrium,Zr Zirconium,Nb Niobium,Mo Molybdenum,Tc Technetium,Ru Ruthenium,Rh Rhodium,Pd Palladium,Ag Silver,Cd Cadmium,In Indium,Sn Tin,Sb Antimony,Te Tellurium,I Iodine,Xe Xenon,Cs Caesium,Ba Barium,La Lanthanum,Ce Cerium,Pr Praseodymium,Nd Neodymium,Pm Promethium,Sm Samarium,Eu Europium,Gd Gadolinium,Tb Terbium,Dy Dysprosium,Ho Holmium,Er Erbium,Tm Thulium,Yb Ytterbium,Lu Lutetium,Hf Hafnium,Ta Tantalum,W Tungsten,Re Rhenium,Os Osmium,Ir Iridium,Pt Platinum,Au Gold,Hg Mercury,Tl Thallium,Pb Lead,Bi Bismuth,Po Polonium,At Astatine,Rn Radon,Fr Francium,Ra Radium,Ac Actinium,Th Thorium,Pa Protactinium,U Uranium,Np Neptunium,Pu Plutonium,Am Americium,Cm Curium,Bk Berkelium,Cf Californium,Es Einsteinium,Fm Fermium,Md Mendelevium,No Nobelium,Lr Lawrencium,Rf Rutherfordium,Db Dubnium,Sg Seaborgium,Bh Bohrium,Hs Hassium,Mt Meitnerium,Ds Darmstadtium,Rg Roentgenium,Cn Copernicium,Nh Nihonium,Fl Flerovium,Mc Moscovium,Lv Livermorium,Ts Tennessine,Og Oganesson`;
  const order = '1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p'.split(' ');
  // CIAAW abridged standard atomic weights (2024), without uncertainties on tiles.
  // Bracketed isotope mass numbers follow the IUPAC periodic table (4 May 2022).
  const weights = `1.0080 4.0026 6.94 9.0122 10.81 12.011 14.007 15.999 18.998 20.180
22.990 24.305 26.982 28.085 30.974 32.06 35.45 39.95 39.098 40.078
44.956 47.867 50.942 51.996 54.938 55.845 58.933 58.693 63.546 65.38
69.723 72.630 74.922 78.971 79.904 83.798 85.468 87.62 88.906 91.222
92.906 95.95 [97] 101.07 102.91 106.42 107.87 112.41 114.82 118.71
121.76 127.60 126.90 131.29 132.91 137.33 138.91 140.12 140.91 144.24
[145] 150.36 151.96 157.25 158.93 162.50 164.93 167.26 168.93 173.05
174.97 178.49 180.95 183.84 186.21 190.23 192.22 195.08 196.97 200.59
204.38 207.2 208.98 [209] [210] [222] [223] [226] [227] 232.04
231.04 238.03 [237] [244] [243] [247] [247] [251] [252] [257]
[258] [259] [262] [267] [268] [269] [270] [269] [277] [281]
[282] [285] [286] [290] [290] [293] [294] [294]`.trim().split(/\s+/);
  const exceptions = {
    24: {'3d':5,'4s':1}, 29: {'3d':10,'4s':1},
    41: {'4d':4,'5s':1}, 42: {'4d':5,'5s':1}, 44: {'4d':7,'5s':1},
    45: {'4d':8,'5s':1}, 46: {'4d':10,'5s':0}, 47: {'4d':10,'5s':1},
    57: {'4f':0,'5d':1}, 58: {'4f':1,'5d':1}, 64: {'4f':7,'5d':1},
    78: {'5d':9,'6s':1}, 79: {'5d':10,'6s':1},
    89: {'5f':0,'6d':1}, 90: {'5f':0,'6d':2}, 91: {'5f':2,'6d':1},
    92: {'5f':3,'6d':1}, 93: {'5f':4,'6d':1}, 96: {'5f':7,'6d':1},
    103: {'6d':0,'7p':1}, 110: {'6d':9,'7s':1}, 111: {'6d':10,'7s':1}
  };
  function configuration(z) {
    let left = z;
    const counts = {};
    for (const key of order) {
      const capacity = 2 * (2 * letters.indexOf(key[1]) + 1);
      counts[key] = Math.min(capacity, left);
      left -= counts[key];
    }
    Object.assign(counts, exceptions[z]);
    return order.filter(key => counts[key]).map(key => ({
      key, n: +key[0], l: letters.indexOf(key[1]), electrons: counts[key]
    })).sort((a,b) => a.n-b.n || a.l-b.l);
  }
  function position(z) {
    if (z >= 57 && z <= 71) return [9,z-53,'f'];
    if (z >= 89 && z <= 103) return [10,z-85,'f'];
    const starts = [1,3,11,19,37,55,87];
    let period = starts.findLastIndex(start => z >= start) + 1;
    let col = z-starts[period-1]+1;
    if (period===1 && z===2) col=18;
    if ((period===2 || period===3) && col>2) col+=10;
    if (period>=6 && col>2) col-=14;
    return [period,col,z===2 || col<=2 ? 's' : col>=13 ? 'p' : 'd'];
  }
  const elements = identities.split(',').map((item,i) => {
    const [symbol,name] = item.split(' '), z=i+1;
    const [row,col,block] = position(z);
    return {z,symbol,name,row,col,block,weight:weights[i],config:configuration(z),predicted:z>=109};
  });
  const superscript = number => String(number).replace(/\d/g, digit => '⁰¹²³⁴⁵⁶⁷⁸⁹'[digit]);
  function configText(element, short=true) {
    const core = short ? [86,54,36,18,10,2].find(z => z < element.z) : null;
    const coreKeys = new Set(core ? elements[core-1].config.map(s => s.key) : []);
    return (core ? `[${elements[core-1].symbol}] ` : '') + element.config
      .filter(s => !coreKeys.has(s.key))
      .sort((a,b) => (a.n+a.l)-(b.n+b.l) || a.n-b.n)
      .map(s => s.key+superscript(s.electrons)).join(' ');
  }
  function components(l) { return l===1 ? [1,-1,0] : Array.from({length:2*l+1},(_,i)=>i-l); }
  function occupancy(electrons,l,index) {
    const size=2*l+1;
    return Number(index<Math.min(electrons,size))+Number(index<Math.max(0,electrons-size));
  }
  function label(l,m) {
    if(l===1) return {'-1':'pᵧ',0:'p𝓏',1:'pₓ'}[m];
    if(l===2) return ['dₓᵧ','dᵧ𝓏','d𝓏²','dₓ𝓏','dₓ²−ᵧ²'][m+2];
    return letters[l]+(l ? (m===0 ? ' (m = 0)' : ` (|m| = ${Math.abs(m)}, ${m>0?'cos':'sin'})`) : '');
  }
  function lag(k,a,x) {
    if(k===0) return 1;
    let p=1,q=1+a-x;
    for(let j=2;j<=k;j++) { const v=((2*j-1+a-x)*q-(j-1+a)*p)/j;p=q;q=v; }
    return q;
  }
  function radialValue(n,l,r) {
    const rho=2*r/n;
    return Math.exp(-rho/2)*rho**l*lag(n-l-1,2*l+1,rho);
  }
  function fact(k) { let v=1;for(let i=2;i<=k;i++)v*=i;return v; }
  function angular(l,m,c,phi) {
    const a=Math.abs(m);
    let p=1;
    for(let j=1;j<=a;j++) p*=-(2*j-1)*Math.sqrt(Math.max(0,1-c*c));
    if(l>a) {
      let q=c*(2*a+1)*p;
      for(let j=a+2;j<=l;j++) { const v=((2*j-1)*c*q-(j+a-1)*p)/(j-a);p=q;q=v; }
      p=q;
    }
    const norm=Math.sqrt((2*l+1)/(4*Math.PI)*fact(l-a)/fact(l+a))*(a?Math.SQRT2:1);
    return norm*p*(m>0?Math.cos(a*phi):m<0?Math.sin(a*phi):1);
  }
  const cache=new Map();
  function radialDistribution(n,l) {
    const key=`${n},${l}`;
    if(cache.has(key)) return cache.get(key);
    const max=4*n*n+12*n, steps=4500, step=max/steps;
    const rows=[], roots=[];
    let sum=0,last=radialValue(n,l,step*.01);
    for(let i=0;i<=steps;i++) {
      const r=i*step,v=radialValue(n,l,r),density=r*r*v*v;
      sum+=density*step;
      rows.push([r,sum,density]);
      if(i>1 && v*last<0) {
        let a=r-step,b=r;
        for(let j=0;j<32;j++) { const mid=(a+b)/2;if(radialValue(n,l,a)*radialValue(n,l,mid)<=0)b=mid;else a=mid; }
        roots.push((a+b)/2);
      }
      if(v!==0)last=v;
    }
    for(const row of rows) { row[1]/=sum;row[2]/=sum; }
    const result={rows,roots,extent:rows.find(row=>row[1]>=.995)[0],step};
    cache.set(key,result);
    return result;
  }
  // Slater groups: (ns,np), (nd), (nf). Outer groups do not screen inner ones.
  function effectiveCharge(element,sublevel) {
    let shield=0;
    for(const other of element.config) {
      if(sublevel.l<=1) {
        if(other.n===sublevel.n && other.l<=1)
          shield+=(other.electrons-(other.key===sublevel.key?1:0))*(sublevel.n===1?.30:.35);
        else if(other.n===sublevel.n-1) shield+=other.electrons*.85;
        else if(other.n<sublevel.n-1) shield+=other.electrons;
      } else {
        if(other.key===sublevel.key) shield+=(other.electrons-1)*.35;
        else if(other.n<sublevel.n || (other.n===sublevel.n && other.l<sublevel.l)) shield+=other.electrons;
      }
    }
    return Math.max(1,element.z-shield);
  }
  function color(n,l) { return `hsl(${(n*47+l*83)%360} 72% 70%)`; }
  function atomOrbitals(element) {
    return element.config.flatMap(s => components(s.l).map((m,index) => ({
      ...s,m,occupancy:occupancy(s.electrons,s.l,index),charge:effectiveCharge(element,s),color:color(s.n,s.l)
    })));
  }
  function sample(orbital) {
    const {n,l,m,charge=1}=orbital, {rows}=radialDistribution(n,l);
    const u=Math.random();
    let a=0,b=rows.length-1;
    while(a<b) { const mid=(a+b)>>1;if(rows[mid][1]<u)a=mid+1;else b=mid; }
    const prev=rows[Math.max(0,a-1)],next=rows[a];
    const r0=prev[0]+(next[0]-prev[0])*(u-prev[1])/(next[1]-prev[1]||1),r=r0/charge;
    let c,phi,y;
    const bound=(2*l+1)/(4*Math.PI);
    do {c=2*Math.random()-1;phi=2*Math.PI*Math.random();y=angular(l,m,c,phi);} while(Math.random()*bound>y*y);
    const s=Math.sqrt(1-c*c),amplitude=radialValue(n,l,r0)*y;
    // Relative 3D density within this orbital; its normalization cancels in
    // the optional display contrast. Sampling remains unchanged.
    return [r*s*Math.cos(phi),r*s*Math.sin(phi),r*c,amplitude>=0,orbital.color,amplitude*amplitude];
  }
  function allocations(orbitals,count) {
    const total=orbitals.reduce((sum,o)=>sum+o.occupancy,0);
    if(!total) return orbitals.map(()=>0);
    const raw=orbitals.map(o=>count*o.occupancy/total), result=raw.map(Math.floor);
    let remainder=count-result.reduce((a,b)=>a+b,0);
    const ranked=raw.map((v,i)=>[v-result[i],i]).sort((a,b)=>b[0]-a[0]);
    for(let i=0;i<remainder;i++)result[ranked[i][1]]++;
    return result;
  }
  function probability(orbital,r,cdf=false) {
    const d=radialDistribution(orbital.n,orbital.l),x=r*orbital.charge/d.step;
    const i=Math.floor(x),f=x-i,k=cdf?1:2;
    if(i>=d.rows.length-1)return cdf?1:0;
    return (d.rows[i][k]*(1-f)+d.rows[i+1][k]*f)*(cdf?1:orbital.charge);
  }
  function mixtureExtent(orbitals) {
    const total=orbitals.reduce((s,o)=>s+o.occupancy,0);
    let lo=0,hi=Math.max(...orbitals.map(o=>radialDistribution(o.n,o.l).rows.at(-1)[0]/o.charge));
    for(let i=0;i<40;i++) {
      const mid=(lo+hi)/2;
      const cumulative=orbitals.reduce((s,o)=>s+(total?o.occupancy:1)*probability(o,mid,true),0)/(total||orbitals.length);
      if(cumulative<.995)lo=mid;else hi=mid;
    }
    return hi;
  }
  return {letters,elements,configuration,configText,components,occupancy,label,angular,radialValue,
    radialDistribution,effectiveCharge,atomOrbitals,sample,allocations,probability,mixtureExtent,color};
})();
if(typeof module!=='undefined') module.exports=OrbitalModel;
