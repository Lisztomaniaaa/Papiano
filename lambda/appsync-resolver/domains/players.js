const { doc, T, GetCommand, PutCommand, DeleteCommand, QueryCommand } = require('../dynamo');
const { requireSignedIn, GraphqlError } = require('../auth');
const { getRoom } = require('./rooms');

const PLAYER_STALE_MS = 45000;
const GRANT_TTL_MS = 60000;

async function listRoomPlayers(roomId) {
  const r = await doc.send(new QueryCommand({
    TableName: T.roomPlayers, KeyConditionExpression: 'roomId = :r', ExpressionAttributeValues: { ':r': roomId },
  }));
  return r.Items || [];
}

async function joinRoom(identity, roomId, grantToken) {
  const uid = requireSignedIn(identity);
  const room = await getRoom(roomId);
  if (!room) throw new GraphqlError('Room not found', 'NotFound');

  if (room.mode === 'Private' && room.ownerUid !== uid) {
    const g = await doc.send(new GetCommand({ TableName: T.roomGrants, Key: { roomId, uid } }));
    const grantedAt = g.Item && g.Item.grantedAt;
    if (!grantedAt || Date.now() - grantedAt > GRANT_TTL_MS) {
      throw new GraphqlError('Missing or expired room grant', 'Forbidden');
    }
  }

  const existing = await listRoomPlayers(roomId);
  const slotsTaken = existing.filter((p) => p.playerId !== uid).length;
  if (slotsTaken >= room.max) {
    const stale = existing.find((p) => p.playerId !== uid && Date.now() - p.lastSeen > PLAYER_STALE_MS);
    if (!stale) throw new GraphqlError('Room is full', 'Forbidden');
  }

  const now = Date.now();
  const item = { roomId, playerId: uid, joinedAt: now, lastSeen: now };
  await doc.send(new PutCommand({ TableName: T.roomPlayers, Item: item }));
  return item;
}

async function leaveRoom(identity, roomId) {
  const uid = requireSignedIn(identity);
  await doc.send(new DeleteCommand({ TableName: T.roomPlayers, Key: { roomId, playerId: uid } }));
  return true;
}

async function heartbeatPlayer(identity, roomId) {
  const uid = requireSignedIn(identity);
  const existing = await doc.send(new GetCommand({ TableName: T.roomPlayers, Key: { roomId, playerId: uid } }));
  if (!existing.Item) throw new GraphqlError('Not a player in this room', 'NotFound');
  const item = { ...existing.Item, lastSeen: Date.now() };
  await doc.send(new PutCommand({ TableName: T.roomPlayers, Item: item }));
  return item;
}

module.exports = { listRoomPlayers, joinRoom, leaveRoom, heartbeatPlayer, PLAYER_STALE_MS };
