"use client"

import { useState } from "react"
import { EmailSidebar } from "@/components/email/email-sidebar"
import { EmailList } from "@/components/email/email-list"
import { EmailView } from "@/components/email/email-view"
import { EmailHeader } from "@/components/email/email-header"
import { useEmails } from "@/hooks/use-emails"

export default function EmailOnebox() {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedAccount, setSelectedAccount] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const { emails, loading, loadingMore, error, hasMore, loadMore, refetch } = useEmails({
    search: searchQuery,
    accountId: selectedAccount,
    category: selectedCategory === "all" ? undefined : selectedCategory,
    perAccount: 5,
  })

  const selectedEmail = emails.find((email) => email._id === selectedEmailId)

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <EmailSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        selectedAccount={selectedAccount}
        onAccountChange={setSelectedAccount}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <EmailHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onRefresh={refetch} />

        {/* Email Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Email List */}
          <div className="w-120 border-r border-border bg-card">
            <EmailList
              emails={emails}
              loading={loading}
              loadingMore={loadingMore}
              error={error}
              hasMore={hasMore}
              selectedEmailId={selectedEmailId}
              onEmailSelect={setSelectedEmailId}
              onLoadMore={loadMore}
            />
          </div>

          {/* Email View */}
          <div className="flex-1 bg-background">
            {selectedEmail ? (
              <EmailView email={selectedEmail} onClose={() => setSelectedEmailId(null)} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="mb-4 text-6xl">📧</div>
                  <h3 className="text-lg font-medium">Select an email to view</h3>
                  <p className="text-sm">Choose an email from the list to read its content</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
