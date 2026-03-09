/**
 * generate-env.js
 * Auto-generates .env file with secure secrets during installation.
 * Run by install.bat during setup.
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const installDir = process.argv[2] || path.join(__dirname, '..');
const envPath    = path.join(installDir, '.env');

// Generate secrets
const sessionSecret     = crypto.randomBytes(64).toString('hex');
const chatEncryptionKey = crypto.randomBytes(32).toString('hex');

const envContent = `# ── AJUQNET Environment Configuration ──────────────────────────
# Auto-generated during installation. DO NOT edit manually.

# ── Server ───────────────────────────────────────────────────────
PORT=3000

# ── Database ─────────────────────────────────────────────────────
MONGODB_URI=mongodb://kumaar4159_db_user:s5EKxLNXIA4j8s21@ac-ek06qkj-shard-00-00.ifhvozg.mongodb.net:27017,ac-ek06qkj-shard-00-01.ifhvozg.mongodb.net:27017,ac-ek06qkj-shard-00-02.ifhvozg.mongodb.net:27017/ajuqnet?ssl=true&replicaSet=atlas-8rm077-shard-0&authSource=admin&appName=AJUQNET
# ── Sessions ─────────────────────────────────────────────────────
SESSION_SECRET=${sessionSecret}
SESSION_MAX_AGE=3600000

# ── Chat Encryption ───────────────────────────────────────────────
CHAT_ENCRYPTION_KEY=${chatEncryptionKey}

# ── Security ──────────────────────────────────────────────────────
MAX_LOGIN_ATTEMPTS=3
LOCK_TIME_MINUTES=30

# ── Environment ───────────────────────────────────────────────────
NODE_ENV=production
CLIENT_ORIGIN=http://localhost:3000
`;

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('✅ .env file generated successfully at: ' + envPath);
