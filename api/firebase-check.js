/*
 * Vercel Serverless Function — Firebase env-var check.
 *
 * Confirms the FIREBASE_SERVICE_ACCOUNT environment variable (set in the Vercel
 * dashboard, never in the repo) is present, is valid JSON, and looks like a
 * real service-account key. It only inspects the SHAPE of the credential — it
 * never returns the private key or any secret. The full cryptographic check
 * happens when the first real admin function runs.
 *
 *   GET https://<your-domain>/api/firebase-check   ->   { "ok": true, ... }
 *
 * Temporary diagnostic — safe to delete once it returns ok:true.
 */
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    return res.status(500).json({
      ok: false,
      reason: 'FIREBASE_SERVICE_ACCOUNT is not set. Add it in Vercel -> Settings -> Environment Variables (Production + Preview), then redeploy.',
    });
  }

  let svc;
  try {
    svc = JSON.parse(raw);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      reason: 'FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON. Paste the ENTIRE file contents (Ctrl+A) as the value.',
    });
  }

  const checks = {
    isServiceAccount: svc.type === 'service_account',
    hasPrivateKey:
      typeof svc.private_key === 'string' &&
      svc.private_key.includes('BEGIN PRIVATE KEY') &&
      svc.private_key.includes('END PRIVATE KEY'),
    hasClientEmail: typeof svc.client_email === 'string' && svc.client_email.includes('@'),
    hasProjectId: typeof svc.project_id === 'string' && svc.project_id.length > 0,
  };

  const ok = Object.values(checks).every(Boolean);
  return res.status(ok ? 200 : 500).json({
    ok,
    checks,
    projectId: svc.project_id || null,
    time: new Date().toISOString(),
  });
};
