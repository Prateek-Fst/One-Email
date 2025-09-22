import OpenAI from "openai"
import Email from "../models/Email"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface EmailCategory {
  category: "Interested" | "Meeting Booked" | "Not Interested" | "Spam" | "Out of Office"
  confidence: number
  reasoning?: string
}

export interface BatchCategorization {
  emailId: string
  category: EmailCategory | null
  error?: string
}

class AIService {
  private readonly BATCH_SIZE = 10
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 1000

  async categorizeEmail(email: any): Promise<EmailCategory | null> {
    try {
      const emailContent = this.prepareEmailContent(email)

      const prompt = `
Analyze this email and categorize it into one of these categories with high accuracy:

**Categories:**
- **Interested**: Positive responses, inquiries, requests for more information, expressions of interest
- **Meeting Booked**: Calendar invites, meeting confirmations, scheduling requests, appointment bookings
- **Not Interested**: Rejections, unsubscribes, negative responses, "not at this time" messages
- **Spam**: Promotional content, suspicious emails, mass marketing, phishing attempts
- **Out of Office**: Auto-replies, vacation messages, away notifications, automated responses

**Email to analyze:**
${emailContent}

**Instructions:**
1. Consider the sender's intent and the email's purpose
2. Look for key phrases and context clues
3. Provide a confidence score between 0.1 and 1.0
4. Include brief reasoning for your decision

Respond with only a JSON object in this exact format:
{
  "category": "category_name",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this category was chosen"
}
      `

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are an expert email classifier with high accuracy. Analyze emails carefully and categorize them precisely based on sender intent and content context.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      })

      const result = response.choices[0]?.message?.content
      if (!result) return null

