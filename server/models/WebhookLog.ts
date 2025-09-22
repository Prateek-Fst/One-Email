import mongoose, { type Document, Schema } from "mongoose"

export interface IWebhookLog extends Document {
  url: string
  event: string
  payload: any
  status: "success" | "failed" | "pending"
  statusCode?: number
  errorMessage?: string
  retryCount: number
  sentAt: Date
  responseTime?: number
  createdAt: Date
  updatedAt: Date
}

const WebhookLogSchema = new Schema<IWebhookLog>(
  {
    url: { type: String, required: true },
    event: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["success", "failed", "pending"],
      default: "pending",
    },
    statusCode: Number,
    errorMessage: String,
    retryCount: { type: Number, default: 0 },
    sentAt: { type: Date, default: Date.now },
    responseTime: Number,
  },
  {
    timestamps: true,
  },
)

// Indexes for efficient queries
WebhookLogSchema.index({ url: 1, createdAt: -1 })
WebhookLogSchema.index({ status: 1, createdAt: -1 })
WebhookLogSchema.index({ event: 1, createdAt: -1 })

export default mongoose.model<IWebhookLog>("WebhookLog", WebhookLogSchema)
