import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose"
import { Client } from "@elastic/elasticsearch"
import emailRoutes from "./routes/emails"
import aiRoutes from "./routes/ai"
import webhookRoutes from "./routes/webhooks"
import contextRoutes from "./routes/contexts"
import ragRoutes from "./routes/rag"
import imapService from "./services/imapService"
import elasticsearchService from "./services/elasticsearchService"
import vectorService from "./services/vectorService"
import { errorHandler, notFound } from "./middleware/errorHandler"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5001

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`)
  next()
})

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/email-onebox")
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("MongoDB connection error:", error))

// Elasticsearch connection
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  ...(process.env.ELASTICSEARCH_API_KEY && {
    auth: {
      apiKey: process.env.ELASTICSEARCH_API_KEY
    }
  }),
})

// Initialize services
elasticsearchService.initialize(esClient)
imapService.initialize()

// Seed vector database on startup (in production, do this separately)
setTimeout(async () => {
  try {
    const existingDocs = await vectorService.getAllDocuments()
    if (existingDocs.length === 0) {
      console.log("Seeding knowledge base...")
      await vectorService.seedKnowledgeBase()
    }
  } catch (error) {
    console.error("Error checking/seeding knowledge base:", error)
  }
}, 5000)

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working!", timestamp: new Date().toISOString() })
})

// Routes
app.use("/api/emails", emailRoutes)
app.use("/api/ai", aiRoutes)
app.use("/api/webhooks", webhookRoutes)
app.use("/api/contexts", contextRoutes)
app.use("/api/rag", ragRoutes)

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Email Onebox API is running",
    services: {
      mongodb: mongoose.connection.readyState === 1,
      elasticsearch: elasticsearchService.isHealthy(),
      slack: !!process.env.SLACK_WEBHOOK_URL,
      webhooks: !!process.env.EXTERNAL_WEBHOOK_URL,
      openai: !!process.env.OPENAI_API_KEY,
    },
  })
})

// Error handling
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
