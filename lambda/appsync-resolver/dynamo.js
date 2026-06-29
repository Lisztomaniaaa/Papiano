const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand,
  QueryCommand, ScanCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client);

const T = {
  profiles: 'papiano-profiles',
  counters: 'papiano-counters',
  displayNames: 'papiano-display-names',
  chatRooms: 'papiano-chat-rooms',
  userChatRooms: 'papiano-user-chatrooms',
  messages: 'papiano-messages',
  friendships: 'papiano-friendships',
  blocks: 'papiano-blocks',
  profileReactions: 'papiano-profile-reactions',
  reports: 'papiano-reports',
  donations: 'papiano-donations',
  rooms: 'papiano-rooms',
  roomPlayers: 'papiano-room-players',
  roomSeats: 'papiano-room-seats',
  presence: 'papiano-presence',
  roomMessages: 'papiano-room-messages',
  streams: 'papiano-streams',
  moderation: 'papiano-moderation',
  roles: 'papiano-roles',
  deletedAccounts: 'papiano-deleted-accounts',
  roomSecrets: 'papiano-room-secrets',
  roomGrants: 'papiano-room-grants',
  roomThrottle: 'papiano-room-throttle',
  botThrottle: 'papiano-bot-throttle',
};

module.exports = {
  doc, T,
  GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand, TransactWriteCommand,
};
