import express from "express"
import ragService from "../services/ragService"
import vectorService from "../services/vectorService"
import Email from "../models/Email"

const router = express.Router()

// Generate contextual reply for an email
router.post("/reply/:emailId", async (req, res) => {
  try {
    const { userContext } = req.body
    const email = await Email.findById(req.params.emailId)

    if (!email) {
      return res.status(404).json({ error: "Email not found" })
    }

    const ragResponse = await ragService.generateContextualReply(email, userContext)

    if (!ragResponse) {
      return res.status(500).json({ error: "Failed to generate contextual reply" })
    }

    res.json({
      emailId: email._id,
      ...ragResponse,
    })
  } catch (error) {
    console.error("Error generating contextual reply:", error)
    res.status(500).json({ error: "Failed to generate contextual reply" })
  }
})

// Generate multiple reply options
router.post("/replies/:emailId", async (req, res) => {
  try {
    const { count = 3 } = req.body
    const email = await Email.findById(req.params.emailId)

    if (!email) {
      return res.status(404).json({ error: "Email not found" })
    }

    if (count > 5) {
      return res.status(400).json({ error: "Maximum 5 reply options allowed" })
    }

    const replies = await ragService.generateMultipleReplies(email, count)

    res.json({
      emailId: email._id,
      replies,
      count: replies.length,
    })
  } catch (error) {
    console.error("Error generating multiple replies:", error)
    res.status(500).json({ error: "Failed to generate multiple replies" })
  }
})

// Improve a reply based on feedback
router.post("/improve", async (req, res) => {
  try {
    const { originalReply, feedback, emailId } = req.body

    if (!originalReply || !feedback) {
      return res.status(400).json({ error: "originalReply and feedback are required" })
    }

    let emailContent = ""
    if (emailId) {
      const email = await Email.findById(emailId)
      if (email) {
        emailContent = `Subject: ${email.subject}\nFrom: ${email.from.address}\nBody: ${email.body.text || ""}`
      }
    }

    const improvedReply = await ragService.improveReply(originalReply, feedback, emailContent)

    if (!improvedReply) {
      return res.status(500).json({ error: "Failed to improve reply" })
    }

    res.json({
      originalReply,
      improvedReply,
      feedback,
    })
  } catch (error) {
    console.error("Error improving reply:", error)
    res.status(500).json({ error: "Failed to improve reply" })
  }
})

// Analyze email intent
router.post("/analyze/:emailId", async (req, res) => {
  try {
    const email = await Email.findById(req.params.emailId)

    if (!email) {
      return res.status(404).json({ error: "Email not found" })
    }

    const emailContent = `Subject: ${email.subject}\nFrom: ${email.from.address}\nBody: ${email.body.text || ""}`
    const analysis = await ragService.analyzeEmailIntent(emailContent)

    if (!analysis) {
      return res.status(500).json({ error: "Failed to analyze email intent" })
    }

    res.json({
      emailId: email._id,
      ...analysis,
    })
  } catch (error) {
    console.error("Error analyzing email intent:", error)
    res.status(500).json({ error: "Failed to analyze email intent" })
  }
})

// Vector store management endpoints

// Add document to vector store
router.post("/knowledge", async (req, res) => {
  try {
    const { content, metadata } = req.body

    if (!content || !metadata) {
      return res.status(400).json({ error: "content and metadata are required" })
    }

    const documentId = await vectorService.addDocument(content, metadata)

    res.status(201).json({
      message: "Document added successfully",
      documentId,
    })
  } catch (error) {
    console.error("Error adding document:", error)
    res.status(500).json({ error: "Failed to add document" })
  }
})

// Get all documents from vector store
router.get("/knowledge", async (req, res) => {
  try {
    const { type } = req.query
    const documents = await vectorService.getAllDocuments(type as string)

    res.json({
      documents,
      count: documents.length,
    })
  } catch (error) {
    console.error("Error getting documents:", error)
    res.status(500).json({ error: "Failed to get documents" })
  }
})

// Update document in vector store
router.put("/knowledge/:id", async (req, res) => {
  try {
    const { content, metadata } = req.body

    if (!content) {
      return res.status(400).json({ error: "content is required" })
    }

    const success = await vectorService.updateDocument(req.params.id, content, metadata)

    if (success) {
      res.json({ message: "Document updated successfully" })
    } else {
      res.status(404).json({ error: "Document not found" })
    }
  } catch (error) {
    console.error("Error updating document:", error)
    res.status(500).json({ error: "Failed to update document" })
  }
})

// Delete document from vector store
router.delete("/knowledge/:id", async (req, res) => {
  try {
    const success = await vectorService.deleteDocument(req.params.id)

    if (success) {
      res.json({ message: "Document deleted successfully" })
    } else {
      res.status(404).json({ error: "Document not found" })
    }
  } catch (error) {
    console.error("Error deleting document:", error)
    res.status(500).json({ error: "Failed to delete document" })
  }
})

// Search similar documents
router.post("/knowledge/search", async (req, res) => {
  try {
    const { query, type, limit = 5 } = req.body

    if (!query) {
      return res.status(400).json({ error: "query is required" })
    }

    const results = await vectorService.searchSimilar(query, type, limit)

    res.json({
      query,
      results,
      count: results.length,
    })
  } catch (error) {
    console.error("Error searching documents:", error)
    res.status(500).json({ error: "Failed to search documents" })
  }
})

// Seed knowledge base with sample data
router.post("/knowledge/seed", async (req, res) => {
  try {
    await vectorService.seedKnowledgeBase()
    res.json({ message: "Knowledge base seeded successfully" })
  } catch (error) {
    console.error("Error seeding knowledge base:", error)
    res.status(500).json({ error: "Failed to seed knowledge base" })
  }
})

export default router
