const crypto = require('crypto');
const { doc, T, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');

const SEAT_STALE_MS = 45000;

async function getRoom(roomId) {
  const r = await doc.send(new GetCommand({ TableName: T.rooms, Key: { roomId } }));
  return r.Item || null;
}

async function listPublicRooms() {
  const r = await doc.send(new QueryCommand({
    TableName: T.rooms, IndexName: 'ModeIndex',
    KeyConditionExpression: '#m = :m',
    ExpressionAttributeNames: { '#m': 'mode' },
    ExpressionAttributeValues: { ':m': 'Public' },
  }));
  return r.Items || [];
}

function clampName(s, max) {
  if (typeof s !== 'string') return s;
  return s.slice(0, max);
}

async function createRoom(identity, input) {
  const uid = requireSignedIn(identity);
  const max = input.max;
  if (!Number.isInteger(max) || max < 2 || max > 6) {
    throw new GraphqlError('max must be 2-6', 'BadRequest');
  }
  if (!['Public', 'Private'].includes(input.mode)) {
    throw new GraphqlError('mode must be Public or Private', 'BadRequest');
  }
  const roomId = crypto.randomUUID();
  const now = Date.now();
  const roomNumber = Math.floor(100000 + Math.random() * 900000);
  const item = {
    roomId,
    roomNumber,
    name: clampName(input.name, 60),
    owner: clampName(input.owner, 80),
    ownerUid: uid,
    mode: input.mode,
    max,
    count: 0,
    activeCount: 0,
    chatEnabled: input.chatEnabled !== false,
    createdAt: now,
    updatedAt: now,
  };
  await doc.send(new PutCommand({
    TableName: T.rooms, Item: item,
    ConditionExpression: 'attribute_not_exists(roomId)',
  }));
  return item;
}

async function updateRoom(identity, roomId, input) {
  const uid = requireSignedIn(identity);
  const room = await getRoom(roomId);
  if (!room) throw new GraphqlError('Room not found', 'NotFound');
  if (room.ownerUid !== uid && !isAdmin(identity)) {
    throw new GraphqlError('Only the room owner or admin can update this room', 'Forbidden');
  }
  const now = Date.now();
  const sets = ['updatedAt = :u'];
  const vals = { ':u': now };
  const names = {};
  if (input.name !== undefined) { sets.push('#n = :name'); names['#n'] = 'name'; vals[':name'] = clampName(input.name, 60); }
  if (input.mode !== undefined) {
    if (!['Public', 'Private'].includes(input.mode)) throw new GraphqlError('mode must be Public or Private', 'BadRequest');
    sets.push('#mo = :mode'); names['#mo'] = 'mode'; vals[':mode'] = input.mode;
  }
  if (input.count !== undefined) {
    if (input.count > room.max) throw new GraphqlError('count cannot exceed max', 'BadRequest');
    sets.push('#c = :count'); names['#c'] = 'count'; vals[':count'] = input.count;
  }
  if (input.activeCount !== undefined) {
    if (input.activeCount > room.max) throw new GraphqlError('activeCount cannot exceed max', 'BadRequest');
    sets.push('activeCount = :ac'); vals[':ac'] = input.activeCount;
  }
  if (input.chatEnabled !== undefined) { sets.push('chatEnabled = :ce'); vals[':ce'] = input.chatEnabled; }

  const r = await doc.send(new UpdateCommand({
    TableName: T.rooms, Key: { roomId },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    ExpressionAttributeValues: vals,
    ReturnValues: 'ALL_NEW',
  }));
  return r.Attributes;
}

async function deleteRoom(identity, roomId) {
  const uid = requireSignedIn(identity);
  const room = await getRoom(roomId);
  if (!room) return true;
  const ownerOrAdmin = room.ownerUid === uid || isAdmin(identity);
  if (!ownerOrAdmin) {
    if (room.count > 0) {
      throw new GraphqlError('Cannot delete a room that still has players', 'Forbidden');
    }
  }
  await doc.send(new DeleteCommand({ TableName: T.rooms, Key: { roomId } }));
  return true;
}

module.exports = { getRoom, listPublicRooms, createRoom, updateRoom, deleteRoom, SEAT_STALE_MS };
