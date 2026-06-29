const { doc, T, GetCommand, PutCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');
const { getRoom } = require('./rooms');

async function getModeration(roomId) {
  const r = await doc.send(new GetCommand({ TableName: T.moderation, Key: { roomId } }));
  return r.Item || null;
}

async function updateModeration(identity, roomId, data) {
  const uid = requireSignedIn(identity);
  const room = await getRoom(roomId);
  if (!room) throw new GraphqlError('Room not found', 'NotFound');
  if (room.ownerUid !== uid && !isAdmin(identity)) {
    throw new GraphqlError('Only the room owner or admin can moderate this room', 'Forbidden');
  }
  const item = { roomId, data, updatedAt: Date.now() };
  await doc.send(new PutCommand({ TableName: T.moderation, Item: item }));
  return item;
}

module.exports = { getModeration, updateModeration };
