// Resolve Google News redirect links (news.google.com/rss/articles/…) to the publisher's own URL,
// so readers skip Google's interstitial and the data files shrink. Google encodes the target
// server-side: fetch the article page for its signature + timestamp, then ask the batchexecute
// endpoint for the URL. Results are cached in data/gnews.json, so each link is resolved once.
import fs from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const idOf = (u) => { try { const x = new URL(u); return x.hostname === 'news.google.com' ? x.pathname.split('/').pop() : null; } catch { return null; } };

async function decode(id) {
  const page = await fetch(`https://news.google.com/articles/${id}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
  if (page.status === 429) throw Object.assign(new Error('rate limited'), { stop: true });
  if (!page.ok) return null;
  const html = await page.text();
  const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1], ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sg || !ts) return null;
  const req = [[['Fbv4je', `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`, null, 'generic']]];
  const r = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'user-agent': UA },
    body: `f.req=${encodeURIComponent(JSON.stringify(req))}`,
  });
  if (r.status === 429) throw Object.assign(new Error('rate limited'), { stop: true });
  const url = (await r.text()).match(/garturlres\\",\\"(.*?)\\"/)?.[1];
  return url && /^https?:\/\//.test(url) && !url.includes('news.google.com') ? JSON.parse(`"${url}"`) : null;
}

// Rewrites story.u and story.src links in place. Unresolved links stay as Google links.
export async function resolveGoogleLinks(stories, cachePath, { budgetMs = 240000, concurrency = 2, pauseMs = 400, log = console.log } = {}) {
  let cache = {};
  try { cache = JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch {}
  // Most visible first: headline links of the highest-scored stories, then source chips.
  const wanted = new Set();
  const ranked = [...stories].sort((a, b) => b.sc - a.sc);
  for (const s of ranked) { const id = idOf(s.u); if (id) wanted.add(id); }
  for (const s of ranked) for (const [, u] of s.src) { const id = idOf(u); if (id) wanted.add(id); }
  const todo = [...wanted].filter((id) => !(id in cache));
  const start = Date.now();
  let i = 0, done = 0, stopped = '';
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < todo.length && !stopped) {
      if (Date.now() - start > budgetMs) { stopped = 'time budget'; break; }
      const id = todo[i++];
      try { const url = await decode(id); if (url) { cache[id] = url; done++; } }
      catch (e) { if (e.stop) stopped = e.message; }
      await new Promise((r) => setTimeout(r, pauseMs)); // Google rate-limits bursts
    }
  }));
  const fix = (u) => cache[idOf(u)] || u;
  let rewritten = 0;
  for (const s of stories) {
    const u = fix(s.u);
    if (u !== s.u) { s.u = u; rewritten++; }
    s.src = s.src.map((x) => (x[1] ? [x[0], fix(x[1])] : x));
  }
  // Keep only links still in use so the cache doesn't grow forever.
  const pruned = Object.fromEntries([...wanted].filter((id) => id in cache).map((id) => [id, cache[id]]));
  await fs.writeFile(cachePath, JSON.stringify(pruned));
  log(`Google News links: ${wanted.size} in use, ${done} newly resolved, ${todo.length - done} unresolved${stopped ? ` (stopped: ${stopped})` : ''}; ${rewritten} headlines now link direct.`);
}
