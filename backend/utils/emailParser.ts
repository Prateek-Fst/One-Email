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
          name: Array.isArray(parsed.from) ? (parsed.from[0] as any)?.name : (parsed.from as any)?.name,
          address: Array.isArray(parsed.from) ? (parsed.from[0] as any)?.address : (parsed.from as any)?.address || "unknown@unknown.com",
        },
        to:
          (Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : []).map((addr: any) => ({
            name: (addr as any).name,
            address: (addr as any).address || "unknown@unknown.com",
          })).filter(addr => addr.address),
        cc:
          parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).map((addr: any) => ({
            name: (addr as any).name,
            address: (addr as any).address || "unknown@unknown.com",
          })).filter(addr => addr.address) : undefined,
        date: parsed.date || new Date(),
        body: {
          text: parsed.text,
          html: parsed.html || undefined,
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
