import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Copy server/.env.example to server/.env and configure MongoDB Atlas or a local MongoDB URI.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });

  console.log(`MongoDB connected (${mongoose.connection.name})`);
}

export { mongoose };