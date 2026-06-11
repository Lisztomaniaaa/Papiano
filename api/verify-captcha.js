// Vercel serverless function — reCAPTCHA v2 server-side verification
// Secret key stored here (server-side only, never sent to browser).
// Optionally set env var RECAPTCHA_SECRET in Vercel dashboard to override.

const RECAPTCHA_SECRET =
    process.env.RECAPTCHA_SECRET || '6LejzhgtAAAAAGFSZ5OXB7vUOiUfsOYOd_AYYD9w';

module.exports = async function handler(req, res) {
    // CORS — only allow same origin
    const origin = req.headers.origin || '';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false });

    const token = req.body?.token;
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ success: false, error: 'missing_token' });
    }

    try {
        const params = new URLSearchParams({
            secret: RECAPTCHA_SECRET,
            response: token,
            remoteip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        });

        const verifyResp = await fetch(
            'https://www.google.com/recaptcha/api/siteverify',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            }
        );

        if (!verifyResp.ok) {
            return res.status(502).json({ success: false, error: 'upstream_error' });
        }

        const data = await verifyResp.json();
        return res.status(200).json({ success: !!data.success });
    } catch (err) {
        console.error('[verify-captcha]', err);
        return res.status(500).json({ success: false, error: 'server_error' });
    }
};
