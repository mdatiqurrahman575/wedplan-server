import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);
let db;

export async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.DB_NAME || 'wedplanDB');
    console.log('MongoDB Connected Successfully!');
  }
  return db;
}

export function getCollections() {
  if (!db) {
    throw new Error('Database not connected! Call connectDB first.');
  }
  return {
    usersCollection: db.collection('user'),
    servicesCollection: db.collection('services'),
    bookingsCollection: db.collection('bookings'),
    transactionsCollection: db.collection('transactions'),
  };
}
