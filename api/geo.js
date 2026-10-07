// Função da Vercel: identifica o país do visitante (cabeçalho de geolocalização da própria Vercel,
// o IP não é enviado a terceiros) e devolve a moeda local + cotações a partir do USD.
// Cotações: https://www.exchangerate-api.com (acesso aberto, atualização diária), em cache por 6 h.

const EURO = ['AT','BE','HR','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES','AD','MC','SM','VA','ME','XK'];
const COUNTRY_CURRENCY = Object.assign(
  Object.fromEntries(EURO.map(c => [c, 'EUR'])),
  {
    US: 'USD', GB: 'GBP', GG: 'GBP', JE: 'GBP', IM: 'GBP', CA: 'CAD', AU: 'AUD', NZ: 'NZD',
    CH: 'CHF', LI: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', FO: 'DKK', GL: 'DKK', PL: 'PLN',
    CZ: 'CZK', HU: 'HUF', RO: 'RON', TR: 'TRY', BR: 'BRL', MX: 'MXN', CO: 'COP', CL: 'CLP',
    PE: 'PEN', IN: 'INR', JP: 'JPY', KR: 'KRW', SG: 'SGD', HK: 'HKD', PH: 'PHP', MY: 'MYR',
    TH: 'THB', ID: 'IDR', AE: 'AED', SA: 'SAR', IL: 'ILS', ZA: 'ZAR'
  }
);
const SUPPORTED = Array.from(new Set(['USD'].concat(Object.values(COUNTRY_CURRENCY))));

const TTL = 6 * 60 * 60 * 1000;
let cache = null;

async function getRates() {
  if (cache && Date.now() - cache.t < TTL) return cache.rates;
  const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000) });
  const j = await r.json();
  if (j.result !== 'success' || !j.rates) throw new Error('rates unavailable');
  const rates = {};
  SUPPORTED.forEach(c => { if (typeof j.rates[c] === 'number') rates[c] = j.rates[c]; });
  rates.USD = 1;
  cache = { t: Date.now(), rates };
  return rates;
}

// Marcação do anúncio (?c=gb) tem prioridade sobre o IP; "uk" é aceito como Reino Unido.
function linkCountry(req) {
  let c = '';
  try { c = new URL(req.url, 'http://localhost').searchParams.get('c') || ''; } catch (e) {}
  c = c.trim().toUpperCase();
  if (c === 'UK') c = 'GB';
  return /^[A-Z]{2}$/.test(c) && COUNTRY_CURRENCY[c] ? c : '';
}

module.exports = async (req, res) => {
  const fromLink = linkCountry(req);
  const country = fromLink || String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const source = fromLink ? 'link' : 'ip';
  const local = COUNTRY_CURRENCY[country] || 'USD';
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const rates = await getRates();
    res.status(200).json({ country, source, currency: rates[local] ? local : 'USD', rates });
  } catch (e) {
    // Sem cotação: a página continua em USD
    res.status(200).json({ country, source, currency: 'USD', rates: { USD: 1 } });
  }
};
