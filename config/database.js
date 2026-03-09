const mongoose = require('mongoose');

// Track connection state so middleware can check it
let isConnected = false;
let isConnecting = false;

const connectDB = async () => {
  try {
    isConnecting = true;
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

const conn = await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  family: 4,
  autoIndex: true
});
    isConnected  = true;
    isConnecting = false;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    isConnected  = false;
    isConnecting = false;
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️  MongoDB disconnected — internet may be down');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('🔄 MongoDB reconnected');
});

mongoose.connection.on('connected', () => {
  isConnected = true;
});

// Export both the connect function and a status checker
module.exports = connectDB;
module.exports.isConnected = () => isConnected;