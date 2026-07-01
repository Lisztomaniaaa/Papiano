const crypto = require('crypto');
const { doc, T, GetCommand, PutCommand, DeleteCommand, ScanCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');
const { getProfile } = require('./profiles');

async function listDonations() {
  const r = await doc.send(new ScanCommand({ TableName: T.donations }));
  return r.Items || [];
}

async function upsertDonation(identity, donationId, name, amount, message) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  const item = { donationId: donationId || crypto.randomUUID(), name: name || null, amount: amount || 0, message: message || null, createdAt: Date.now() };
  await doc.send(new PutCommand({ TableName: T.donations, Item: item }));
  return item;
}

// Admin-panel donor ledger: cumulative total per user, keyed by uid (so
// repeated donations from the same person accumulate into one record).
async function addDonorAmount(identity, uid, amountDelta, currency, note) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  const delta = Number(amountDelta);
  if (!Number.isFinite(delta) || delta <= 0) throw new GraphqlError('amountDelta must be > 0', 'BadRequest');
  const profile = await getProfile(uid);
  if (!profile) throw new GraphqlError('User not found', 'NotFound');
  const existing = await doc.send(new GetCommand({ TableName: T.donations, Key: { donationId: uid } }));
  const total = Number(existing.Item?.total || 0) + delta;
  const item = {
    donationId: uid, uid, name: profile.name || null, userId: profile.userId || null, photoURL: profile.photoURL || null,
    total, currency: currency || 'USD', note: note || null, date: new Date().toISOString(), amount: total,
  };
  await doc.send(new PutCommand({ TableName: T.donations, Item: item }));
  return item;
}

async function removeDonor(identity, uid) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  await doc.send(new DeleteCommand({ TableName: T.donations, Key: { donationId: uid } }));
  return true;
}

module.exports = { listDonations, upsertDonation, addDonorAmount, removeDonor };
