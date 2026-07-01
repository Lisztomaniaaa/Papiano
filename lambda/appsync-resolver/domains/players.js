const { doc, T, GetCommand, PutCommand, DeleteCommand, QueryCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');
const { getRoom } = require('./rooms');
const { getProfile } = require('./profiles');

const PLAYER_STALE_MS = 45000;
const GRANT_TTL_MS = 60000;

async function listRoomPlayers(roomId) {
  const r = await doc.send(new QueryCommand({
    TableName: T.roomPlayers, KeyConditionExpression: 'roomId = :r', ExpressionAttributeValues: { ':r': roomId },
  }));
  return r.Items || [];
}

function applyPlayerInput(item, input) {
  if (!input) return item;
  const fields = ['instrumentKey', 'instrument', 'stringsEnabled', 'stringInstrumentKey', 'stringInstrument', 'seat', 'sessionId'];
  fields.forEach((f) => { if (input[f] !== undefined) item[f] = input[f]; });
  return item;
}

async function joinRoom(identity, roomId, grantToken, input) {
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
  const already = existing.find((p) => p.playerId === uid);
  const slotsTaken = existing.filter((p) => p.playerId !== uid).length;
  if (!already && slotsTaken >= room.max) {
    const stale = existing.find((p) => p.playerId !== uid && Date.now() - p.lastSeen > PLAYER_STALE_MS);
    if (!stale) throw new GraphqlError('Room is full', 'Forbidden');
  }

  const now = Date.now();
  const profile = await getProfile(uid);
  const item = {
    roomId, playerId: uid, joinedAt: already ? already.joinedAt : now, lastSeen: now,
    name: profile?.name || 'Papiano User', userId: profile?.userId || null, publicId: profile?.publicId || null,
    role: profile?.role || 'player', badgeId: profile?.role || 'player',
    photoURL: profile?.photoURL || null, countryCode: profile?.countryCode || null,
    bio: profile?.desc || null, likes: profile?.likes || 0, dislikes: profile?.dislikes || 0,
  };
  applyPlayerInput(item, input);
  await doc.send(new PutCommand({ TableName: T.roomPlayers, Item: item }));
  return item;
}

async function leaveRoom(identity, roomId, targetUid) {
  const uid = requireSignedIn(identity);
  let playerId = uid;
  if (targetUid && targetUid !== uid) {
    const room = await getRoom(roomId);
    if (!room || (room.ownerUid !== uid && !isAdmin(identity))) {
      throw new GraphqlError('Only the room owner or admin can remove another player', 'Forbidden');
    }
    playerId = targetUid;
  }
  await doc.send(new DeleteCommand({ TableName: T.roomPlayers, Key: { roomId, playerId } }));
  return true;
}

async function heartbeatPlayer(identity, roomId, input) {
  const uid = requireSignedIn(identity);
  const existing = await doc.send(new GetCommand({ TableName: T.roomPlayers, Key: { roomId, playerId: uid } }));
  if (!existing.Item) throw new GraphqlError('Not a player in this room', 'NotFound');
  const item = { ...existing.Item, lastSeen: Date.now() };
  applyPlayerInput(item, input);
  await doc.send(new PutCommand({ TableName: T.roomPlayers, Item: item }));
  return item;
}

module.exports = { listRoomPlayers, joinRoom, leaveRoom, heartbeatPlayer, PLAYER_STALE_MS };
