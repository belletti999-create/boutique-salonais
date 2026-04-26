const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const feedUrl = event.queryStringParameters && event.queryStringParameters.url;
  if (!feedUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing url param' }) };
  }

  try {
    const xml = await fetchUrl(feedUrl);
    const items = parseRSS(xml);
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', items }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([sS]*?)</item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp('<' + tag + '[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/' + tag + '>', 'i'));
      return m ? m[1].trim() : '';
    };
    const getLinkAlt = () => {
      const m = block.match(/<link[^>]*>([^<]+)</link>|<link[^>]+href="([^"]+)"/i);
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title = get('title');
    if (!title) continue;
    items.push({
      title,
      link: get('link') || getLinkAlt(),
      description: get('description') || get('summary') || '',
      pubDate: get('pubDate') || get('published') || get('dc:date') || ''
    });
  }
  return items;
}
