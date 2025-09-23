"use client"

import { useState, useEffect } from "react"

interface Account {
  _id: string
  email: string
  isActive: boolean
  syncStatus: string
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"}/api/emails/accounts`)

      if (!response.ok) {
        throw new Error("Failed to fetch accounts")
      }

      const data = await response.json()
      setAccounts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      // Fallback to real Gmail accounts
      setAccounts([
        {
          _id: "1",
          email: "choudharyprateek131@gmail.com",
          isActive: true,
          syncStatus: "idle"
        },
        {
          _id: "2", 
          email: "kartikchoudhary1312@gmail.com",
          isActive: true,
          syncStatus: "idle"
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts,
  }
}