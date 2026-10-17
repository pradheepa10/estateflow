
const mongoose = require('mongoose');

module.exports = async function connect() {
  const uri = process.env.MONGO_URI;

  if (!uri || uri === 'memory') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mem = await MongoMemoryServer.create();
    await mongoose.connect(mem.getUri('crm'));
    console.log('Using in-memory MongoDB (data resets on restart)');
    return;
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    maxPoolSize: 5,
  });

  console.log('MongoDB connected');
};
