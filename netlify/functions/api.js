// Netlify Function: ห่อแอป Express ทั้งก้อน (/api, /admin/api, /webhook, /healthz)
const serverless = require('serverless-http');
const app = require('../../src/server');

exports.handler = serverless(app, { basePath: '/.netlify/functions/api' });
