/*
 * Verifies a Cognito ID token using only Node built-ins (https + crypto) —
 * no extra npm dependency, so it doesn't require touching the shared Lambda
 * layer. Replaces the old firebase-admin verifyIdToken() used by
 * storage-presign / private-room / botchat before the Cognito migration.
 */
const https = require('https');
const crypto = require('crypto');

const REGION = 'ap-southeast-1';
const USER_POOL_ID = 'ap-southeast-1_f0EEaeXA4';
const CLIENT_ID = '6np9l79eo6om3dtm3f1kgghajn';
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
const JWKS_TTL_MS = 3600000;

let jwksCache = null;
let jwksCacheAt = 0;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function getJwks() {
  if (jwksCache && Date.now() - jwksCacheAt < JWKS_TTL_MS) return jwksCache;
  jwksCache = await fetchJson(JWKS_URL);
  jwksCacheAt = Date.now();
  return jwksCache;
}

function b64urlToBuf(s) {
  return Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function verifyIdToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const header = JSON.parse(b64urlToBuf(parts[0]).toString('utf8'));
  const payload = JSON.parse(b64urlToBuf(parts[1]).toString('utf8'));
  const signature = b64urlToBuf(parts[2]);
  const signedData = Buffer.from(parts[0] + '.' + parts[1]);

  const jwks = await getJwks();
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key');

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const verified = crypto.verify('RSA-SHA256', signedData, publicKey, signature);
  if (!verified) throw new Error('Invalid signature');

  if (payload.iss !== ISSUER) throw new Error('Invalid issuer');
  if (payload.token_use !== 'id') throw new Error('Not an ID token');
  if (payload.aud !== CLIENT_ID) throw new Error('Invalid audience');
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error('Token expired');

  return { uid: payload.sub, email: payload.email || '', name: payload.name || payload.given_name || '' };
}

module.exports = { verifyIdToken };
