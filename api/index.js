const serverless = require('serverless-http');
const app = require('../server'); // Adjust path to server.js

module.exports.handler = serverless(app);
