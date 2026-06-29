const { doc, T, GetCommand, PutCommand, DeleteCommand, QueryCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');
const { getRoom } = require('./rooms');

const SEAT_STALE_MS = 45000;

async function listRoomSeats(roomId) {
  const r = await doc.send(new QueryCommand({
    TableName: T.roomSeats, KeyConditionExpression: 'roomId = :r', ExpressionAttributeValues: { ':r': roomId },
  }));
  return r.Items || [];
}

async function claimSeat(identity, roomId, seat) {
  const uid = requireSignedIn(identity);
  const room = await getRoom(roomId);
  if (!room) throw new GraphqlError('Room not found', 'NotFound');
  if (seat < 1 || seat > room.max) throw new GraphqlError('Invalid seat number', 'BadRequest');

  const existing = await doc.send(new GetCommand({ TableName: T.roomSeats, Key: { roomId, seat } }));
  if (existing.Item && existing.Item.uid !== uid) {
    const stale = Date.now() - existing.Item.lastSeen > SEAT_STALE_MS;
    if (!stale) throw new GraphqlError('Seat is occupied', 'Forbidden');
  }
  const now = Date.now();
  const item = { roomId, seat, uid, joinedAt: now, lastSeen: now };
  await doc.send(new PutCommand({ TableName: T.roomSeats, Item: item }));
  return item;
}

async function releaseSeat(identity, roomId, seat) {
  const uid = requireSignedIn(identity);
  const existing = await doc.send(new GetCommand({ TableName: T.roomSeats, Key: { roomId, seat } }));
  if (existing.Item) {
    const room = await getRoom(roomId);
    const allowed = existing.Item.uid === uid || (room && room.ownerUid === uid) || isAdmin(identity);
    if (!allowed) throw new GraphqlError('Forbidden', 'Forbidden');
  }
  await doc.send(new DeleteCommand({ TableName: T.roomSeats, Key: { roomId, seat } }));
  return true;
}

async function heartbeatSeat(identity, roomId, seat) {
  const uid = requireSignedIn(identity);
  const existing = await doc.send(new GetCommand({ TableName: T.roomSeats, Key: { roomId, seat } }));
  if (!existing.Item || existing.Item.uid !== uid) throw new GraphqlError('You do not hold this seat', 'Forbidden');
  const item = { ...existing.Item, lastSeen: Date.now() };
  await doc.send(new PutCommand({ TableName: T.roomSeats, Item: item }));
  return item;
}

module.exports = { listRoomSeats, claimSeat, releaseSeat, heartbeatSeat, SEAT_STALE_MS };
