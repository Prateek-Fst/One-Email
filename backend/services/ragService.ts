import OpenAI from "openai"
import vectorService from "./vectorService"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface RAGResponse {
  reply: string
  confidence: number
  sources: Array<{
    content: string
    similarity: number
    type: string
  }>
  reasoning: string
}

class RAGService {
  async generateContextualReply(email: any, userContext?: string): Promise<RAGResponse | null> {
    try {
      // Prepare email content for analysis
      const emailContent = this.prepareEmailContent(email)

      // Search for relevant context from vector store
      const relevantDocs = await this.findRelevantContext(emailContent)

      // Generate reply using RAG
      const ragResponse = await this.generateReplyWithContext(emailContent, relevantDocs, userContext)

      return ragResponse
    } catch (error) {
      console.error("Error generating contextual reply:", error)
      return null
    }
  }

  async generateMultipleReplies(email: any, count = 3): Promise<RAGResponse[]> {
    try {
      const emailContent = this.prepareEmailContent(email)
      const relevantDocs = await this.findRelevantContext(emailContent)

      const replies: RAGResponse[] = []

      for (let i = 0; i < count; i++) {
        const reply = await this.generateReplyWithContext(emailContent, relevantDocs, undefined, i)
        if (reply) {
          replies.push(reply)
        }
      }

      return replies
    } catch (error) {
      console.error("Error generating multiple replies:", error)
      return []
    }
  }

  private async findRelevantContext(emailContent: string): Promise<any[]> {
    try {
      // Search for different types of relevant content
      const [productInfo, outreachTemplates, responseTemplates] = await Promise.all([
        vectorService.searchSimilar(emailContent, "product", 3),
        vectorService.searchSimilar(emailContent, "outreach", 2),
        vectorService.searchSimilar(emailContent, "template", 2),
      ])

      return [...productInfo, ...outreachTemplates, ...responseTemplates]
    } catch (error) {
      console.error("Error finding relevant context:", error)
      return []
    }
  }

  private async generateReplyWithContext(
    emailContent: string,
    relevantDocs: any[],
    userContext?: string,
    variation = 0,
  ): Promise<RAGResponse | null> {
    try {
      // Prepare context from relevant documents
      const contextText = relevantDocs
        .map((doc, index) => `Context ${index + 1} (${doc.metadata.type}): ${doc.content}`)
        .join("\n\n")

      const prompt = `
You are an AI assistant helping to generate professional email replies using relevant context information.

**Email received:**
${emailContent}

**Relevant context information:**
${contextText}

${userContext ? `**Additional user context:**\n${userContext}` : ""}

**Instructions:**
1. Generate a professional, helpful reply that addresses the sender's inquiry
2. Use the context information when relevant and appropriate
3. Include specific details like pricing, features, or booking links when mentioned in context
4. Keep the tone professional but friendly
5. Be concise but comprehensive
6. ${variation > 0 ? `Provide a different approach/tone than previous variations` : ""}

**Requirements:**
- Address the sender's specific needs or questions
- Include relevant information from the context
- End with an appropriate call-to-action
- Maintain professional email etiquette

Generate the reply and explain your reasoning:
      `

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are an expert email assistant. Generate professional, contextually appropriate replies using the provided information.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7 + variation * 0.1, // Slight variation for multiple replies
        max_tokens: 500,
      })

      const fullResponse = response.choices[0]?.message?.content || ""

      // Extract reply and reasoning (simple parsing)
      const replyMatch = fullResponse.match(/Reply:(.*?)(?:Reasoning:|$)/s)
      const reasoningMatch = fullResponse.match(/Reasoning:(.*?)$/s)

      const reply = replyMatch ? replyMatch[1].trim() : fullResponse
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : "Generated based on email content and context"

      // Calculate confidence based on context relevance
      const avgSimilarity =
        relevantDocs.length > 0 ? relevantDocs.reduce((sum, doc) => sum + doc.similarity, 0) / relevantDocs.length : 0

      return {
        reply,
        confidence: Math.min(0.95, 0.5 + avgSimilarity * 0.5),
        sources: relevantDocs.map((doc) => ({
          content: doc.content.substring(0, 100) + "...",
          similarity: doc.similarity,
          type: doc.metadata.type,
        })),
        reasoning,
      }
    } catch (error) {
      console.error("Error generating reply with context:", error)
      return null
    }
  }

  async improveReply(originalReply: string, feedback: string, emailContent: string): Promise<string | null> {
    try {
      const prompt = `
Improve this email reply based on the feedback provided:

**Original Reply:**
${originalReply}

**Feedback:**
${feedback}

**Original Email Context:**
${emailContent}

**Instructions:**
Generate an improved version of the reply that addresses the feedback while maintaining professionalism and relevance to the original email.
      `

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert email assistant. Improve email replies based on user feedback.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 400,
      })

      return response.choices[0]?.message?.content || null
    } catch (error) {
      console.error("Error improving reply:", error)
      return null
    }
  }

  async analyzeEmailIntent(emailContent: string): Promise<{
    intent: string
    confidence: number
    suggestedActions: string[]
  } | null> {
    try {
      const prompt = `
Analyze the intent of this email and suggest appropriate actions:

**Email:**
${emailContent}

Provide a JSON response with:
- intent: primary intent (e.g., "inquiry", "complaint", "meeting_request", "follow_up")
- confidence: confidence score (0-1)
- suggestedActions: array of suggested actions

Example:
{
  "intent": "inquiry",
  "confidence": 0.9,
  "suggestedActions": ["send_product_info", "schedule_demo", "provide_pricing"]
}
      `

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert at analyzing email intent. Respond only with valid JSON.",
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

      return JSON.parse(result)
    } catch (error) {
      console.error("Error analyzing email intent:", error)
      return null
    }
  }

  private prepareEmailContent(email: any): string {
    const subject = email.subject || "No Subject"
    const fromName = email.from?.name || "Unknown"
    const fromAddress = email.from?.address || "unknown@unknown.com"
    const bodyText = email.body?.text || email.body?.html?.replace(/<[^>]*>/g, "") || ""

    return `
Subject: ${subject}
From: ${fromName} <${fromAddress}>
Body: ${bodyText.substring(0, 1500)}
    `.trim()
  }
}

export default new RAGService()
