import mongoose, { type Document, Schema } from "mongoose"

export interface IAIContext extends Document {
  name: string
  description: string
  context: string
  isActive: boolean
  createdBy?: string
  usageCount: number
  lastUsed?: Date
  createdAt: Date
  updatedAt: Date
}

const AIContextSchema = new Schema<IAIContext>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    context: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    createdBy: String,
    usageCount: { type: Number, default: 0 },
    lastUsed: Date,
  },
  {
    timestamps: true,
  },
)

AIContextSchema.index({ name: 1 })
AIContextSchema.index({ isActive: 1 })

export default mongoose.model<IAIContext>("AIContext", AIContextSchema)
