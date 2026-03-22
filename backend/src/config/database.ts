/**
 * @file database.ts
 * @role MongoDB connection configuration
 * @depends Mongoose
 * @dataflow Environment variables → MongoDB connection string → Connection instance
 */

import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloud-storage'

/**
 * Connect to MongoDB
 */
export async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('✅ MongoDB connected successfully')
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
