exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe non configuré' }) };
  }

  let items;
  try {
    ({ items } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Requête invalide' }) };
  }

  const body = new URLSearchParams();
  body.append('mode', 'payment');
  body.append('success_url', process.env.URL + '?commande=ok');
  body.append('cancel_url', process.env.URL);

  items.forEach((item, i) => {
    body.append(`line_items[${i}][price_data][currency]`, 'eur');
    body.append(`line_items[${i}][price_data][product_data][name]`, item.name);
    body.append(`line_items[${i}][price_data][unit_amount]`, Math.round(item.price * 100));
    body.append(`line_items[${i}][quantity]`, 1);
  });

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const session = await response.json();

  if (session.url) {
    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } else {
    return { statusCode: 500, body: JSON.stringify({ error: session.error?.message || 'Erreur Stripe' }) };
  }
};
