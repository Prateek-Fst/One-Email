import Imap from "imap"
import { simpleParser } from "mailparser"
import Email from "../models/Email"
import Account from "../models/Account"
import elasticsearchService from "./elasticsearchService"
import aiService from "./aiService"
import webhookService from "./webhookService"

class ImapService {
  private connections: Map<string, Imap> = new Map()

  async initialize() {
    console.log("Initializing IMAP service...")
    const accounts = await Account.find({ isActive: true })

    for (const account of accounts) {
      await this.connectAccount(account)
    }
  }

  async connectAccount(account: any) {
    try {
      const imap = new Imap({
        user: account.imapConfig.username,
        password: account.imapConfig.password,
        host: account.imapConfig.host,
        port: account.imapConfig.port,
        tls: account.imapConfig.secure,
        tlsOptions: { rejectUnauthorized: false },
      })

      imap.once("ready", () => {
        console.log(`IMAP connected for ${account.email}`)
        this.setupIdleMode(imap, account)
        this.syncRecentEmails(imap, account)
      })

      imap.once("error", (err: Error) => {
        console.error(`IMAP error for ${account.email}:`, err)
        account.syncStatus = "error"
        account.errorMessage = err.message
        account.save()
      })

      imap.once("end", () => {
        console.log(`IMAP connection ended for ${account.email}`)
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.connectAccount(account), 5000)
      })

      imap.connect()
      this.connections.set(account._id.toString(), imap)
    } catch (error) {
      console.error(`Failed to connect IMAP for ${account.email}:`, error)
    }
  }

  private setupIdleMode(imap: Imap, account: any) {
    imap.openBox("INBOX", false, (err) => {
      if (err) {
        console.error("Error opening INBOX:", err)
        return
      }

      // Set up IDLE mode for real-time updates
      imap.on("mail", (numNewMsgs: number) => {
        console.log(`${numNewMsgs} new messages for ${account.email}`)
        this.fetchNewEmails(imap, account, numNewMsgs)
      })

      // Start IDLE
      imap.on("ready", () => {
        if (imap.serverSupports("IDLE")) {
          console.log(`Starting IDLE mode for ${account.email}`)
        }
      })
    })
  }

  private async syncRecentEmails(imap: Imap, account: any) {
    try {
      account.syncStatus = "syncing"
      await account.save()

      // Fetch emails from last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      imap.openBox("INBOX", true, (err) => {
        if (err) throw err

        imap.search(["SINCE", thirtyDaysAgo], (err, results) => {
          if (err) throw err

          if (results.length === 0) {
            console.log(`No recent emails found for ${account.email}`)
            account.syncStatus = "idle"
            account.lastSyncDate = new Date()
            account.save()
            return
          }

          this.processEmails(imap, account, results)
        })
      })
    } catch (error) {
      console.error(`Error syncing emails for ${account.email}:`, error)
      account.syncStatus = "error"
      account.errorMessage = error.message
      await account.save()
    }
  }

  private async fetchNewEmails(imap: Imap, account: any, count: number) {
    imap.search(["UNSEEN"], (err, results) => {
      if (err) {
        console.error("Error searching for new emails:", err)
        return
      }

      if (results.length > 0) {
        this.processEmails(imap, account, results.slice(-count))
      }
    })
  }

  private async processEmails(imap: Imap, account: any, uids: number[]) {
    const fetch = imap.fetch(uids, {
      bodies: "",
      struct: true,
      envelope: true,
    })

    fetch.on("message", (msg, seqno) => {
      let buffer = ""
      let attributes: any

      msg.on("body", (stream) => {
        stream.on("data", (chunk) => {
          buffer += chunk.toString("utf8")
        })
      })

      msg.once("attributes", (attrs) => {
        attributes = attrs
      })

      msg.once("end", async () => {
        try {
          const parsed = await simpleParser(buffer)

          // Check if email already exists
          const existingEmail = await Email.findOne({
            messageId: parsed.messageId,
          })

          if (existingEmail) {
            return // Skip if already processed
          }

          // Create email document
          const emailDoc = new Email({
            messageId: parsed.messageId,
            accountId: account._id,
            accountEmail: account.email,
            subject: parsed.subject || "No Subject",
            from: {
              name: parsed.from?.value[0]?.name,
              address: parsed.from?.value[0]?.address,
            },
            to:
              parsed.to?.value?.map((addr: any) => ({
                name: addr.name,
                address: addr.address,
              })) || [],
            cc:
              parsed.cc?.value?.map((addr: any) => ({
                name: addr.name,
                address: addr.address,
              })) || [],
            date: parsed.date || new Date(),
            body: {
              text: parsed.text,
              html: parsed.html,
            },
            folder: "INBOX",
            flags: attributes.flags || [],
            uid: attributes.uid,
            isRead: attributes.flags?.includes("\\Seen") || false,
          })

          // Save to MongoDB
          await emailDoc.save()

          // Index in Elasticsearch
          await elasticsearchService.indexEmail(emailDoc)

          // AI categorization
          const category = await aiService.categorizeEmail(emailDoc)
          if (category) {
            emailDoc.aiCategory = category.category
            emailDoc.aiConfidence = category.confidence
            await emailDoc.save()

            // Send webhook for interested emails
            if (category.category === "Interested") {
              await webhookService.sendInterestedNotification(emailDoc)
            }
          }

          console.log(`Processed email: ${parsed.subject}`)
        } catch (error) {
          console.error("Error processing email:", error)
        }
      })
    })

    fetch.once("error", (err) => {
      console.error("Fetch error:", err)
    })

    fetch.once("end", () => {
      console.log(`Finished processing ${uids.length} emails for ${account.email}`)
      account.syncStatus = "idle"
      account.lastSyncDate = new Date()
      account.save()
    })
  }

  async disconnectAccount(accountId: string) {
    const connection = this.connections.get(accountId)
    if (connection) {
      connection.end()
      this.connections.delete(accountId)
    }
  }
}

export default new ImapService()
