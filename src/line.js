const crypto = require('crypto');
const config = require('./config');

function verifySignature(rawBody, signature) {
  if (!config.channelSecret || !signature) return false;
  const mac = crypto.createHmac('sha256', config.channelSecret).update(rawBody).digest();
  const sig = Buffer.from(signature, 'base64');
  return mac.length === sig.length && crypto.timingSafeEqual(mac, sig);
}

async function reply(replyToken, messages) {
  if (!config.channelAccessToken) return console.warn('[LINE] ไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN');
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.channelAccessToken}` },
    body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }),
  });
  if (!res.ok) console.error('[LINE] reply failed', res.status, await res.text());
}

async function getProfile(userId) {
  if (!config.channelAccessToken) return null;
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, { headers: { Authorization: `Bearer ${config.channelAccessToken}` } });
  return res.ok ? res.json() : null;
}

module.exports = { verifySignature, reply, getProfile };
