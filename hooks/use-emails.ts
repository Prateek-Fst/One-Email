"use client"

import { useState, useEffect } from "react"

interface Email {
  _id: string
  subject: string
  from: {
    name?: string
    address: string
  }
  to: Array<{
    name?: string
    address: string
  }>
  date: string
  body: {
    text?: string
    html?: string
  }
  isRead: boolean
  aiCategory?: string
  aiConfidence?: number
  accountEmail: string
}

interface UseEmailsOptions {
  search?: string
  accountId?: string
  category?: string
  page?: number
  limit?: number
}

export function useEmails(options: UseEmailsOptions = {}) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEmails = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.search) params.append("search", options.search)
      if (options.accountId) params.append("accountId", options.accountId)
      if (options.category) params.append("category", options.category)
      if (options.page) params.append("page", options.page.toString())
      if (options.limit) params.append("limit", options.limit.toString())

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/emails?${params}`)

      if (!response.ok) {
        throw new Error("Failed to fetch emails")
      }

      const data = await response.json()
      setEmails(data.emails || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      // Mock data for development
      setEmails([
        {
          _id: "1",
          subject: "Welcome to our platform!",
          from: { name: "John Doe", address: "john@example.com" },
          to: [{ address: "you@example.com" }],
          date: new Date().toISOString(),
          body: { text: "Welcome to our amazing platform. We're excited to have you on board!" },
          isRead: false,
          aiCategory: "Interested",
          aiConfidence: 0.95,
          accountEmail: "work@company.com",
        },
        {
          _id: "2",
          subject: "Meeting scheduled for tomorrow",
          from: { name: "Sarah Smith", address: "sarah@company.com" },
          to: [{ address: "you@example.com" }],
          date: new Date(Date.now() - 3600000).toISOString(),
          body: { text: "Hi, I've scheduled our meeting for tomorrow at 2 PM. Looking forward to it!" },
          isRead: true,
          aiCategory: "Meeting Booked",
          aiConfidence: 0.98,
          accountEmail: "work@company.com",
        },
        {
          _id: "3",
          subject: "Thanks, but not interested",
          from: { name: "Mike Johnson", address: "mike@client.com" },
          to: [{ address: "you@example.com" }],
          date: new Date(Date.now() - 7200000).toISOString(),
          body: { text: "Thank you for reaching out, but we're not interested at this time." },
          isRead: true,
          aiCategory: "Not Interested",
          aiConfidence: 0.92,
          accountEmail: "personal@gmail.com",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmails()
  }, [options.search, options.accountId, options.category, options.page])

  return {
    emails,
    loading,
    error,
    refetch: fetchEmails,
  }
}
