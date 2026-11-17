/* Schematic, not a georeferenced map. No person is location-tracked.
   Animations show an illustrative grouping process; positions are not GPS. */
(() => {
  'use strict';
  const e = id => document.getElementById(id);
  const sites = {
    sang:{x:199,y:153},tai:{x:231,y:318},marketMeet:{x:360,y:181},
    chessMeet:{x:488,y:330},market:{x:735,y:130},chess:{x:775,y:374}
  };
  const colors={market:'#F15B66',chess:'#A46CB0'};
  const defs={
    market:{label:'MARKET',dest:'WAH FU (II) MARKET',meeting:'CP-S',cp:'marketMeet',destPoint:'market'},
    chess:{label:'CHESS',dest:'BANYAN TREE AREA',meeting:'CP-X',cp:'chessMeet',destPoint:'chess'}
  };
  let active=false, paused=false, startAt=0, pauseTime=0, lastPaint=0, root=null, stateFn=()=>null, reduce=false, generation=0;
  const DURATION=30000;
  const lerp=(a,b,p)=>a+(b-a)*Math.min(1,Math.max(0,p));
  function interpolate(a,b,p){return {x:lerp(a.x,b.x,p),y:lerp(a.y,b.y,p)};}
  function marker(x,y,num,color,small=false,txt=''){
    const r=small?19:28;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" class="actor"><circle r="${r+5}" fill="${color}" fill-opacity=".15"/><circle r="${r}" fill="${color}" stroke="white" stroke-width="3"/><text text-anchor="middle" y="5" fill="white" font-size="${small?17:23}" font-weight="900">${num}</text>${txt?`<text text-anchor="middle" y="${r+22}" font-size="13" font-weight="800" fill="#1d2f29">${txt}</text>`:''}</g>`;
  }
  function svg(){return `<div class="network-label"><div><span class="eyebrow">04 / SOCIAL MOBILITY</span><h2>Live journey simulation</h2><p class="quiet">Participants are real classroom choices. Animated movement is <strong>illustrative</strong>, not GPS.</p></div><div class="map-legend"><span><i class="swatch market"></i>Market</span><span><i class="swatch chess"></i>Chess / Banyan</span></div></div>
  <div class="map-stage"><svg id="wahfu-map" viewBox="0 0 960 470" role="img" aria-label="Conceptual Wah Fu Estate diagram with two origins, two destinations and animated merging groups. Routes have not been verified.">
  <defs>
    <linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6F7"/><stop offset="1" stop-color="#F7E4E8"/></linearGradient>
    <pattern id="grids" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="1"/></pattern>
  </defs>
  <rect width="960" height="470" rx="15" fill="url(#land)"/><rect width="960" height="470" fill="url(#grids)" rx="15"/>
  <path d="M 0 415 C 130 393 152 470 310 470 L 0 470 Z" fill="#E5DCEB" opacity=".9"/>
  <g fill="none" stroke="#EBD2D8" stroke-width="2"><path d="M-30 74C95 24 180 62 302 32S602 5 770 58S915 50 994 26"/><path d="M-40 115C102 64 183 102 302 72S602 45 773 95S913 91 985 67"/><path d="M-40 347C100 293 180 365 302 346S607 401 770 407S910 401 985 426"/><path d="M-25 397C95 350 189 410 305 391S605 441 778 451"/></g>
  <path d="M128 0C139 155 187 188 180 320S273 431 338 485" fill="none" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round"/><path d="M175 81C314 120 420 96 532 80S777 55 960 100" fill="none" stroke="#FFFFFF" stroke-width="25" stroke-linecap="round"/><path d="M274 305C429 239 609 248 843 308" fill="none" stroke="#FFFFFF" stroke-width="29" stroke-linecap="round"/>
  <g class="estate-building" fill="#D9BFC5"><rect x="162" y="117" width="75" height="48" rx="6"/><rect x="193" y="285" width="77" height="51" rx="6"/><rect x="710" y="75" width="80" height="52" rx="6"/><rect x="747" y="353" width="92" height="51" rx="6"/></g>
  <path d="M 199 153 Q 272 133 360 181 Q 551 117 735 130" class="map-route route-market"/>
  <path d="M 231 318 Q 278 216 360 181" class="map-route route-market"/>
  <path d="M 199 153 Q 334 294 488 330 Q 625 321 775 374" class="map-route route-chess"/>
  <path d="M 231 318 Q 340 359 488 330" class="map-route route-chess"/>
  <g class="map-checkpoints"><circle cx="360" cy="181" r="12"/><circle cx="488" cy="330" r="12"/></g>
  <g class="map-site-labels">
    <text x="247" y="132" class="map-loc">WAH SANG</text><text x="247" y="150" class="map-sub">CP-S · RESIDENTIAL START</text>
    <text x="282" y="296" class="map-loc">WAH TAI</text><text x="282" y="314" class="map-sub">CP-T · RESIDENTIAL START</text>
    <text x="380" y="175" class="map-loc">CP-S</text><text x="380" y="193" class="map-sub">MARKET MERGE</text>
    <text x="502" y="310" class="map-loc">CP-X</text><text x="502" y="328" class="map-sub">CHESS MERGE (CANDIDATE)</text>
    <text x="685" y="41" class="map-loc">MARKET · 5/F</text><text x="685" y="58" class="map-sub">WAH FU (II)</text>
    <text x="720" y="423" class="map-loc">BANYAN TREE</text><text x="720" y="443" class="map-sub">WAH FU (I)</text>
  </g>
  <g id="moving-actors"></g>
  <g><rect x="17" y="16" width="205" height="48" rx="12" fill="#fffef7" fill-opacity=".95"/><text x="29" y="38" font-size="12" fill="#536457" font-weight="800">WAH FU ESTATE</text><text x="29" y="54" font-size="11" fill="#536457">SCHEMATIC · NOT TO SCALE</text></g>
  </svg>
  <div class="map-footer"><div><strong id="map-phase">01 / At home</strong><span id="map-narrative">People choose their daily activities.</span></div><div class="map-controls"><button id="map-replay" type="button">↺ Replay</button><button id="map-pause" type="button">Pause</button><button id="map-next" type="button">Next step →</button></div></div></div>
  <div class="map-footnote">This map visualises the largest active cohort for each destination. Different meeting times / walking paces remain separate groups in the dashboard. Routes, movement timings and checkpoint locations are illustrative, not field-validated. No GPS is collected.</div>`;}
  function counts(){
    const data=stateFn()||{};
    const result={market:{sang:0,tai:0,total:0},chess:{sang:0,tai:0,total:0}};
    // Each marker represents ONE actual matching cohort (same activity, time, pace).
    // Never combine different time slots into a fictitious single walking group.
    for(const g of data.groups||[]){
      if(!result[g.activity] || Number(g.total||0)<=result[g.activity].total)continue;
      result[g.activity]={sang:Number(g.origins?.sang||0),tai:Number(g.origins?.tai||0),
        total:Number(g.total||0),slot:g.slot,pace:g.pace};
    }
    return result;
  }
  const stageText=[
    ['01 / At home', 'People choose Chess or Market on their devices.'],
    ['02 / First meeting', 'Residents meet at their assigned shared checkpoint.'],
    ['03 / Journey together', 'Groups travel to different existing destinations.'],
    ['04 / At destination', 'Market and Chess groups reach separate social places.']
  ];
  function render(t){
    if(!root)return;
    const all=counts(), fragments=[];
    const phase=t<.23?0:t<.46?1:t<.79?2:3;
    for(const a of ['market','chess']){
      const d=defs[a],c=all[a],color=colors[a];if(!c.total)continue;
      const meeting=sites[d.cp],final=sites[d.destPoint];
      if(t<.46){
        for(const o of ['sang','tai']){
          if(!c[o])continue;
          const prog=t<.23?0:(t-.23)/.23;
          const point=interpolate(sites[o],meeting,prog);
          fragments.push(marker(point.x,point.y,c[o],color,true,o==='sang'?'WAH SANG':'WAH TAI'));
        }
      }else{
        const prog=t<.79?(t-.46)/.33:1;
        const point=interpolate(meeting,final,prog);
        fragments.push(marker(point.x,point.y,c.total,color,false,(a==='market'?'MARKET':'CHESS')+' · '+c.slot));
      }
    }
    const el=e('moving-actors');if(el)el.innerHTML=fragments.join('');
    const label=e('map-phase'),narrative=e('map-narrative');
    if(label)label.textContent=stageText[phase][0];
    if(narrative)narrative.textContent=stageText[phase][1];
  }
  function frame(now,gen){if(!active||gen!==generation)return; if(!paused&&now-lastPaint>70){lastPaint=now;const t=((now-startAt)%DURATION)/DURATION;render(t);}requestAnimationFrame(t=>frame(t,gen));}
  function mount(el,getState){active=false;generation++;const myGen=generation;root=el;stateFn=getState;paused=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;reduce=paused;root.innerHTML=svg();startAt=performance.now();pauseTime=0;lastPaint=0;active=true;render(0);e('map-pause').textContent=paused?'Play':'Pause';e('map-pause').addEventListener('click',()=>{if(paused){startAt=performance.now()-pauseTime;paused=false;e('map-pause').textContent='Pause';}else{pauseTime=(performance.now()-startAt)%DURATION;paused=true;e('map-pause').textContent='Play';}});
    e('map-replay').addEventListener('click',()=>{startAt=performance.now();pauseTime=0;render(0)});
    e('map-next').addEventListener('click',()=>{const t=paused?pauseTime/DURATION:((performance.now()-startAt)%DURATION)/DURATION;const next=t<.23?.29:t<.46?.57:t<.79?.88:.02;pauseTime=next*DURATION;startAt=performance.now()-pauseTime;render(next);});
    requestAnimationFrame(t=>frame(t,myGen));
  }
  window.WahFuMap={mount};
})();
