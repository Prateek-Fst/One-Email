// MongoDB indexes for optimal performance
// Run this script with: mongosh "mongodb+srv://..." --file 01-create-indexes.js

// Switch to email-onebox database
use('email-onebox')

// Email collection indexes
db.emails.createIndex({ messageId: 1 }, { unique: true })
db.emails.createIndex({ accountId: 1, folder: 1, date: -1 })
db.emails.createIndex({ aiCategory: 1 })
db.emails.createIndex({ isRead: 1 })
db.emails.createIndex({ date: -1 })
db.emails.createIndex({ "from.address": 1 })
db.emails.createIndex({ accountEmail: 1 })

// Compound indexes for common queries
db.emails.createIndex({ accountId: 1, isRead: 1, date: -1 })
db.emails.createIndex({ aiCategory: 1, date: -1 })
db.emails.createIndex({ accountEmail: 1, folder: 1, date: -1 })

// Text index for basic search (fallback when Elasticsearch is not available)
db.emails.createIndex({
  subject: "text",
  "body.text": "text",
  "from.name": "text",
  "from.address": "text",
})

// Account collection indexes
db.accounts.createIndex({ email: 1 }, { unique: true })
db.accounts.createIndex({ isActive: 1 })
db.accounts.createIndex({ syncStatus: 1 })

print("MongoDB indexes created successfully")
