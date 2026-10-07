import {writeFile} from 'node:fs/promises';
import {OWNERS,CURRENT_ID,parseArchives} from '../dist/core.mjs';
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();if(data.error)throw new Error(JSON.stringify(data.error));return data;}
const q='('+[...OWNERS].map(owner=>`owner:${owner}`).join(' OR ')+') AND Ukraine AND type:"Web Experience"';
const items=[];let start=1;
for(let page=0;page<5;page++){const data=await get(`https://www.arcgis.com/sharing/rest/search?${new URLSearchParams({f:'json',q,num:'100',start:String(start)})}`);items.push(...data.results);if(data.nextStart<0)break;start=data.nextStart;}
const data=await get(`https://www.arcgis.com/sharing/rest/content/items/${CURRENT_ID}/data?f=json`);
const cutoff=Object.values(data.nodes||{}).map(n=>n.data?.text||'').find(t=>/^Assessed Control of Terrain in Ukraine\s+as of /i.test(t))?.replace(/^Assessed Control of Terrain in Ukraine\s+as of\s*/i,'').replace(/<[^>]*>/g,'').trim()||null;
const archives=parseArchives(items);
await writeFile(new URL('../dist/catalog.json',import.meta.url),JSON.stringify({metadataCheckedAt:new Date().toISOString(),cutoff,archives},null,2)+'\n');
console.log(JSON.stringify({archives:archives.length,cutoff,years:[...new Set(archives.map(a=>a.year))]}));
