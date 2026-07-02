const mongoose = require('mongoose');
const { resolveMongoUri } = require('./resolveMongoUri');

const connectDB = async () => {
  const rawUri = process.env.MONGODB_URI?.trim();
  if (!rawUri) {
    throw new Error('MONGODB_URI is not set');
  }

  let uri = rawUri;
  try {
    if (rawUri.startsWith('mongodb+srv://')) {
      uri = await resolveMongoUri(rawUri);
      console.log('[db] Resolved mongodb+srv via public DNS (Windows SRV fix)');
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    if (error.message?.includes('querySrv ECONNREFUSED')) {
      console.error(
        'MongoDB Connection Error: DNS SRV lookup failed. Set MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1 or use a standard mongodb:// URI from Atlas.'
      );
    }
    console.error(`MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
