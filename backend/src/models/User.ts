import mongoose from 'mongoose'

export interface IUser {
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new mongoose.Schema<IUser>({
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

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
