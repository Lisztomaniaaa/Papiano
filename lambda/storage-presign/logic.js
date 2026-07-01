/*
 * Lambda port of api/storage-presign.js — issues a short-lived presigned S3
 * PUT URL for avatar and chat-image uploads. Logic is identical to the
 * Vercel version; only the require path for the admin helper differs.
 */
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { verifyIdToken } = require('./_cognito');

const BUCKET = process.env.AWS_S3_BUCKET || 'papiano-storage';
const REGION = process.env.AWS_REGION || 'ap-southeast-1';
const ALLOWED_PREFIXES = new Set(['avatars', 'chat-images']);
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PRESIGN_EXPIRES_SECONDS = 60;

let s3Client = null;
function getS3() {
  if (!s3Client) s3Client = new S3Client({ region: REGION });
  return s3Client;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function sanitizeSegment(value, fallback) {
  const clean = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_')
    .replace(/_+/g, '_')
    .slice(-90);
  return clean || fallback;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reason: 'POST only' });
  }

  try {
    const body = await readBody(req);
    const idToken = String(body?.idToken || '');
    const prefix = String(body?.bucket || '');
    const contentType = String(body?.contentType || '').toLowerCase();
    const folder = sanitizeSegment(body?.folder, 'uploads');
    const fileName = sanitizeSegment(body?.fileName, 'image');

    if (!idToken) return res.status(400).json({ ok: false, reason: 'missing fields' });
    if (!ALLOWED_PREFIXES.has(prefix)) return res.status(400).json({ ok: false, reason: 'bad bucket' });
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) return res.status(400).json({ ok: false, reason: 'bad content type' });

    let uid;
    try {
      const decoded = await verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (e) {
      return res.status(401).json({ ok: false, reason: 'bad token' });
    }

    const safeUid = sanitizeSegment(uid, 'user');
    const key = `${prefix}/${safeUid}/${folder}/${fileName}`;

    const uploadUrl = await getSignedUrl(getS3(), new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }), { expiresIn: PRESIGN_EXPIRES_SECONDS });

    const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    return res.status(200).json({ ok: true, uploadUrl, publicUrl, key });
  } catch (e) {
    console.error('storage-presign error', e?.message || e);
    return res.status(500).json({ ok: false, reason: 'server error' });
  }
};
