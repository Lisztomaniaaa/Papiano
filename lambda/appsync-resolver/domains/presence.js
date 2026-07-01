const { doc, T, GetCommand, PutCommand, ScanCommand } = require('../dynamo');
const { requireSignedIn } = require('../auth');
const { getProfile } = require('./profiles');

const PRESENCE_STALE_MS = 90000;

async function getPresence(uid) {
  const r = await doc.send(new GetCommand({ TableName: T.presence, Key: { uid } }));
  return r.Item || null;
}

async function listPresence(windowSeconds) {
  const cutoff = Date.now() - (windowSeconds ? windowSeconds * 1000 : PRESENCE_STALE_MS);
  const r = await doc.send(new ScanCommand({
    TableName: T.presence,
    FilterExpression: 'updatedAt > :c',
    ExpressionAttributeValues: { ':c': cutoff },
  }));
  return r.Items || [];
}

async function updatePresence(identity, room) {
  const uid = requireSignedIn(identity);
  const profile = await getProfile(uid);
  const item = {
    uid, room: room || null, updatedAt: Date.now(),
    name: profile?.name || 'Papiano User', photoURL: profile?.photoURL || null,
    role: profile?.role || 'player', countryCode: profile?.countryCode || null,
  };
  await doc.send(new PutCommand({ TableName: T.presence, Item: item }));
  return item;
}

module.exports = { getPresence, listPresence, updatePresence };
