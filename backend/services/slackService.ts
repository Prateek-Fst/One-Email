import axios from "axios"

interface SlackMessage {
  text: string
  channel?: string
  username?: string
  icon_emoji?: string
  attachments?: SlackAttachment[]
  blocks?: any[]
}

interface SlackAttachment {
  color?: string
  title?: string
  text?: string
  fields?: SlackField[]
  footer?: string
  ts?: number
}

interface SlackField {
  title: string
  value: string
  short: boolean
}

class SlackService {
  private readonly webhookUrl: string | undefined
  private readonly botToken: string | undefined

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL
    this.botToken = process.env.SLACK_BOT_TOKEN
  }

  async sendMessage(message: SlackMessage): Promise<boolean> {
    try {
      if (!this.webhookUrl) {
        console.warn("Slack webhook URL not configured")
        return false
      }

      const response = await axios.post(this.webhookUrl, message, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      })

      return response.status === 200
    } catch (error) {
      console.error("Error sending Slack message:", error)
      return false
    }
  }

  async sendEmailAlert(email: any): Promise<boolean> {
    const message: SlackMessage = {
      text: `🚨 New ${email.aiCategory || "Categorized"} Email Alert`,
      username: "Email Onebox",
      icon_emoji: ":email:",
      attachments: [
        {
          color: this.getCategoryColor(email.aiCategory),
          title: email.subject,
          text: `From: ${email.from.name || email.from.address}`,
          fields: [
            {
              title: "Account",
              value: email.accountEmail,
              short: true,
            },
            {
              title: "Category",
              value: email.aiCategory || "Uncategorized",
              short: true,
            },
            {
              title: "Confidence",
              value: `${Math.round((email.aiConfidence || 0) * 100)}%`,
              short: true,
            },
            {
              title: "Date",
              value: new Date(email.date).toLocaleString(),
              short: true,
            },
          ],
          footer: "Email Onebox",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }

    return this.sendMessage(message)
  }

  async sendDailySummary(stats: any): Promise<boolean> {
    const message: SlackMessage = {
      text: "📊 Daily Email Summary",
      username: "Email Onebox",
      icon_emoji: ":chart_with_upwards_trend:",
      attachments: [
        {
          color: "#36a64f",
          title: "Email Processing Summary",
          fields: [
            {
              title: "Total Emails",
              value: stats.total.toString(),
              short: true,
            },
            {
              title: "Interested",
              value: stats.interested.toString(),
              short: true,
            },
            {
              title: "Meetings Booked",
              value: stats.meetingBooked.toString(),
              short: true,
            },
            {
              title: "Not Interested",
              value: stats.notInterested.toString(),
              short: true,
            },
          ],
          footer: "Email Onebox Daily Report",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }

    return this.sendMessage(message)
  }

  async sendErrorAlert(error: string, context?: any): Promise<boolean> {
    const message: SlackMessage = {
      text: "🚨 Email Onebox Error Alert",
      username: "Email Onebox",
      icon_emoji: ":warning:",
      attachments: [
        {
          color: "#ff0000",
          title: "System Error Detected",
          text: error,
          fields: context
            ? [
                {
                  title: "Context",
                  value: JSON.stringify(context, null, 2),
                  short: false,
                },
              ]
            : [],
          footer: "Email Onebox Error Monitor",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }

    return this.sendMessage(message)
  }

  async sendCustomMessage(text: string, options: Partial<SlackMessage> = {}): Promise<boolean> {
    const message: SlackMessage = {
      text,
      username: "Email Onebox",
      icon_emoji: ":robot_face:",
      ...options,
    }

    return this.sendMessage(message)
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

  isConfigured(): boolean {
    return !!this.webhookUrl || !!this.botToken
  }
}

export default new SlackService()
