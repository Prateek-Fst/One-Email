import { simpleParser, type ParsedMail } from "mailparser"

export interface ParsedEmailData {
  messageId: string
  subject: string
  from: {
    name?: string
    address: string
  }
  to: Array<{
    name?: string
    address: string
  }>
  cc?: Array<{
    name?: string
    address: string
  }>
  date: Date
  body: {
    text?: string
    html?: string
  }
  attachments?: Array<{
    filename: string
    contentType: string
    size: number
  }>
}

export class EmailParser {
  static async parseRawEmail(rawEmail: string): Promise<ParsedEmailData | null> {
    try {
      const parsed: ParsedMail = await simpleParser(rawEmail)

      return {
        messageId: parsed.messageId || `generated-${Date.now()}`,
        subject: parsed.subject || "No Subject",
        from: {
          name: parsed.from?.value?.[0]?.name,
          address: parsed.from?.value?.[0]?.address || "unknown@unknown.com",
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
          })) || undefined,
        date: parsed.date || new Date(),
        body: {
          text: parsed.text,
          html: parsed.html,
        },
        attachments: parsed.attachments?.map((att: any) => ({
          filename: att.filename || "unknown",
          contentType: att.contentType || "application/octet-stream",
          size: att.size || 0,
        })),
      }
    } catch (error) {
      console.error("Error parsing email:", error)
      return null
    }
  }

  static extractPlainText(html: string): string {
    if (!html) return ""

    // Remove HTML tags and decode entities
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  }

  static truncateText(text: string, maxLength = 300): string {
    if (!text || text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }
}
