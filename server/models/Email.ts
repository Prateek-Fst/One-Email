import mongoose, { type Document, Schema } from "mongoose"

export interface IEmail extends Document {
  messageId: string
  accountId: string
  accountEmail: string
  subject: string
  from: {
    name?: string
    address: string
  }
  to: Array<{
    name?: string
    address: string
  }>
  cc?: Array<{
    name?: string
    address: string
  }>
  bcc?: Array<{
    name?: string
    address: string
  }>
  date: Date
  body: {
    text?: string
    html?: string
  }
  folder: string
  flags: string[]
  uid: number
  aiCategory?: "Interested" | "Meeting Booked" | "Not Interested" | "Spam" | "Out of Office"
  aiConfidence?: number
  isRead: boolean
  createdAt: Date
  updatedAt: Date
}

const EmailSchema = new Schema<IEmail>(
  {
    messageId: { type: String, required: true, unique: true },
    accountId: { type: String, required: true },
    accountEmail: { type: String, required: true },
    subject: { type: String, required: true },
    from: {
      name: String,
      address: { type: String, required: true },
    },
    to: [
      {
        name: String,
        address: { type: String, required: true },
      },
    ],
    cc: [
      {
        name: String,
        address: String,
      },
    ],
    bcc: [
      {
        name: String,
        address: String,
      },
    ],
    date: { type: Date, required: true },
    body: {
      text: String,
      html: String,
    },
    folder: { type: String, required: true },
    flags: [String],
    uid: { type: Number, required: true },
    aiCategory: {
      type: String,
      enum: ["Interested", "Meeting Booked", "Not Interested", "Spam", "Out of Office"],
    },
    aiConfidence: Number,
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

// Compound index for efficient queries
EmailSchema.index({ accountId: 1, folder: 1, date: -1 })
EmailSchema.index({ messageId: 1 })
EmailSchema.index({ aiCategory: 1 })

export default mongoose.model<IEmail>("Email", EmailSchema)
