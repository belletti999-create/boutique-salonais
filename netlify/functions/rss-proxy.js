const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  const hdrs = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: hdrs, body: '' };
  }
  const feedUrl = event.queryStringParameters && event.queryStringParameters.url;
  if (!feedUrl) {
    return { statusCode: 400, headers: hdrs, body: JSON.stringify({ error: 'Missing url' }) };
  }
  try {
    const xml = await fetchUrl(feedUrl);
    const items = parseRSS(xml);
    return { statusCode: 200, headers: hdrs, body: JSON.stringify({ status: 'ok', items }) };
  } catch (err) {
    return { statusCode: 500, headers: hdrs, body: JSON.stringify({ error: err.message }) };
  }
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/rss+xml, text/xml, */*'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function getTag(block, tag) {
  const open = '<' + tag;
  const close = '</' + tag + '>';
  const start = block.indexOf(open);
  if (start === -1) return '';
  const contentStart = block.indexOf('>', start) + 1;
  const end = block.indexOf(close, contentStart);
  if (end === -1) return '';
  let val = block.slice(contentStart, end).trim();
  if (val.startsWith('<![CDATA[') && val.endsWith(']]>')) {
    val = val.slice(9, val.length - 3).trim();
  }
  return val;
}

function parseRSS(xml) {
  const items = [];
  const parts = xml.split('<item');
  for (let i = 1; i < parts.length && items.length < 20; i++) {
    const closeIdx = parts[i].indexOf('</item>');
    const block = closeIdx > -1 ? parts[i].slice(0, closeIdx) : parts[i];
    const title = getTag(block, 'title');
    if (!title) continue;
    let link = getTag(block, 'link');
    if (!link) {
      const hrefIdx = block.indexOf('href=');
      if (hrefIdx > -1) {
        const q = block[hrefIdx + 5];
        const end = block.indexOf(q, hrefIdx + 6);
        link = block.slice(hrefIdx + 6, end);
      }
    }
    items.push({
      title: title,
      link: link,
      description: getTag(block, 'description') || getTag(block, 'summary') || '',
      pubDate: getTag(block, 'pubDate') || getTag(block, 'published') || getTag(block, 'dc:date') || ''
    });
  }
  return items;
}
