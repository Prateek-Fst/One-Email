"use client"

import { useState, useEffect, useCallback } from "react"

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
  perAccount?: number
}

export function useEmails(options: UseEmailsOptions = {}) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchEmails = useCallback(async (page = 1, append = false) => {
    try {
      console.log(`Fetching emails - Page: ${page}, Append: ${append}, Account: ${options.accountId}`)
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setCurrentPage(1)
      }
      setError(null)

      const params = new URLSearchParams()
      if (options.search) params.append("search", options.search)
      if (options.accountId) params.append("accountId", options.accountId)
      if (options.category) params.append("category", options.category)
      params.append("page", page.toString())
      params.append("perAccount", (options.perAccount || 5).toString())

      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"}/api/emails?${params}`
      console.log('Fetching URL:', url)
      
      const response = await fetch(url)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', response.status, errorText)
        throw new Error(`Failed to fetch emails: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      const newEmails = data.emails || []
      
      console.log(`API Response - Page: ${page}, Emails: ${newEmails.length}, HasMore: ${data.pagination?.hasMore}`)
      
      if (append) {
        setEmails(prev => [...prev, ...newEmails])
        setCurrentPage(page)
      } else {
        setEmails(newEmails)
      }
      
      setHasMore(data.pagination?.hasMore || false)
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : "An error occurred")
      // Mock data for development
      setEmails([
        {
          _id: "1",
          subject: "Welcome to our platform!",
          from: { name: "John Doe", address: "john@example.com" },
          to: [{ address: "test1@gmail.com" }],
          date: new Date().toISOString(),
          body: { text: "Welcome to our amazing platform. We're excited to have you on board!" },
          isRead: false,
          aiCategory: "Interested",
          aiConfidence: 0.95,
          accountEmail: "test1@gmail.com",
        },
        {
          _id: "2",
          subject: "Meeting scheduled for tomorrow",
          from: { name: "Sarah Smith", address: "sarah@company.com" },
          to: [{ address: "test2@gmail.com" }],
          date: new Date(Date.now() - 3600000).toISOString(),
          body: { text: "Hi, I've scheduled our meeting for tomorrow at 2 PM. Looking forward to it!" },
          isRead: true,
          aiCategory: "Meeting Booked",
          aiConfidence: 0.98,
          accountEmail: "test2@gmail.com",
        },
        {
          _id: "3",
          subject: "Thanks, but not interested",
          from: { name: "Mike Johnson", address: "mike@client.com" },
          to: [{ address: "test3@gmail.com" }],
          date: new Date(Date.now() - 7200000).toISOString(),
          body: { text: "Thank you for reaching out, but we're not interested at this time." },
          isRead: true,
          aiCategory: "Not Interested",
          aiConfidence: 0.92,
          accountEmail: "test3@gmail.com",
        },
      ])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [options.search, options.accountId, options.category, options.perAccount])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchEmails(currentPage + 1, true)
    }
  }, [fetchEmails, currentPage, loadingMore, hasMore])

  // Debounce search queries and reset pagination
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchEmails(1, false)
    }, options.search ? 300 : 0)

    return () => clearTimeout(timeoutId)
  }, [options.search, options.accountId, options.category, fetchEmails])

  return {
    emails,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refetch: () => fetchEmails(1, false),
  }
}
