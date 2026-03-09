'use strict';
/**
 * AES-256-GCM encryption — key is loaded lazily so seed.js can run
 * without CHAT_ENCRYPTION_KEY being set.
 * Envelope format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
const crypto = require('crypto');

const ALGORITHM  = 'aes-256-gcm';
const IV_LEN     = 16;
const TAG_LEN    = 16;
let   _key       = null;

function getKey() {
  if (_key) return _key;
  const raw = process.env.CHAT_ENCRYPTION_KEY;
  if (!raw) throw new Error('CHAT_ENCRYPTION_KEY env var is required. Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  _key = crypto.createHash('sha256').update(raw).digest();
  return _key;
}

function encrypt(plaintext) {
  if (typeof plaintext !== 'string') throw new TypeError('encrypt() expects a string');
  const key    = getKey();
  const iv     = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LEN });
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), enc.toString('hex')].join(':');
}

function decrypt(envelope) {
  if (typeof envelope !== 'string') throw new TypeError('decrypt() expects a string');
  const parts = envelope.split(':');
  if (parts.length !== 3) throw new Error('Invalid envelope');
  const [ivH, tagH, ctH] = parts;
  const key      = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivH, 'hex'), { authTagLength: TAG_LEN });
  decipher.setAuthTag(Buffer.from(tagH, 'hex'));
  try {
    return Buffer.concat([decipher.update(Buffer.from(ctH, 'hex')), decipher.final()]).toString('utf8');
  } catch { throw new Error('Decryption failed — message may have been tampered with'); }
}

function safeDecrypt(envelope, fallback = '[unavailable]') {
  try { return decrypt(envelope); } catch { return fallback; }
}

function selfTest() {
  const p = 'self-test 🔐'; const r = decrypt(encrypt(p));
  if (r !== p) throw new Error('Self-test failed');
  return true;
}

module.exports = { encrypt, decrypt, safeDecrypt, selfTest };
