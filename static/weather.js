/* Official current conditions from HKO; no illustrative temperatures. */
(() => {
 'use strict';
 const source='https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en';
 let value=null, host=null, language=()=> 'en';
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const symbols={50:'☀️',51:'🌤️',52:'🌤️',53:'🌦️',54:'🌦️',60:'☁️',61:'☁️',62:'🌧️',63:'🌧️',64:'🌧️',65:'⛈️',76:'☁️',77:'🌙'};
 const zhConditions={Sunny:'天晴','Sunny periods':'部分時間有陽光','Sunny intervals':'短暫陽光','Sunny periods with showers':'部分時間有陽光及驟雨','Sunny intervals with showers':'短暫陽光及驟雨',Cloudy:'多雲',Overcast:'陰天','Light rain':'微雨',Rain:'有雨','Heavy rain':'大雨',Thunderstorms:'雷暴','Mainly cloudy':'大致多雲','Mainly fine':'大致天晴'};
 function readTime(v,zh){try{const dt=new Date(v);if(Number.isNaN(dt.getTime()))return '';return new Intl.DateTimeFormat(zh?'zh-HK':'en-GB',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit',hour12:false}).format(dt)+' HKT';}catch(e){return ''}}
 function ui(lang){const zh=lang==='zh';
  if(!value || value.status==='unavailable' || value.status==='loading')return `<div class="wx-group"><span class="wx-icon">☁</span><div><div class="wx-title">${zh?'香港天氣':'HONG KONG WEATHER'}</div><strong>${zh?'天氣資料暫未能取得':'Weather unavailable'}</strong><div class="wx-detail">${zh?'無法連接天文台。活動不受影響。':'HKO data could not be loaded. Groups still work.'}</div></div></div><div class="wx-note">${zh?'不顯示模擬溫度':'No temperature is simulated'} · <a href="${source}" target="_blank" rel="noopener">HKO ↗</a></div>`;
  const v=value, icon=symbols[v.icon_code]||'🌡️', condition=zh?(zhConditions[v.condition]||'最新天氣'):v.condition;
  const status=v.status==='live'?(zh?'天文台最新資料':'HKO LATEST REPORT'):(zh?'緩存資料 · 請核實':'CACHED · CHECK UPDATE');
  const observed=readTime(v.observed_at,zh),temp=Number.isFinite(v.temperature_c)?`${v.temperature_c.toFixed(1)}°C`:'—';
  const h=v.humidity_pct!=null?` · ${zh?'濕度':'Humidity'} ${v.humidity_pct}%${v.humidity_station&&v.humidity_station!==v.station?' ('+esc(v.humidity_station)+')':''}`:'';
  const station=zh?'測量站':'Station';
  const warns=Array.isArray(v.warnings)&&v.warnings.length?`<div class="wx-note" title="${esc(v.warnings[0])}">⚠ ${zh?'天文台設有天氣提示／警告，請查看原文':'HKO weather notice: check official information'}</div>`:'';
  return `<div class="wx-group"><span class="wx-icon" aria-hidden="true">${icon}</span><div><div class="wx-title">${zh?'香港現時天氣':'CURRENT HONG KONG WEATHER'}</div><strong>${esc(temp)} · ${esc(condition)}</strong><div class="wx-detail">${station}: ${esc(v.station)} · ${esc(observed)}${h}</div></div></div><div><div class="wx-status">${status}</div>${warns}<a href="${source}" target="_blank" rel="noopener">${zh?'資料來源：香港天文台 ↗':'Source: HKO Open Data ↗'}</a></div>`;
 }
 function paint(){if(!host)return;const zh=language();host.innerHTML=ui(zh);host.classList.toggle('unavailable',!value||!['live','cached'].includes(value.status));host.classList.toggle('alert',!!value?.warnings?.length);}
 async function refresh(){try{const resp=await fetch('/api/weather',{cache:'no-store'});if(!resp.ok)throw Error('HKO weather service unavailable');value=await resp.json();}catch(e){value={status:'unavailable'};}paint();return value;}
 function init(el,langFn){host=el;language=langFn||language;paint();refresh();setInterval(refresh,300000);}
 window.WahFuWeather={init,refresh,paint,mount:el=>{host=el;paint();},get:()=>value};
})();
