// Minimal dependency-free RSS/Atom/RDF parser — good enough for news feeds.
const ENT = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…',
};

export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

export function clean(s = '') {
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = decode(decode(s));
  s = s.replace(/<[^>]+>/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

export function parseFeed(xml) {
  const items = [];
  const re = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[2];
    const get = (tag) => {
      const r = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(b);
      return r ? clean(r[1]) : '';
    };
    let link = get('link');
    if (!link) {
      const l = /<link\b[^>]*href="([^"]+)"/i.exec(b);
      link = l ? decode(l[1]) : '';
    }
    const src = /<source\b[^>]*url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/i.exec(b);
    const imgs = [...b.matchAll(/<media:(?:thumbnail|content)\b[^>]*url="([^"]+)"/gi)].map((x) => x[1]);
    const enc = /<enclosure\b[^>]*url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i.exec(b);
    items.push({
      title: get('title'),
      link,
      desc: get('description') || get('summary'),
      date: get('pubDate') || get('dc:date') || get('published') || get('updated'),
      srcUrl: src ? decode(src[1]) : null,
      srcName: src ? clean(src[2]) : null,
      img: imgs.length ? decode(imgs.at(-1)) : enc ? decode(enc[1]) : null,
    });
  }
  return items;
}
