import mongoose, { type Document, Schema } from "mongoose"

export interface IAccount extends Document {
  email: string
  imapConfig: {
    host: string
    port: number
    secure: boolean
    username: string
    password: string
  }
  isActive: boolean
  lastSyncDate?: Date
  syncStatus: "idle" | "syncing" | "error"
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

const AccountSchema = new Schema<IAccount>(
  {
    email: { type: String, required: true, unique: true },
    imapConfig: {
      host: { type: String, required: true },
      port: { type: Number, required: true },
      secure: { type: Boolean, default: true },
      username: { type: String, required: true },
      password: { type: String, required: true },
    },
    isActive: { type: Boolean, default: true },
    lastSyncDate: Date,
    syncStatus: {
      type: String,
      enum: ["idle", "syncing", "error"],
      default: "idle",
    },
    errorMessage: String,
  },
  {
    timestamps: true,
  },
)

export default mongoose.model<IAccount>("Account", AccountSchema)
