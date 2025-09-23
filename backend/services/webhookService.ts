import axios from "axios"
import crypto from "crypto"

interface WebhookPayload {
  event: string
  timestamp: string
  data: any
  signature?: string
}

interface SlackAttachment {
  color: string
  title: string
  text: string
  fields: Array<{
    title: string
    value: string
    short: boolean
  }>
  footer: string
  ts: number
}

class WebhookService {
  private readonly WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "default-secret"
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 1000

  async sendInterestedNotification(email: any) {
    try {
      // Send Slack notification
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackNotification(email)
      }

      // Send external webhook
      if (process.env.EXTERNAL_WEBHOOK_URL) {
        await this.sendExternalWebhook(email)
      }

      // Send to multiple webhook URLs if configured
      await this.sendToMultipleWebhooks(email)
    } catch (error) {
      console.error("Error sending webhook notifications:", error)
    }
  }

  async sendSlackNotification(email: any) {
    try {
      const attachment: SlackAttachment = {
        color: this.getCategoryColor(email.aiCategory),
        title: `🎯 New ${email.aiCategory || "Categorized"} Email`,
        text: email.subject,
        fields: [
          {
            title: "From",
            value: `${email.from.name || email.from.address} <${email.from.address}>`,
            short: true,
          },
          {
            title: "Account",
            value: email.accountEmail,
            short: true,
          },
          {
            title: "AI Confidence",
            value: `${Math.round((email.aiConfidence || 0) * 100)}%`,
            short: true,
          },
          {
            title: "Date",
            value: new Date(email.date).toLocaleString(),
            short: true,
          },
          {
            title: "Preview",
            value: this.truncateText(email.body.text || "", 200),
            short: false,
          },
        ],
        footer: "Email Onebox",
        ts: Math.floor(Date.now() / 1000),
      }

      const message = {
        text: `New ${email.aiCategory || "categorized"} email received`,
        attachments: [attachment],
        username: "Email Onebox",
        icon_emoji: ":email:",
      }

      await this.sendWithRetry(process.env.SLACK_WEBHOOK_URL!, message)
      console.log("Slack notification sent successfully")
    } catch (error) {
      console.error("Error sending Slack notification:", error)
      throw error
    }
  }

  async sendExternalWebhook(email: any) {
    try {
      const payload: WebhookPayload = {
        event: "email_interested",
        timestamp: new Date().toISOString(),
        data: {
          emailId: email._id,
          messageId: email.messageId,
          from: email.from,
          to: email.to,
          subject: email.subject,
          accountEmail: email.accountEmail,
          date: email.date,
          aiCategory: email.aiCategory,
          aiConfidence: email.aiConfidence,
          preview: this.truncateText(email.body.text || "", 300),
          isRead: email.isRead,
          folder: email.folder,
        },
      }

      // Add signature for webhook verification
      payload.signature = this.generateSignature(JSON.stringify(payload.data))

      await this.sendWithRetry(process.env.EXTERNAL_WEBHOOK_URL!, payload, {
        "Content-Type": "application/json",
        "User-Agent": "EmailOnebox/1.0",
        "X-Webhook-Signature": payload.signature,
      })

      console.log("External webhook sent successfully")
    } catch (error) {
      console.error("Error sending external webhook:", error)
      throw error
    }
  }

  async sendToMultipleWebhooks(email: any) {
    const webhookUrls = process.env.ADDITIONAL_WEBHOOK_URLS?.split(",") || []

    if (webhookUrls.length === 0) return

    const promises = webhookUrls.map(async (url) => {
      try {
        const payload = {
          event: "email_categorized",
          timestamp: new Date().toISOString(),
          email: {
            id: email._id,
            subject: email.subject,
            from: email.from.address,
            category: email.aiCategory,
            confidence: email.aiConfidence,
            account: email.accountEmail,
          },
        }

        await this.sendWithRetry(url.trim(), payload)
        console.log(`Webhook sent to ${url}`)
      } catch (error) {
        console.error(`Failed to send webhook to ${url}:`, error)
      }
    })

    await Promise.allSettled(promises)
  }

  async sendCustomWebhook(url: string, event: string, data: any, headers: Record<string, string> = {}) {
    try {
      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      }

      payload.signature = this.generateSignature(JSON.stringify(data))

      const defaultHeaders = {
        "Content-Type": "application/json",
        "User-Agent": "EmailOnebox/1.0",
        "X-Webhook-Signature": payload.signature,
        ...headers,
      }

      await this.sendWithRetry(url, payload, defaultHeaders)
      return true
    } catch (error) {
      console.error("Error sending custom webhook:", error)
      return false
    }
  }

  async sendTestWebhook(url?: string) {
    try {
      const testUrl = url || process.env.EXTERNAL_WEBHOOK_URL
      if (!testUrl) {
        throw new Error("No webhook URL provided")
      }

      const testPayload: WebhookPayload = {
        event: "test_webhook",
        timestamp: new Date().toISOString(),
        data: {
          message: "This is a test webhook from Email Onebox",
          version: "1.0.0",
          test: true,
        },
      }

      testPayload.signature = this.generateSignature(JSON.stringify(testPayload.data))

      await this.sendWithRetry(testUrl, testPayload)
      console.log("Test webhook sent successfully")
      return true
    } catch (error) {
      console.error("Error sending test webhook:", error)
      return false
    }
  }

  async sendBulkNotification(emails: any[], event = "bulk_email_processed") {
    try {
      const summary = {
        total: emails.length,
        byCategory: this.groupByCategory(emails),
        byAccount: this.groupByAccount(emails),
        processed_at: new Date().toISOString(),
      }

      // Send Slack summary
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackBulkSummary(summary)
      }

      // Send webhook summary
      if (process.env.EXTERNAL_WEBHOOK_URL) {
        const payload = {
          event,
          timestamp: new Date().toISOString(),
          data: summary,
        }

        await this.sendWithRetry(process.env.EXTERNAL_WEBHOOK_URL, payload)
      }

      return true
    } catch (error) {
      console.error("Error sending bulk notification:", error)
      return false
    }
  }

  private async sendSlackBulkSummary(summary: any) {
    const categoryFields = Object.entries(summary.byCategory).map(([category, count]) => ({
      title: category,
      value: (count as number).toString(),
      short: true,
    }))

    const accountFields = Object.entries(summary.byAccount).map(([account, count]) => ({
      title: account,
      value: (count as number).toString(),
      short: true,
    }))

    const message = {
      text: `📊 Bulk Email Processing Summary`,
      attachments: [
        {
          color: "#36a64f",
          title: `Processed ${summary.total} emails`,
          fields: [
            {
              title: "📂 By Category",
              value: categoryFields.map((f) => `${f.title}: ${f.value}`).join("\n"),
              short: true,
            },
            {
              title: "📧 By Account",
              value: accountFields.map((f) => `${f.title}: ${f.value}`).join("\n"),
              short: true,
            },
          ],
          footer: "Email Onebox",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }

    await this.sendWithRetry(process.env.SLACK_WEBHOOK_URL!, message)
  }

  private async sendWithRetry(url: string, payload: any, headers: Record<string, string> = {}, retries = 0): Promise<any> {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        timeout: 10000,
      })

      return response.data
    } catch (error) {
      if (retries < this.MAX_RETRIES) {
        console.log(`Webhook failed, retrying... (${retries + 1}/${this.MAX_RETRIES})`)
        await this.delay(this.RETRY_DELAY * Math.pow(2, retries))
        return this.sendWithRetry(url, payload, headers, retries + 1)
      }
      throw error
    }
  }

  private generateSignature(payload: string): string {
    return crypto.createHmac("sha256", this.WEBHOOK_SECRET).update(payload).digest("hex")
  }

  private getCategoryColor(category?: string): string {
    const colors = {
      Interested: "#28a745",
      "Meeting Booked": "#007bff",
      "Not Interested": "#dc3545",
      Spam: "#fd7e14",
      "Out of Office": "#6f42c1",
    }
    return colors[category as keyof typeof colors] || "#6c757d"
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }

  private groupByCategory(emails: any[]): Record<string, number> {
    return emails.reduce((acc, email) => {
      const category = email.aiCategory || "Uncategorized"
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {})
  }

  private groupByAccount(emails: any[]): Record<string, number> {
    return emails.reduce((acc, email) => {
      const account = email.accountEmail || "Unknown"
      acc[account] = (acc[account] || 0) + 1
      return acc
    }, {})
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Webhook verification for incoming webhooks
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = this.generateSignature(payload)
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  }

  // Get webhook statistics
  async getWebhookStats(): Promise<{
    totalSent: number
    successRate: number
    lastSent: Date | null
    errors: string[]
  }> {
    // This would typically be stored in a database
    // For now, return mock data
    return {
      totalSent: 0,
      successRate: 0,
      lastSent: null,
      errors: [],
    }
  }
}

export default new WebhookService()
