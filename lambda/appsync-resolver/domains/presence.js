const { doc, T, GetCommand, PutCommand } = require('../dynamo');
const { requireSignedIn } = require('../auth');

async function getPresence(uid) {
  const r = await doc.send(new GetCommand({ TableName: T.presence, Key: { uid } }));
  return r.Item || null;
}

async function updatePresence(identity, room) {
  const uid = requireSignedIn(identity);
  const item = { uid, room: room || null, updatedAt: Date.now() };
  await doc.send(new PutCommand({ TableName: T.presence, Item: item }));
  return item;
}

module.exports = { getPresence, updatePresence };
