/**
 * @file database.ts
 * @role MongoDB connection configuration
 * @depends Mongoose
 * @dataflow Environment variables → MongoDB connection string → Connection instance
 */

import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

/**
 * Connect to MongoDB
 */
export async function connectDatabase() {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined')
    }
    await mongoose.connect(MONGODB_URI)
    console.log('✅ MongoDB connected successfully')

    // Drop unique index on sha256 to allow duplicate file uploads
    const db = mongoose.connection.db
    if (!db) {
      throw new Error('MongoDB connection db is undefined')
    }
    const filesCollection = db.collection('files')

    try {
      await filesCollection.dropIndex('sha256_1')
      console.log('✅ Dropped unique index on sha256 (duplicate files now allowed)')
    } catch (err: unknown) {
      // Index might not exist or already dropped - that's fine
      const code = (err as { code?: number })?.code
      if (code !== 27) { // 27 = IndexNotFound
        console.warn('⚠️ Warning: could not drop sha256 index:', (err as Error).message)
      }
    }
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error)
    throw error
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDatabase() {
  try {
    await mongoose.disconnect()
    console.log('✅ MongoDB disconnected')
  } catch (error) {
    console.error('❌ MongoDB disconnection failed:', error)
    throw error
  }
}
