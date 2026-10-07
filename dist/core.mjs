export const CURRENT_ID = '36a7f6a6f5a9448496de641cf64bd375';
export const CURRENT_URL = `https://storymaps.arcgis.com/stories/${CURRENT_ID}`;
export function embedMap(id) { if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('地图 ID 无效'); return `https://www.arcgis.com/apps/Embed/index.html?webmap=${id}&extent=22,44,41,53&zoom=true&scale=true&legend=true&theme=light`; }
export const CURRENT_EMBED_URL = embedMap('9f04944a2fe84edab9da31750c2b15eb');
export const ARCHIVE_URL = 'https://storymaps.arcgis.com/stories/733fe90805894bfc8562d90b106aa895';
export const OWNERS = new Set(['thestudyofwar','gbarros_understandingwar','dmealie_understandingwar','jthompson_understandingwar','nkramer_understandingwar','cweinstein_understandingwar']);
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const CONTROL = { russia: {label:'俄方评估控制',color:'#ed7181'}, ukraine:{label:'乌方评估控制',color:'#5798ed'}, disputed:{label:'争议区域',color:'#dfb061'}, unknown:{label:'控制情况未知',color:'#8291a5'} };

export function safeUrl(value, base) {
  const url = new URL(value, base);
  if (url.username || url.password || !['https:','http:'].includes(url.protocol)) throw new Error('数据链接必须是 HTTP(S)，并且不能含有账号或密码。');
  if (url.protocol === 'http:' && (!base || url.origin !== new URL(base).origin)) throw new Error('外部数据链接必须使用 HTTPS。');
  return url.href;
}

export function parseArchives(items) {
  const result = [];
  for (const item of items) {
    if (!OWNERS.has(item.owner?.toLowerCase()) || item.type !== 'Web Experience' || item.access !== 'public' || !/^[a-f0-9]{32}$/.test(item.id)) continue;
    const match = item.title?.match(/^(?:View )?Ukraine Time[- ]?Lapse ([A-Za-z]+) (20\d{2})$/i);
    if (!match) continue;
    const month = MONTHS.findIndex(m => m.toLowerCase() === match[1].toLowerCase()) + 1;
    if (!month || Number(match[2]) < 2022) continue;
    const url = `https://experience.arcgis.com/experience/${item.id}`;
    const expected = new URL(url);
    try { const supplied = new URL(item.url); if (supplied.origin !== expected.origin || supplied.pathname.replace(/\/$/,'') !== expected.pathname) continue; } catch { continue; }
    result.push({id:item.id,year:Number(match[2]),month,url,title:item.title,owner:item.owner,itemModifiedAt: item.modified ? new Date(item.modified).toISOString() : null});
  }
  return result.sort((a,b)=>a.year-b.year || a.month-b.month || (b.itemModifiedAt||'').localeCompare(a.itemModifiedAt||''));
}

function timestamp(value, name) {
  if (typeof value !== 'string' || !/T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`${name} 必须包含时区的 ISO 8601 时间。`);
  return Date.parse(value);
}
export function validateFeed(value, now = Date.now(), base = 'https://example.invalid/') {
  if (value?.version !== 1 || !value.source?.name || !value.source?.permissionReference || value.source?.permissionConfirmed !== true) throw new Error('数据源必须给出名称、授权依据和 permissionConfirmed=true。这些信息仍须由维护者核验。');
  const sourceUrl = safeUrl(value.source.url,base);
  if (!['hour','day','irregular'].includes(value.source.temporalResolution)) throw new Error('数据源必须声明 hour、day 或 irregular 时间粒度。');
  if (!Array.isArray(value.snapshots) || value.snapshots.length > 10000) throw new Error('快照索引格式错误或超过 10000 条。');
  const ids = new Set();
  const snapshots = value.snapshots.map(s => {
    if (!s.id || typeof s.id !== 'string' || ids.has(s.id)) throw new Error('快照必须有唯一 id。');
    ids.add(s.id);
    const observed = timestamp(s.observedAt,'observedAt');
    const published = timestamp(s.publishedAt,'publishedAt');
    const end = s.validUntil ? timestamp(s.validUntil,'validUntil') : observed;
    if (end < observed || published < observed || observed > now + 60000 || published > now + 60000) throw new Error('快照时间顺序无效或发布时间位于未来。');
    if (typeof s.coverage !== 'string' || !s.coverage.trim()) throw new Error('每条快照须声明 coverage 覆盖范围。');
    if (!s.geojsonUrl) throw new Error('快照缺少 geojsonUrl。');
    return {...s, observed, published, end, geojsonUrl:safeUrl(s.geojsonUrl,base)};
  }).sort((a,b)=>a.observed-b.observed);
  return {source:{...value.source,url:sourceUrl},snapshots};
}

export function chooseSnapshot(snapshots, target) {
  const time = typeof target === 'number' ? target : Date.parse(target);
  if (!Number.isFinite(time)) throw new Error('目标时间无效。');
  let chosen = null;
  for (const snapshot of snapshots) { if (snapshot.observed <= time) chosen = snapshot; else break; }
  // A provider must declare the validity window; never extrapolate over gaps.
  return chosen && time <= chosen.end ? chosen : null;
}

export function shiftTime(time, step, direction) {
  const d = new Date(time);
  if (!Number.isFinite(d.getTime()) || !['hour','day','week','month','year'].includes(step)) throw new Error('无效的时间步长。');
  if (step === 'hour') return time + direction * 3600000;
  if (step === 'day' || step === 'week') return time + direction * (step === 'week' ? 7 : 1) * 86400000;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  if (step === 'month') d.setUTCMonth(d.getUTCMonth()+direction); else d.setUTCFullYear(d.getUTCFullYear()+direction);
  const last = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,last));
  return d.getTime();
}

export function validateTerritories(data) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length > 20000) throw new Error('地图需要 GeoJSON FeatureCollection，最多 20000 个区域。');
  let points = 0;
  for (const f of data.features) {
    if (f.type !== 'Feature' || !Object.hasOwn(CONTROL,f.properties?.control)) throw new Error('每个区域须明确标记 russia、ukraine、disputed 或 unknown，不能推断未标记区域。');
    if (!['assessed','claimed'].includes(f.properties?.assessment)) throw new Error('每个区域须区分 assessed 和 claimed。');
    const g = f.geometry;
    if (!g || !['Polygon','MultiPolygon'].includes(g.type) || !Array.isArray(g.coordinates) || !g.coordinates.length) throw new Error('实控区域必须是 Polygon 或 MultiPolygon。');
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !polygon.length) throw new Error('空多边形。');
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4 || ring[0]?.[0] !== ring.at(-1)?.[0] || ring[0]?.[1] !== ring.at(-1)?.[1]) throw new Error('多边形边界必须闭合。');
        for (const p of ring) {
          if (!Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) throw new Error('坐标须为合法的经纬度 [经度, 纬度]。');
          if (++points > 1000000) throw new Error('地图坐标超过浏览器加载上限。');
        }
      }
    }
  }
  return data;
}
