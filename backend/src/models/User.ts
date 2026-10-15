import mongoose, { type Model } from 'mongoose'

export interface IUser {
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Full document interface for the User model
 */
export interface IUserDocument extends mongoose.Document {
  email: string
  passwordHash: string
}

const UserSchema = new mongoose.Schema<IUserDocument>({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: { 
    type: String, 
    required: true 
  }
}, {
  timestamps: true
})

export const User =
  ((mongoose.models.User as Model<IUserDocument> | undefined) ||
  mongoose.model<IUserDocument>('User', UserSchema)) as Model<IUserDocument>
