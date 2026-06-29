const crypto = require('crypto');
const { doc, T, PutCommand, ScanCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');

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

module.exports = { listDonations, upsertDonation };
