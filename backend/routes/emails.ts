import express from "express"
import Email from "../models/Email"
import Account from "../models/Account"
import elasticsearchService from "../services/elasticsearchService"
import imapService from "../services/imapService"

const router = express.Router()

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Email API is working!", timestamp: new Date().toISOString() })
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

    const totalValue = typeof searchResults.total === 'number' 
      ? searchResults.total 
      : searchResults.total?.value || 0
    
    res.json({
      emails,
      total: totalValue,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(totalValue / Number(limit)),
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

// Get all accounts
router.get("/accounts", async (req, res) => {
  try {
    console.log("Fetching accounts...")
    const accounts = await Account.find({}, "-imapConfig.password")
    console.log(`Found ${accounts.length} accounts`)
    res.json(accounts)
  } catch (error:any) {
    console.error("Error fetching accounts:", error)
    console.error("Error details:", error.message)
    res.status(500).json({ error: "Failed to fetch accounts", details: error.message })
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
        await imapService.disconnectAccount((account._id as any).toString())
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
    await imapService.disconnectAccount((account._id as any).toString())

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
    await imapService.disconnectAccount((account._id as any).toString())
    await imapService.connectAccount(account)

    res.json({ message: "Sync initiated successfully" })
  } catch (error) {
    console.error("Error initiating sync:", error)
    res.status(500).json({ error: "Failed to initiate sync" })
  }
})

// Test Elasticsearch connection
router.get("/elasticsearch/test", async (req, res) => {
  try {
    const isHealthy = elasticsearchService.isHealthy()
    const stats = await elasticsearchService.getStats()
    
    res.json({
      healthy: isHealthy,
      stats,
      message: isHealthy ? "Elasticsearch is working!" : "Elasticsearch is not available"
    })
  } catch (error:any) {
    console.error("Elasticsearch test error:", error)
    res.status(500).json({ error: "Elasticsearch test failed", details: error.message })
  }
})

// Get emails with pagination and filters
router.get("/", async (req, res) => {
  try {
    const { page = 1, perAccount = 5, accountId, folder, category, search, isRead } = req.query

    let emails = []
    let total = 0

    if (accountId && accountId !== "all") {
      // Single account - fetch more emails per page
      const limit = Number(perAccount) * 2 // Double for single account
      const filters: any = { accountId }
      if (folder) filters.folder = folder
      if (category) filters.aiCategory = category
      if (isRead !== undefined) filters.isRead = isRead === "true"

      if (search && elasticsearchService.isHealthy()) {
        const searchResults = await elasticsearchService.searchEmails(
          search as string,
          filters,
          { page: Number(page), limit }
        )
        const emailIds = searchResults.hits.map((hit: any) => hit._id)
        emails = await Email.find({ _id: { $in: emailIds } })
          .populate("accountId", "email")
          .sort({ date: -1 })
        total = typeof searchResults.total === 'number' 
          ? searchResults.total 
          : searchResults.total?.value || 0
      } else {
        const query: any = { accountId }
        if (folder) query.folder = folder
        if (category) query.aiCategory = category
        if (isRead !== undefined) query.isRead = isRead === "true"
        
        if (search) {
          query.$or = [
            { subject: { $regex: search, $options: 'i' } },
            { 'from.address': { $regex: search, $options: 'i' } },
            { 'from.name': { $regex: search, $options: 'i' } },
            { 'body.text': { $regex: search, $options: 'i' } }
          ]
        }
        
        emails = await Email.find(query)
          .populate("accountId", "email")
          .sort({ date: -1 })
          .limit(limit)
          .skip((Number(page) - 1) * limit)
        
        total = await Email.countDocuments(query)
      }
    } else {
      // All accounts - fetch specified number per account
      const accounts = await Account.find({ isActive: true }, "_id email")
      const emailsPerAccount = Number(perAccount)
      const skip = (Number(page) - 1) * emailsPerAccount
      
      const emailPromises = accounts.map(async (account) => {
        const query: any = { accountId: account._id }
        if (folder) query.folder = folder
        if (category) query.aiCategory = category
        if (isRead !== undefined) query.isRead = isRead === "true"
        
        if (search) {
          query.$or = [
            { subject: { $regex: search, $options: 'i' } },
            { 'from.address': { $regex: search, $options: 'i' } },
            { 'from.name': { $regex: search, $options: 'i' } },
            { 'body.text': { $regex: search, $options: 'i' } }
          ]
        }
        
        return Email.find(query)
          .populate("accountId", "email")
          .sort({ date: -1 })
          .limit(emailsPerAccount)
          .skip(skip)
      })
      
      const accountEmails = await Promise.all(emailPromises)
      emails = accountEmails.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // Calculate total for pagination
      const totalPromises = accounts.map(async (account) => {
        const query: any = { accountId: account._id }
        if (folder) query.folder = folder
        if (category) query.aiCategory = category
        if (isRead !== undefined) query.isRead = isRead === "true"
        if (search) {
          query.$or = [
            { subject: { $regex: search, $options: 'i' } },
            { 'from.address': { $regex: search, $options: 'i' } },
            { 'from.name': { $regex: search, $options: 'i' } },
            { 'body.text': { $regex: search, $options: 'i' } }
          ]
        }
        return Email.countDocuments(query)
      })
      
      const accountTotals = await Promise.all(totalPromises)
      total = Math.min(...accountTotals) * accounts.length // Use minimum to determine when to stop loading
    }

    const activeAccountCount = await Account.countDocuments({ isActive: true })
    const expectedEmailCount = accountId && accountId !== "all" 
      ? Number(perAccount) * 2 
      : Number(perAccount) * activeAccountCount
    
    console.log(`Page ${page}: Found ${emails.length} emails, expected ${expectedEmailCount}, hasMore: ${emails.length >= expectedEmailCount}`)
    
    res.json({
      emails,
      pagination: {
        page: Number(page),
        perAccount: Number(perAccount),
        total,
        hasMore: emails.length >= expectedEmailCount,
      },
      searchEngine: search ? (elasticsearchService.isHealthy() ? "elasticsearch" : "mongodb") : "mongodb"
    })
  } catch (error) {
    console.error("Error fetching emails:", error)
    res.status(500).json({ error: "Failed to fetch emails" })
  }
})

// Get specific email (MUST be last to avoid conflicts)
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

export default router