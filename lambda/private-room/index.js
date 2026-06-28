const { runHandler } = require('./shim');
const handler = require('./logic');

exports.handler = (event) => runHandler(handler, event);
