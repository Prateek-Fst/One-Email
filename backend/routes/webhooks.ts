import express from "express"
import webhookService from "../services/webhookService"
import Email from "../models/Email"

const router = express.Router()

// Test webhook endpoint
router.post("/test", async (req, res) => {
  try {
    const { url } = req.body

    if (!url && !process.env.EXTERNAL_WEBHOOK_URL) {
      return res.status(400).json({ error: "Webhook URL is required" })
    }

    const success = await webhookService.sendTestWebhook(url)

    if (success) {
      res.json({ message: "Test webhook sent successfully" })
    } else {
      res.status(500).json({ error: "Failed to send test webhook" })
    }
  } catch (error) {
    console.error("Error testing webhook:", error)
    res.status(500).json({ error: "Failed to test webhook" })
  }
})

// Send custom webhook
router.post("/send", async (req, res) => {
  try {
    const { url, event, data, headers } = req.body

    if (!url || !event || !data) {
      return res.status(400).json({ error: "URL, event, and data are required" })
    }

    const success = await webhookService.sendCustomWebhook(url, event, data, headers || {})

    if (success) {
      res.json({ message: "Webhook sent successfully" })
    } else {
      res.status(500).json({ error: "Failed to send webhook" })
    }
  } catch (error) {
    console.error("Error sending custom webhook:", error)
    res.status(500).json({ error: "Failed to send webhook" })
  }
})

// Send bulk notification
router.post("/bulk-notify", async (req, res) => {
  try {
    const { emailIds, event } = req.body

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ error: "emailIds array is required" })
    }

    const emails = await Email.find({ _id: { $in: emailIds } })

    if (emails.length === 0) {
      return res.status(404).json({ error: "No emails found" })
    }

    const success = await webhookService.sendBulkNotification(emails, event)

    if (success) {
      res.json({
        message: "Bulk notification sent successfully",
        processed: emails.length,
      })
    } else {
      res.status(500).json({ error: "Failed to send bulk notification" })
    }
  } catch (error) {
    console.error("Error sending bulk notification:", error)
    res.status(500).json({ error: "Failed to send bulk notification" })
  }
})

// Resend notification for specific email
router.post("/resend/:emailId", async (req, res) => {
  try {
    const email = await Email.findById(req.params.emailId)

    if (!email) {
      return res.status(404).json({ error: "Email not found" })
    }

    if (email.aiCategory === "Interested") {
      await webhookService.sendInterestedNotification(email)
      res.json({ message: "Notification resent successfully" })
    } else {
      res.status(400).json({ error: "Email is not categorized as interested" })
    }
  } catch (error) {
    console.error("Error resending notification:", error)
    res.status(500).json({ error: "Failed to resend notification" })
  }
})

// Get webhook statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await webhookService.getWebhookStats()
    res.json(stats)
  } catch (error) {
    console.error("Error getting webhook stats:", error)
    res.status(500).json({ error: "Failed to get webhook statistics" })
  }
})

// Webhook receiver endpoint (for testing incoming webhooks)
router.post("/receive", async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"] as string
    const payload = JSON.stringify(req.body)

    if (signature && !webhookService.verifyWebhookSignature(payload, signature)) {
      return res.status(401).json({ error: "Invalid webhook signature" })
    }

    console.log("Received webhook:", req.body)

    // Process the webhook data here
    // This could trigger actions like updating email status, etc.

    res.json({ message: "Webhook received successfully" })
  } catch (error) {
    console.error("Error processing incoming webhook:", error)
    res.status(500).json({ error: "Failed to process webhook" })
  }
})

export default router
