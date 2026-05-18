// netlify/functions/send-email.js
// Envoie les codes de tiroir par email via Brevo après paiement confirmé

exports.handler = async (event) => {

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, items } = JSON.parse(event.body || '{}');

  if (!email || !items || !items.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Paramètres manquants' }) };
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  // Construction des lignes de codes
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

  const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0d0806;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0806;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#130d08;border:1px solid rgba(200,160,122,0.2);border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1208,#2e2210);padding:32px 24px;text-align:center;border-bottom:1px solid rgba(200,160,122,0.2);">
            <div style="font-size:2rem;margin-bottom:8px;">♛</div>
            <h1 style="margin:0;font-family:'Georgia',serif;font-size:1.5rem;font-weight:400;letter-spacing:.1em;color:#ede4d8;">L'Appart Salonais</h1>
            <p style="margin:8px 0 0;font-size:.7rem;letter-spacing:.25em;text-transform:uppercase;color:#c8a07a;">Salon-de-Provence · Mini-Bar Privé</p>
          </td>
        </tr>

        <!-- Message -->
        <tr>
          <td style="padding:28px 24px 16px;text-align:center;">
            <div style="font-size:2rem;margin-bottom:12px;">🔑</div>
            <h2 style="margin:0 0 8px;font-family:'Georgia',serif;font-size:1.3rem;font-weight:400;color:#ede4d8;">Paiement Confirmé</h2>
            <p style="margin:0;font-size:.85rem;color:#6a5a50;line-height:1.6;">Merci pour votre commande. Voici vos codes d'accès au mini-bar.</p>
          </td>
        </tr>

        <!-- Codes table -->
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
              <tbody>
                ${codesHTML}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Note -->
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

        <!-- Footer -->
        <tr>
          <td style="background:#0d0806;padding:20px 24px;text-align:center;border-top:1px solid rgba(200,160,122,0.12);">
            <p style="margin:0;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#3a2a20;">
              ❖ &nbsp; L'Appart Salonais &nbsp;·&nbsp; Tous droits réservés &nbsp; ❖
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Appel API Brevo
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: "L'Appart Salonais",
        email: 'lappartsalonais@gmail.com',
      },
      to: [{ email }],
      subject: "🔑 Vos codes d'accès — L'Appart Salonais",
      htmlContent,
      textContent: `L'Appart Salonais — Vos codes d'accès :\n\n${codesTexte}\n\nMerci pour votre achat !`,
    }),
  });

  const result = await response.json();

  if (response.ok) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } else {
    console.error('Brevo error:', result);
    return { statusCode: 500, body: JSON.stringify({ error: result.message }) };
  }
};
