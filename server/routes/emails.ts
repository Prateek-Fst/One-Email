import express from "express"
import Email from "../models/Email"
import Account from "../models/Account"
import elasticsearchService from "../services/elasticsearchService"
import imapService from "../services/imapService"

const router = express.Router()

// Get emails with pagination and filters
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, accountId, folder, category, search, isRead } = req.query

    const query: any = {}

    if (accountId) query.accountId = accountId
    if (folder) query.folder = folder
    if (category) query.aiCategory = category
    if (isRead !== undefined) query.isRead = isRead === "true"

    let emails

    if (search) {
      // Use Elasticsearch for search
      const searchResults = await elasticsearchService.searchEmails(search as string, {
        accountId,
        folder,
        aiCategory: category,
      })

      const emailIds = searchResults.hits.map((hit: any) => hit._id)
      emails = await Email.find({ _id: { $in: emailIds } })
        .populate("accountId", "email")
        .sort({ date: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
    } else {
      // Use MongoDB for regular queries
      emails = await Email.find(query)
        .populate("accountId", "email")
        .sort({ date: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
    }

    const total = await Email.countDocuments(query)

    res.json({
      emails,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error) {
    console.error("Error fetching emails:", error)
    res.status(500).json({ error: "Failed to fetch emails" })
  }
})

// Get specific email
router.get("/:id", async (req, res) => {
  try {
    const email = await Email.findById(req.params.id).populate("accountId", "email")

    if (!email) {
      return res.status(404).json({ error: "Email not found" })
    }

    // Mark as read if not already
    if (!email.isRead) {
      email.isRead = true
      await email.save()
    }

    res.json(email)
  } catch (error) {
    console.error("Error fetching email:", error)
    res.status(500).json({ error: "Failed to fetch email" })
  }
})

// Search emails using Elasticsearch
router.post("/search", async (req, res) => {
  try {
    const { query, filters = {}, page = 1, limit = 20 } = req.body

    const searchResults = await elasticsearchService.searchEmails(query, filters)

    const emailIds = searchResults.hits.map((hit: any) => hit._id)
    const emails = await Email.find({ _id: { $in: emailIds } })
      .populate("accountId", "email")
      .sort({ date: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))

    res.json({
      emails,
      total: searchResults.total.value,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(searchResults.total.value / Number(limit)),
      },
    })
  } catch (error) {
    console.error("Error searching emails:", error)
    res.status(500).json({ error: "Failed to search emails" })
  }
})

// Get email statistics
router.get("/stats/overview", async (req, res) => {
  try {
    const stats = await Email.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } },
          interested: {
            $sum: { $cond: [{ $eq: ["$aiCategory", "Interested"] }, 1, 0] },
          },
          meetingBooked: {
            $sum: { $cond: [{ $eq: ["$aiCategory", "Meeting Booked"] }, 1, 0] },
          },
          spam: { $sum: { $cond: [{ $eq: ["$aiCategory", "Spam"] }, 1, 0] } },
        },
      },
    ])

    const accountStats = await Email.aggregate([
      {
        $group: {
          _id: "$accountEmail",
          count: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } },
        },
      },
    ])

    res.json({
      overview: stats[0] || {
        total: 0,
        unread: 0,
        interested: 0,
        meetingBooked: 0,
        spam: 0,
      },
      byAccount: accountStats,
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    res.status(500).json({ error: "Failed to fetch statistics" })
  }
})

// Add new email account
router.post("/accounts", async (req, res) => {
  try {
    const { email, imapConfig } = req.body

    // Validate required fields
    if (!email || !imapConfig?.host || !imapConfig?.username || !imapConfig?.password) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    // Check if account already exists
    const existingAccount = await Account.findOne({ email })
    if (existingAccount) {
      return res.status(409).json({ error: "Account already exists" })
    }

    // Create new account
    const account = new Account({
      email,
      imapConfig: {
        host: imapConfig.host,
        port: imapConfig.port || 993,
        secure: imapConfig.secure !== false,
        username: imapConfig.username,
        password: imapConfig.password,
      },
    })

    await account.save()

    // Start IMAP connection
    await imapService.connectAccount(account)

    res.status(201).json({
      message: "Account added successfully",
      account: {
        id: account._id,
        email: account.email,
        isActive: account.isActive,
        syncStatus: account.syncStatus,
      },
    })
  } catch (error) {
    console.error("Error adding account:", error)
    res.status(500).json({ error: "Failed to add account" })
  }
})

// Get all accounts
router.get("/accounts", async (req, res) => {
  try {
    const accounts = await Account.find({}, "-imapConfig.password")
    res.json(accounts)
  } catch (error) {
    console.error("Error fetching accounts:", error)
    res.status(500).json({ error: "Failed to fetch accounts" })
  }
})

// Update account status
router.patch("/accounts/:id", async (req, res) => {
  try {
    const { isActive } = req.body
    const account = await Account.findById(req.params.id)

    if (!account) {
      return res.status(404).json({ error: "Account not found" })
    }

    if (isActive !== undefined) {
      account.isActive = isActive

      if (isActive) {
        await imapService.connectAccount(account)
      } else {
        await imapService.disconnectAccount(account._id.toString())
      }
    }

    await account.save()
    res.json({ message: "Account updated successfully" })
  } catch (error) {
    console.error("Error updating account:", error)
    res.status(500).json({ error: "Failed to update account" })
  }
})

// Delete account
router.delete("/accounts/:id", async (req, res) => {
  try {
    const account = await Account.findById(req.params.id)

    if (!account) {
      return res.status(404).json({ error: "Account not found" })
    }

    // Disconnect IMAP
    await imapService.disconnectAccount(account._id.toString())

    // Delete account and associated emails
    await Email.deleteMany({ accountId: account._id })
    await Account.findByIdAndDelete(req.params.id)

    res.json({ message: "Account deleted successfully" })
  } catch (error) {
    console.error("Error deleting account:", error)
    res.status(500).json({ error: "Failed to delete account" })
  }
})

// Force sync account
router.post("/accounts/:id/sync", async (req, res) => {
  try {
    const account = await Account.findById(req.params.id)

    if (!account) {
      return res.status(404).json({ error: "Account not found" })
    }

    // Reconnect to force sync
    await imapService.disconnectAccount(account._id.toString())
    await imapService.connectAccount(account)

    res.json({ message: "Sync initiated successfully" })
  } catch (error) {
    console.error("Error initiating sync:", error)
    res.status(500).json({ error: "Failed to initiate sync" })
  }
})

export default router
