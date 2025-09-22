import OpenAI from "openai"
import mongoose, { type Document, Schema } from "mongoose"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Vector document schema for storing embeddings
interface IVectorDocument extends Document {
  content: string
  embedding: number[]
  metadata: {
    type: "product" | "outreach" | "template" | "knowledge"
    category?: string
    tags?: string[]
    priority?: number
  }
  createdAt: Date
  updatedAt: Date
}

const VectorDocumentSchema = new Schema<IVectorDocument>(
  {
    content: { type: String, required: true },
    embedding: { type: [Number], required: true },
    metadata: {
      type: {
        type: String,
        enum: ["product", "outreach", "template", "knowledge"],
        required: true,
      },
      category: String,
      tags: [String],
      priority: { type: Number, default: 1 },
    },
  },
  {
    timestamps: true,
  },
)

// Index for vector similarity search (in production, use a proper vector database)
VectorDocumentSchema.index({ "metadata.type": 1 })
VectorDocumentSchema.index({ "metadata.category": 1 })

const VectorDocument = mongoose.model<IVectorDocument>("VectorDocument", VectorDocumentSchema)

class VectorService {
  private readonly EMBEDDING_MODEL = "text-embedding-3-small"
  private readonly SIMILARITY_THRESHOLD = 0.7

  async addDocument(content: string, metadata: any): Promise<string> {
    try {
      // Generate embedding for the content
      const embedding = await this.generateEmbedding(content)

      const document = new VectorDocument({
        content,
        embedding,
        metadata,
      })

      await document.save()
      return document._id.toString()
    } catch (error) {
      console.error("Error adding document to vector store:", error)
      throw error
    }
  }

  async searchSimilar(
    query: string,
    type?: string,
    limit = 5,
  ): Promise<Array<{ content: string; similarity: number; metadata: any }>> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query)

      // Build search filter
      const filter: any = {}
      if (type) {
        filter["metadata.type"] = type
      }

      // Get all documents (in production, use proper vector search)
      const documents = await VectorDocument.find(filter)

      // Calculate similarities and sort
      const results = documents
        .map((doc) => ({
          content: doc.content,
          metadata: doc.metadata,
          similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
        }))
        .filter((result) => result.similarity > this.SIMILARITY_THRESHOLD)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)

      return results
    } catch (error) {
      console.error("Error searching vector store:", error)
      return []
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: text,
      })

      return response.data[0].embedding
    } catch (error) {
      console.error("Error generating embedding:", error)
      throw error
    }
  }

  async seedKnowledgeBase(): Promise<void> {
    try {
      // Sample product information
      const productDocs = [
        {
          content:
            "Our AI-powered email management platform helps businesses organize and respond to emails efficiently. Key features include automatic categorization, smart replies, and multi-account support.",
          metadata: { type: "product", category: "overview", priority: 5 },
        },
        {
          content:
            "Pricing starts at $29/month for the basic plan with up to 5 email accounts. Professional plan is $79/month with unlimited accounts and advanced AI features.",
          metadata: { type: "product", category: "pricing", priority: 4 },
        },
        {
          content:
            "We offer a 14-day free trial with no credit card required. You can upgrade or cancel anytime during the trial period.",
          metadata: { type: "product", category: "trial", priority: 4 },
        },
        {
          content:
            "Our platform integrates with Gmail, Outlook, Yahoo Mail, and any IMAP-compatible email service. Setup takes less than 5 minutes.",
          metadata: { type: "product", category: "integration", priority: 3 },
        },
      ]

      // Sample outreach templates
      const outreachDocs = [
        {
          content:
            "For interested prospects: Thank you for your interest! I'd love to show you how our platform can save you hours each week. Here's a link to book a demo: https://cal.com/demo",
          metadata: { type: "outreach", category: "interested", priority: 5 },
        },
        {
          content:
            "For meeting requests: I'd be happy to discuss this further. You can book a convenient time slot here: https://cal.com/meeting",
          metadata: { type: "outreach", category: "meeting", priority: 5 },
        },
        {
          content:
            "For pricing inquiries: Our pricing is designed to be flexible and affordable. I can provide a custom quote based on your specific needs. Let's schedule a quick call to discuss.",
          metadata: { type: "outreach", category: "pricing", priority: 4 },
        },
      ]

      // Sample response templates
      const templateDocs = [
        {
          content:
            "Professional follow-up: I wanted to follow up on my previous email. I believe our solution could be a great fit for your needs. Would you be available for a brief call this week?",
          metadata: { type: "template", category: "follow-up", priority: 3 },
        },
        {
          content:
            "Thank you response: Thank you for taking the time to respond. I appreciate your feedback and would love to address any questions you might have.",
          metadata: { type: "template", category: "thank-you", priority: 2 },
        },
      ]

      // Add all documents
      const allDocs = [...productDocs, ...outreachDocs, ...templateDocs]

      for (const doc of allDocs) {
        await this.addDocument(doc.content, doc.metadata)
      }

      console.log(`Seeded ${allDocs.length} documents to vector store`)
    } catch (error) {
      console.error("Error seeding knowledge base:", error)
    }
  }

  async updateDocument(id: string, content: string, metadata?: any): Promise<boolean> {
    try {
      const embedding = await this.generateEmbedding(content)

      const updateData: any = { content, embedding }
      if (metadata) {
        updateData.metadata = metadata
      }

      const result = await VectorDocument.findByIdAndUpdate(id, updateData)
      return !!result
    } catch (error) {
      console.error("Error updating document:", error)
      return false
    }
  }

  async deleteDocument(id: string): Promise<boolean> {
    try {
      const result = await VectorDocument.findByIdAndDelete(id)
      return !!result
    } catch (error) {
      console.error("Error deleting document:", error)
      return false
    }
  }

  async getAllDocuments(type?: string): Promise<any[]> {
    try {
      const filter = type ? { "metadata.type": type } : {}
      const documents = await VectorDocument.find(filter).sort({ "metadata.priority": -1, createdAt: -1 })

      return documents.map((doc) => ({
        id: doc._id,
        content: doc.content,
        metadata: doc.metadata,
        createdAt: doc.createdAt,
      }))
    } catch (error) {
      console.error("Error getting documents:", error)
      return []
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}

export default new VectorService()
