const https = require('https');

exports.handler = async (event) => {
  const hdrs = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60'
  };
  try {
    const symbols = 'BTC-USD,GC=F,CL=F,NQ=F,MC.PA,RMS.PA';
    const data = await fetchQuotes(symbols);
    return { statusCode: 200, headers: hdrs, body: JSON.stringify(data) };
  } catch(err) {
    return { statusCode: 500, headers: hdrs, body: JSON.stringify({ error: err.message }) };
  }
};

function fetchQuotes(symbols) {
  return new Promise((resolve, reject) => {
    const path = '/v7/finance/quote?symbols=' + symbols + '&fields=regularMarketPrice,regularMarketChangePercent,shortName,currency';
    const options = {
      hostname: 'query1.finance.yahoo.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = (json.quoteResponse && json.quoteResponse.result) || [];
          const out = {};
          results.forEach(r => {
            const chg = r.regularMarketChangePercent || 0;
            out[r.symbol] = {
              price: r.regularMarketPrice || 0,
              change: Math.round(chg * 100) / 100,
              name: r.shortName || r.symbol
            };
          });
          resolve(out);
        } catch(e) {
          reject(new Error('Parse: ' + e.message + ' raw: ' + data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}
