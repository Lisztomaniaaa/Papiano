const rooms = require('./domains/rooms');
const players = require('./domains/players');
const seats = require('./domains/seats');
const presence = require('./domains/presence');
const roomMessages = require('./domains/roomMessages');
const streams = require('./domains/streams');
const moderation = require('./domains/moderation');
const roles = require('./domains/roles');
const grants = require('./domains/grants');
const profiles = require('./domains/profiles');
const chat = require('./domains/chat');
const friendships = require('./domains/friendships');
const blocks = require('./domains/blocks');
const reports = require('./domains/reports');
const donations = require('./domains/donations');
const { requireSignedIn } = require('./auth');

const handlers = {
  Query: {
    getRoom: (id, a) => rooms.getRoom(a.roomId),
    listPublicRooms: () => rooms.listPublicRooms(),
    listRoomPlayers: (id, a) => players.listRoomPlayers(a.roomId),
    listRoomSeats: (id, a) => seats.listRoomSeats(a.roomId),
    getPresence: (id, a) => presence.getPresence(a.uid),
    listRoomMessages: (id, a) => roomMessages.listRoomMessages(a.roomId),
    getModeration: (id, a) => moderation.getModeration(a.roomId),
    listRoles: (id, a, identity) => roles.listRoles(identity),
    getDeletedAccount: (id, a, identity) => roles.getDeletedAccount(identity, a.uid),
    myRoomGrant: (id, a, identity) => grants.myRoomGrant(identity, a.roomId),

    getProfile: (id, a) => profiles.getProfile(a.uid),
    searchProfilesByName: (id, a) => profiles.searchProfilesByName(a.prefix),
    getLeaderboard: (id, a) => profiles.getLeaderboard(a.windowSeconds),
    myProfileReaction: (id, a, identity) => profiles.myProfileReaction(identity, a.profileUid),

    listMyChatRooms: (id, a, identity) => chat.listMyChatRooms(identity),
    getChatRoom: (id, a) => chat.getChatRoom(a.roomId),
    listChatMessages: (id, a) => chat.listChatMessages(a.roomId, a.limit),

    listMyFriends: (id, a, identity) => friendships.listMyFriends(identity),
    listIncomingFriendRequests: (id, a, identity) => friendships.listIncomingFriendRequests(identity),
    listMyBlocks: (id, a, identity) => blocks.listMyBlocks(identity),

    listMyReports: (id, a, identity) => reports.listMyReports(identity),
    listAllReports: (id, a, identity) => reports.listAllReports(identity),

    listDonations: () => donations.listDonations(),
  },
  Mutation: {
    createRoom: (id, a, identity) => rooms.createRoom(identity, a.input),
    updateRoom: (id, a, identity) => rooms.updateRoom(identity, a.roomId, a.input),
    deleteRoom: (id, a, identity) => rooms.deleteRoom(identity, a.roomId),

    joinRoom: (id, a, identity) => players.joinRoom(identity, a.roomId, a.grantToken),
    leaveRoom: (id, a, identity) => players.leaveRoom(identity, a.roomId),
    heartbeatPlayer: (id, a, identity) => players.heartbeatPlayer(identity, a.roomId),

    claimSeat: (id, a, identity) => seats.claimSeat(identity, a.roomId, a.seat),
    releaseSeat: (id, a, identity) => seats.releaseSeat(identity, a.roomId, a.seat),
    heartbeatSeat: (id, a, identity) => seats.heartbeatSeat(identity, a.roomId, a.seat),

    updatePresence: (id, a, identity) => presence.updatePresence(identity, a.room),

    sendRoomMessage: (id, a, identity) => roomMessages.sendRoomMessage(identity, a.roomId, a.text),
    deleteRoomMessages: (id, a, identity) => roomMessages.deleteRoomMessages(identity, a.roomId),

    updateStream: (id, a, identity) => streams.updateStream(identity, a.roomId, a.playerId || requireSignedIn(identity), a.p),

    updateModeration: (id, a, identity) => moderation.updateModeration(identity, a.roomId, a.data),

    setRole: (id, a, identity) => roles.setRole(identity, a.uid, a.role),
    setDeletedAccount: (id, a, identity) => roles.setDeletedAccount(identity, a.uid, a.reason),

    createProfile: (id, a, identity) => profiles.createProfile(identity, a.input),
    updateProfile: (id, a, identity) => profiles.updateProfile(identity, a.uid, a.input),
    voteProfile: (id, a, identity) => profiles.voteProfile(identity, a.uid, a.type),

    createChatRoom: (id, a, identity) => chat.createChatRoom(identity, a.input),
    updateChatRoom: (id, a, identity) => chat.updateChatRoom(identity, a.roomId, a.participants),
    sendChatMessage: (id, a, identity) => chat.sendChatMessage(identity, a.roomId, a.input),
    editChatMessage: (id, a, identity) => chat.editChatMessage(identity, a.roomId, a.createdAt, a.text),
    hideChatMessageForMe: (id, a, identity) => chat.hideChatMessageForMe(identity, a.roomId, a.createdAt),
    deleteChatMessage: (id, a, identity) => chat.deleteChatMessage(identity, a.roomId, a.createdAt),

    sendFriendRequest: (id, a, identity) => friendships.sendFriendRequest(identity, a.otherUid),
    acceptFriendRequest: (id, a, identity) => friendships.acceptFriendRequest(identity, a.otherUid),
    removeFriendship: (id, a, identity) => friendships.removeFriendship(identity, a.otherUid),

    blockUser: (id, a, identity) => blocks.blockUser(identity, a.blockedId),
    unblockUser: (id, a, identity) => blocks.unblockUser(identity, a.blockedId),

    submitReport: (id, a, identity) => reports.submitReport(identity, a.input),

    upsertDonation: (id, a, identity) => donations.upsertDonation(identity, a.donationId, a.name, a.amount, a.message),
  },
};

exports.handler = async (event) => {
  const { typeName, fieldName } = event.info;
  const group = handlers[typeName];
  const fn = group && group[fieldName];
  if (!fn) {
    throw new Error(`No resolver for ${typeName}.${fieldName}`);
  }
  try {
    return await fn(fieldName, event.arguments || {}, event.identity);
  } catch (err) {
    if (err.type) {
      const e = new Error(err.message);
      e.errorType = err.type;
      throw e;
    }
    throw err;
  }
};