      try {
        const parsed = JSON.parse(result)
        return {
          category: parsed.category,
          confidence: Math.max(0.1, Math.min(1.0, parsed.confidence)),
          reasoning: parsed.reasoning,
        }
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError)
        return null
      }
    } catch (error) {
      console.error("Error categorizing email:", error)
      return null
    }
  }

  async batchCategorizeEmails(emailIds: string[]): Promise<BatchCategorization[]> {
    const results: BatchCategorization[] = []
    const batches = this.chunkArray(emailIds, this.BATCH_SIZE)

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(async (emailId) => {
          const email = await Email.findById(emailId)
          if (!email) {
            return { emailId, category: null, error: "Email not found" }
          }

          const category = await this.categorizeEmailWithRetry(email)
          return { emailId, category }
        }),
      )

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value)
        } else {
          results.push({
            emailId: "unknown",
            category: null,
            error: result.reason?.message || "Unknown error",
          })
        }
      }

      // Add delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(500)
      }
    }

    return results
  }

  async recategorizeAllEmails(): Promise<{
    processed: number
    successful: number
    failed: number
  }> {
    const uncategorizedEmails = await Email.find({
      $or: [{ aiCategory: { $exists: false } }, { aiCategory: null }],
    }).select("_id")

    const emailIds = uncategorizedEmails.map((email) => email._id.toString())
    const results = await this.batchCategorizeEmails(emailIds)

    let successful = 0
    let failed = 0

    for (const result of results) {
      if (result.category && !result.error) {
        try {
          await Email.findByIdAndUpdate(result.emailId, {
            aiCategory: result.category.category,
            aiConfidence: result.category.confidence,
          })
          successful++
        } catch (error) {
          console.error(`Error updating email ${result.emailId}:`, error)
          failed++
        }
      } else {
        failed++
      }
    }

    return {
      processed: results.length,
      successful,
      failed,
    }
  }

  async generateReply(email: any, context: string): Promise<string | null> {
    try {
      const emailContent = this.prepareEmailContent(email)

      const prompt = `
You are an AI assistant helping to generate professional email replies.

**Context about my business/purpose:**
${context}

**Email I received:**
${emailContent}

**Instructions:**
Generate a professional, helpful reply that:
1. Addresses the sender's inquiry appropriately
2. Uses the context information when relevant
3. Is concise and professional (2-4 paragraphs max)
4. Includes any relevant links or information from the context
5. Maintains a friendly but professional tone
6. Ends with an appropriate call-to-action if needed

**Reply:**
      `

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a professional email assistant. Generate helpful, concise, and contextually appropriate replies.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 400,
      })

      return response.choices[0]?.message?.content || null
    } catch (error) {
      console.error("Error generating reply:", error)
      return null
    }
  }

  async generateBulkReplies(
    emailIds: string[],
    context: string,
  ): Promise<Array<{ emailId: string; reply: string | null; error?: string }>> {
    const results = []

    for (const emailId of emailIds) {
      try {
        const email = await Email.findById(emailId)
        if (!email) {
          results.push({ emailId, reply: null, error: "Email not found" })
          continue
        }

        const reply = await this.generateReply(email, context)
        results.push({ emailId, reply })

        // Add delay to respect rate limits
        await this.delay(200)
      } catch (error) {
        results.push({
          emailId,
          reply: null,
          error: error.message || "Unknown error",
        })
      }
    }

    return results
  }

  async analyzeEmailSentiment(email: any): Promise<{
    sentiment: "positive" | "negative" | "neutral"
    score: number
    emotions: string[]
  } | null> {
    try {
      const emailContent = this.prepareEmailContent(email)

      const prompt = `
Analyze the sentiment and emotions in this email:

${emailContent}

Provide a JSON response with:
- sentiment: "positive", "negative", or "neutral"
- score: number between -1 (very negative) and 1 (very positive)
- emotions: array of detected emotions (e.g., ["excited", "frustrated", "curious"])

Response format:
{
  "sentiment": "positive",
  "score": 0.7,
  "emotions": ["excited", "interested"]
}
      `

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert in sentiment analysis and emotion detection.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 150,
      })

      const result = response.choices[0]?.message?.content
      if (!result) return null

      return JSON.parse(result)
    } catch (error) {
      console.error("Error analyzing sentiment:", error)
      return null
    }
  }

  async extractKeyInformation(email: any): Promise<{
    keyPoints: string[]
    actionItems: string[]
    mentions: {
      people: string[]
      companies: string[]
      dates: string[]
      amounts: string[]
    }
  } | null> {
    try {
      const emailContent = this.prepareEmailContent(email)

      const prompt = `
Extract key information from this email:

${emailContent}

Provide a JSON response with:
- keyPoints: main points or topics discussed
- actionItems: any tasks or actions mentioned
- mentions: people, companies, dates, and monetary amounts mentioned

Response format:
{
  "keyPoints": ["Main topic 1", "Main topic 2"],
  "actionItems": ["Schedule meeting", "Send proposal"],
  "mentions": {
    "people": ["John Smith", "Sarah Johnson"],
    "companies": ["Acme Corp", "Tech Solutions"],
    "dates": ["next Tuesday", "March 15th"],
    "amounts": ["$10,000", "50% discount"]
  }
}
      `

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting structured information from emails.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
      })

      const result = response.choices[0]?.message?.content
      if (!result) return null

      return JSON.parse(result)
    } catch (error) {
      console.error("Error extracting key information:", error)
      return null
    }
  }

  private async categorizeEmailWithRetry(email: any, retries = 0): Promise<EmailCategory | null> {
    try {
      return await this.categorizeEmail(email)
    } catch (error) {
      if (retries < this.MAX_RETRIES) {
        await this.delay(this.RETRY_DELAY * Math.pow(2, retries))
        return this.categorizeEmailWithRetry(email, retries + 1)
      }
      console.error(`Failed to categorize email after ${this.MAX_RETRIES} retries:`, error)
      return null
    }
  }

  private prepareEmailContent(email: any): string {
    const subject = email.subject || "No Subject"
    const fromName = email.from?.name || "Unknown"
    const fromAddress = email.from?.address || "unknown@unknown.com"
    const bodyText = email.body?.text || email.body?.html?.replace(/<[^>]*>/g, "") || ""

    // Truncate very long emails to avoid token limits
    const truncatedBody = bodyText.length > 2000 ? bodyText.substring(0, 2000) + "..." : bodyText

    return `
Subject: ${subject}
From: ${fromName} <${fromAddress}>
Body: ${truncatedBody}
    `.trim()
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async getCategorizationStats(): Promise<{
    total: number
    categorized: number
    uncategorized: number
    byCategory: Record<string, number>
    averageConfidence: number
  }> {
    try {
      const stats = await Email.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            categorized: {
              $sum: {
                $cond: [{ $ne: ["$aiCategory", null] }, 1, 0],
              },
            },
            uncategorized: {
              $sum: {
                $cond: [{ $eq: ["$aiCategory", null] }, 1, 0],
              },
            },
            averageConfidence: { $avg: "$aiConfidence" },
          },
        },
      ])

      const categoryStats = await Email.aggregate([
        {
          $match: { aiCategory: { $ne: null } },
        },
        {
          $group: {
            _id: "$aiCategory",
            count: { $sum: 1 },
          },
        },
      ])

      const byCategory: Record<string, number> = {}
      categoryStats.forEach((stat) => {
        byCategory[stat._id] = stat.count
      })

      return {
        total: stats[0]?.total || 0,
        categorized: stats[0]?.categorized || 0,
        uncategorized: stats[0]?.uncategorized || 0,
        byCategory,
        averageConfidence: stats[0]?.averageConfidence || 0,
      }
    } catch (error) {
      console.error("Error getting categorization stats:", error)
      return {
        total: 0,
        categorized: 0,
        uncategorized: 0,
        byCategory: {},
        averageConfidence: 0,
      }
    }
  }
}

export default new AIService()
