const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  // Vérification signature Stripe
  const sig = event.headers['stripe-signature'];
  const rawBody = event.body;

  let stripeEvent;
  try {
    // Reconstruire la signature manuellement
    const parts = sig.split(',').reduce((acc, part) => {
      const [key, val] = part.split('=');
      acc[key] = val;
      return acc;
    }, {});
    const timestamp = parts['t'];
    const expectedSig = crypto
      .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    if (expectedSig !== parts['v1']) {
      console.error('Signature invalide');
      return { statusCode: 400, body: 'Signature invalide' };
    }
    stripeEvent = JSON.parse(rawBody);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Traiter uniquement les paiements réussis
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    const email = session.metadata?.email || session.customer_details?.email;
    let items = [];
    try {
      items = JSON.parse(session.metadata?.items || '[]');
    } catch {
      console.error('Impossible de parser les items');
      return { statusCode: 200, body: 'OK' };
    }

    if (!email || !items.length) {
      console.error('Email ou items manquants', { email, items });
      return { statusCode: 200, body: 'OK' };
    }

    // Construction du HTML email (même style que send-email.js)
    const codesHTML = items.map(p => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #2a1e08;">
          <span style="font-size:1rem;">${p.emoji || '🛒'}</span>
          <strong style="color:#ede4d8;margin-left:8px;">${p.name}</strong>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #2a1e08;text-align:center;color:#c8a07a;font-family:'Georgia',serif;font-size:.85rem;">
          Tiroir N° ${p.tiroir}
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #2a1e08;text-align:center;">
          <span style="font-family:'Courier New',monospace;font-size:1.6rem;font-weight:700;color:#e2c09a;letter-spacing:.2em;">${p.code}</span>
        </td>
      </tr>
    `).join('');

    const codesTexte = items.map(p => `${p.name} → Tiroir ${p.tiroir} → Code : ${p.code}`).join('\n');

    const htmlContent = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d0806;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0806;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#130d08;border:1px solid rgba(200,160,122,0.2);border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1208,#2e2210);padding:32px 24px;text-align:center;border-bottom:1px solid rgba(200,160,122,0.2);">
            <div style="font-size:2rem;margin-bottom:8px;">♛</div>
            <h1 style="margin:0;font-family:'Georgia',serif;font-size:1.5rem;font-weight:400;letter-spacing:.1em;color:#ede4d8;">L'Appart Salonais</h1>
            <p style="margin:8px 0 0;font-size:.7rem;letter-spacing:.25em;text-transform:uppercase;color:#c8a07a;">Salon-de-Provence · Mini-Bar Privé</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px 16px;text-align:center;">
            <div style="font-size:2rem;margin-bottom:12px;">🔑</div>
            <h2 style="margin:0 0 8px;font-size:1.3rem;font-weight:400;color:#ede4d8;">Paiement Confirmé</h2>
            <p style="margin:0;font-size:.85rem;color:#6a5a50;line-height:1.6;">Merci pour votre commande. Voici vos codes d'accès au mini-bar.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1c1108;border:1px solid rgba(200,160,122,0.18);border-radius:12px;overflow:hidden;">
              <thead>
                <tr style="background:#241608;">
                  <th style="padding:10px 16px;text-align:left;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#c8a07a;font-weight:400;">Produit</th>
                  <th style="padding:10px 16px;text-align:center;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#c8a07a;font-weight:400;">Tiroir</th>
                  <th style="padding:10px 16px;text-align:center;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#c8a07a;font-weight:400;">Code</th>
                </tr>
              </thead>
              <tbody>${codesHTML}</tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 24px;">
            <div style="background:rgba(200,160,122,0.08);border:1px solid rgba(200,160,122,0.18);border-radius:10px;padding:14px 16px;text-align:center;">
              <p style="margin:0;font-size:.78rem;color:#c8a07a;line-height:1.6;">
                📱 Entrez le code sur le clavier du tiroir pour l'ouvrir.<br/>
                <span style="color:#6a5a50;font-size:.72rem;">Conservez cet email comme justificatif de votre achat.</span>
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#0d0806;padding:20px 24px;text-align:center;border-top:1px solid rgba(200,160,122,0.12);">
            <p style="margin:0;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#3a2a20;">❖ &nbsp; L'Appart Salonais &nbsp;·&nbsp; Tous droits réservés &nbsp; ❖</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: "L'Appart Salonais", email: 'lappartsalonais@gmail.com' },
        to: [{ email }],
        subject: "🔑 Vos codes d'accès — L'Appart Salonais",
        htmlContent,
        textContent: `L'Appart Salonais — Vos codes d'accès :\n\n${codesTexte}\n\nMerci pour votre achat !`,
      }),
    });

    const result = await brevoRes.json();
    if (!brevoRes.ok) console.error('Brevo error:', result);
    else console.log('Email envoyé à', email);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
