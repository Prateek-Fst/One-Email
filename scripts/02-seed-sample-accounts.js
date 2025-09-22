// Sample email accounts for testing
// Replace with your actual email credentials

const sampleAccounts = [
  {
    email: "test1@gmail.com",
    imapConfig: {
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      username: "test1@gmail.com",
      password: "your-app-password-here",
    },
    isActive: false, // Set to true when you add real credentials
    syncStatus: "idle",
  },
  {
    email: "test2@outlook.com",
    imapConfig: {
      host: "outlook.office365.com",
      port: 993,
      secure: true,
      username: "test2@outlook.com",
      password: "your-app-password-here",
    },
    isActive: false, // Set to true when you add real credentials
    syncStatus: "idle",
  },
]

// Declare the db variable before using it
const db = require("./path-to-your-database-connection") // Replace with the actual path to your database connection

// Insert sample accounts (only if they don't exist)
sampleAccounts.forEach((account) => {
  db.accounts.updateOne({ email: account.email }, { $setOnInsert: account }, { upsert: true })
})

console.log("Sample accounts seeded (inactive by default)")
console.log("Update with real credentials and set isActive: true to use")
