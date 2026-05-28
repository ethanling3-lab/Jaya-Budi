// submit-inquiry.js — Netlify Function
// Receives form data, saves to Supabase, sends emails via Resend

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email, phone, programme, message, language } = data;

  // Validate required fields
  if (!name || !email || !phone) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Name, email, and phone are required.' })
    };
  }

  const SUPABASE_URL    = process.env.SUPABASE_URL;
  const SUPABASE_KEY    = process.env.SUPABASE_ANON_KEY;
  const RESEND_API_KEY  = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL    = process.env.NOTIFY_EMAIL || 'info@jayabudi.com';

  // ── 1. Insert lead into Supabase ────────────────────────────
  try {
    const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        programme: programme || 'No Preference',
        message: message || '',
        language: language || 'en',
        status: 'New'
      })
    });

    if (!supaRes.ok) {
      const err = await supaRes.text();
      console.error('Supabase error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error. Please try again.' }) };
    }
  } catch (err) {
    console.error('Supabase fetch failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Database unreachable.' }) };
  }

  // ── 2. Send emails via Resend ────────────────────────────────
  if (RESEND_API_KEY) {
    const formattedDate = new Date().toLocaleDateString('en-MY', {
      day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'Asia/Kuala_Lumpur'
    });

    // Notification to team
    const notifyHtml = `
      <div style="font-family:'Georgia',serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#F6F4EF;color:#1F1F1F;">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8A847A;margin-bottom:24px;">New Inquiry — ${formattedDate}</p>
        <h1 style="font-size:22px;font-weight:400;margin-bottom:24px;">Jaya Budi Education</h1>
        <hr style="border:none;border-top:1px solid #D8D2C6;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:2;">
          <tr><td style="color:#8A847A;width:120px;">Name</td><td>${name}</td></tr>
          <tr><td style="color:#8A847A;">Email</td><td>${email}</td></tr>
          <tr><td style="color:#8A847A;">WhatsApp</td><td>${phone}</td></tr>
          <tr><td style="color:#8A847A;">Programme</td><td>${programme || 'No Preference'}</td></tr>
          <tr><td style="color:#8A847A;">Language</td><td>${language === 'zh' ? '中文' : 'English'}</td></tr>
          ${message ? `<tr><td style="color:#8A847A;vertical-align:top;padding-top:4px;">Message</td><td>${message}</td></tr>` : ''}
        </table>
        <hr style="border:none;border-top:1px solid #D8D2C6;margin-top:24px;margin-bottom:16px;">
        <p style="font-size:12px;color:#8A847A;">Reply directly to this email to contact the lead.</p>
      </div>
    `;

    // Auto-reply to visitor
    const isZh = language === 'zh';
    const autoReplyHtml = isZh ? `
      <div style="font-family:'Georgia',serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#F6F4EF;color:#1F1F1F;">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8A847A;margin-bottom:24px;">Jaya Budi Education</p>
        <h1 style="font-size:22px;font-weight:400;margin-bottom:24px;">感谢您的来访，${name}</h1>
        <hr style="border:none;border-top:1px solid #D8D2C6;margin-bottom:24px;">
        <p style="font-size:14px;line-height:1.9;color:#2E2E2E;">我们已收到您的询问，团队将在一个工作日内与您联系。</p>
        <p style="font-size:14px;line-height:1.9;color:#2E2E2E;margin-top:12px;">如有紧急事宜，欢迎直接发送电邮至 <a href="mailto:info@jayabudi.com" style="color:#6E6A4F;">info@jayabudi.com</a>。</p>
        <hr style="border:none;border-top:1px solid #D8D2C6;margin-top:32px;margin-bottom:16px;">
        <p style="font-size:12px;color:#8A847A;">Jaya Budi Education Sdn. Bhd. &nbsp;·&nbsp; Kuala Lumpur, Malaysia</p>
      </div>
    ` : `
      <div style="font-family:'Georgia',serif;max-width:520px;margin:0 auto;padding:40px 32px;background:#F6F4EF;color:#1F1F1F;">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8A847A;margin-bottom:24px;">Jaya Budi Education</p>
        <h1 style="font-size:22px;font-weight:400;margin-bottom:24px;">Thank you, ${name}</h1>
        <hr style="border:none;border-top:1px solid #D8D2C6;margin-bottom:24px;">
        <p style="font-size:14px;line-height:1.9;color:#2E2E2E;">We have received your inquiry and will be in touch within one business day.</p>
        <p style="font-size:14px;line-height:1.9;color:#2E2E2E;margin-top:12px;">For urgent matters, please write to us directly at <a href="mailto:info@jayabudi.com" style="color:#6E6A4F;">info@jayabudi.com</a>.</p>
        <hr style="border:none;border-top:1px solid #D8D2C6;margin-top:32px;margin-bottom:16px;">
        <p style="font-size:12px;color:#8A847A;">Jaya Budi Education Sdn. Bhd. &nbsp;·&nbsp; Kuala Lumpur, Malaysia</p>
      </div>
    `;

    await Promise.allSettled([
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Jaya Budi Education <noreply@jayabudi.com>`,
          to: [NOTIFY_EMAIL],
          reply_to: email,
          subject: `New Inquiry — ${name}`,
          html: notifyHtml
        })
      }),
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Jaya Budi Education <info@jayabudi.com>`,
          to: [email],
          subject: isZh ? '感谢您联系嘉宝迪教育' : 'Thank you for reaching out — Jaya Budi Education',
          html: autoReplyHtml
        })
      })
    ]);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  };
};
