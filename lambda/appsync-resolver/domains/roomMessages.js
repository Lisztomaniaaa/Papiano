const crypto = require('crypto');
const { doc, T, PutCommand, QueryCommand, DeleteCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');
const { getRoom } = require('./rooms');

async function listRoomMessages(roomId) {
  const r = await doc.send(new QueryCommand({
    TableName: T.roomMessages, KeyConditionExpression: 'roomId = :r', ExpressionAttributeValues: { ':r': roomId },
    ScanIndexForward: true, Limit: 200,
  }));
  return r.Items || [];
}

async function sendRoomMessage(identity, roomId, text) {
  const uid = requireSignedIn(identity);
  const room = await getRoom(roomId);
  if (!room) throw new GraphqlError('Room not found', 'NotFound');
  if (room.chatEnabled === false) throw new GraphqlError('Chat is disabled in this room', 'Forbidden');
  if (typeof text !== 'string' || text.length === 0 || text.length > 500) {
    throw new GraphqlError('text must be 1-500 chars', 'BadRequest');
  }
  const now = Date.now();
  const messageId = crypto.randomUUID();
  const item = {
    roomId,
    createdAt: `${String(now).padStart(13, '0')}#${messageId}`,
    messageId,
    playerId: uid,
    text,
  };
  await doc.send(new PutCommand({ TableName: T.roomMessages, Item: item }));
  return item;
}

async function deleteRoomMessages(identity, roomId) {
  const uid = requireSignedIn(identity);
  const room = await getRoom(roomId);
  if (!room) return true;
  if (room.ownerUid !== uid && !isAdmin(identity)) {
    throw new GraphqlError('Only the room owner or admin can clear chat', 'Forbidden');
  }
  const items = await listRoomMessages(roomId);
  for (const it of items) {
    await doc.send(new DeleteCommand({ TableName: T.roomMessages, Key: { roomId, createdAt: it.createdAt } }));
  }
  return true;
}

module.exports = { listRoomMessages, sendRoomMessage, deleteRoomMessages };
