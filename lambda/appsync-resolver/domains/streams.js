const { doc, T, GetCommand, PutCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');
const { getRoom } = require('./rooms');

async function updateStream(identity, roomId, playerId, p) {
  const uid = requireSignedIn(identity);
  const room = await getRoom(roomId);
  if (!room) throw new GraphqlError('Room not found', 'NotFound');
  if (uid !== playerId && room.ownerUid !== uid && !isAdmin(identity)) {
    throw new GraphqlError('Forbidden', 'Forbidden');
  }
  const item = { roomId, playerId, p, updatedAt: Date.now() };
  await doc.send(new PutCommand({ TableName: T.streams, Item: item }));
  return item;
}

module.exports = { updateStream };
