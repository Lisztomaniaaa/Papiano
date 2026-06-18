/*
 * Vercel Serverless Function — health check ("phase 1" plumbing).
 *
 * Proves the GitHub -> Vercel functions pipeline is live end to end: any file
 * under /api is auto-deployed by Vercel as an endpoint with zero config, so
 * this file becomes  GET https://<your-domain>/api/ping.
 *
 * Intentionally has NO dependencies and reads NO secrets, so it deploys and
 * responds even before any environment variable is set in the Vercel
 * dashboard. Real, privileged functions (ban user, send email, ...) come in
 * the next phase and must verify a Firebase ID token first — see ./README.md.
 */
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    service: 'papiano',
    runtime: 'vercel-serverless',
    method: req.method,
    time: new Date().toISOString(),
  });
};
