import express from "express"
import aiService from "../services/aiService"
import Email from "../models/Email"

const router = express.Router()

// Categorize a single email
router.post("/categorize/:emailId", async (req, res) => {
  try {
    const email = await Email.findById(req.params.emailId)
    if (!email) {
      return res.status(404).json({ error: "Email not found" })
    }

    const category = await aiService.categorizeEmail(email)
    if (!category) {
      return res.status(500).json({ error: "Failed to categorize email" })
    }

    // Update email with AI category
    email.aiCategory = category.category
    email.aiConfidence = category.confidence
    await email.save()

    res.json({
      emailId: email._id,
      category: category.category,
      confidence: category.confidence,
      reasoning: category.reasoning,
    })
  } catch (error) {
    console.error("Error categorizing email:", error)
    res.status(500).json({ error: "Failed to categorize email" })
  }
})

// Batch categorize multiple emails
router.post("/categorize/batch", async (req, res) => {
  try {
    const { emailIds } = req.body

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ error: "emailIds array is required" })
    }

    if (emailIds.length > 50) {
      return res.status(400).json({ error: "Maximum 50 emails per batch" })
    }

    const results = await aiService.batchCategorizeEmails(emailIds)

    // Update emails with results
    const updatePromises = results
      .filter((result) => result.category && !result.error)
      .map((result) =>
        Email.findByIdAndUpdate(result.emailId, {
          aiCategory: result.category!.category,
          aiConfidence: result.category!.confidence,
        }),
      )

    await Promise.all(updatePromises)

    res.json({
      processed: results.length,
      successful: results.filter((r) => r.category && !r.error).length,
      failed: results.filter((r) => r.error).length,
      results,
    })
  } catch (error) {
    console.error("Error batch categorizing emails:", error)
    res.status(500).json({ error: "Failed to batch categorize emails" })
  }
})

// Recategorize all uncategorized emails
router.post("/recategorize-all", async (req, res) => {
  try {
    const results = await aiService.recategorizeAllEmails()
    res.json(results)
  } catch (error) {
    console.error("Error recategorizing all emails:", error)
    res.status(500).json({ error: "Failed to recategorize emails" })
  }
})

// Generate reply for an email
router.post("/reply/:emailId", async (req, res) => {
  try {
    const { context } = req.body
    const email = await Email.findById(req.params.emailId)

    if (!email) {
      return res.status(404).json({ error: "Email not found" })
    }

    if (!context) {
      return res.status(400).json({ error: "Context is required for reply generation" })
    }

    const reply = await aiService.generateReply(email, context)

    if (!reply) {
      return res.status(500).json({ error: "Failed to generate reply" })
    }

    res.json({
      emailId: email._id,
      reply,
      context,
    })
  } catch (error) {
    console.error("Error generating reply:", error)
    res.status(500).json({ error: "Failed to generate reply" })
  }
})

// Generate bulk replies
router.post("/reply/batch", async (req, res) => {
  try {
    const { emailIds, context } = req.body

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ error: "emailIds array is required" })
    }

    if (!context) {
      return res.status(400).json({ error: "Context is required for reply generation" })
    }

    if (emailIds.length > 20) {
      return res.status(400).json({ error: "Maximum 20 emails per batch for reply generation" })
    }

    const results = await aiService.generateBulkReplies(emailIds, context)

    res.json({
      processed: results.length,
      successful: results.filter((r) => r.reply && !r.error).length,
      failed: results.filter((r) => r.error).length,
      results,
    })
  } catch (error) {
    console.error("Error generating bulk replies:", error)
    res.status(500).json({ error: "Failed to generate bulk replies" })
  }
})

// Analyze email sentiment
router.post("/sentiment/:emailId", async (req, res) => {
  try {
    const email = await Email.findById(req.params.emailId)
    if (!email) {
      return res.status(404).json({ error: "Email not found" })
    }

    const sentiment = await aiService.analyzeEmailSentiment(email)
    if (!sentiment) {
      return res.status(500).json({ error: "Failed to analyze sentiment" })
    }

    res.json({
      emailId: email._id,
      ...sentiment,
    })
  } catch (error) {
    console.error("Error analyzing sentiment:", error)
    res.status(500).json({ error: "Failed to analyze sentiment" })
  }
})

// Extract key information from email
router.post("/extract/:emailId", async (req, res) => {
  try {
    const email = await Email.findById(req.params.emailId)
    if (!email) {
      return res.status(404).json({ error: "Email not found" })
    }

    const keyInfo = await aiService.extractKeyInformation(email)
    if (!keyInfo) {
      return res.status(500).json({ error: "Failed to extract key information" })
    }

    res.json({
      emailId: email._id,
      ...keyInfo,
    })
  } catch (error) {
    console.error("Error extracting key information:", error)
    res.status(500).json({ error: "Failed to extract key information" })
  }
})

// Get AI categorization statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await aiService.getCategorizationStats()
    res.json(stats)
  } catch (error) {
    console.error("Error getting AI stats:", error)
    res.status(500).json({ error: "Failed to get AI statistics" })
  }
})

export default router
