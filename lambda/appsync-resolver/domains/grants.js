const { doc, T, GetCommand } = require('../dynamo');
const { requireSignedIn } = require('../auth');

async function myRoomGrant(identity, roomId) {
  const uid = requireSignedIn(identity);
  const r = await doc.send(new GetCommand({ TableName: T.roomGrants, Key: { roomId, uid } }));
  return r.Item || null;
}

module.exports = { myRoomGrant };
