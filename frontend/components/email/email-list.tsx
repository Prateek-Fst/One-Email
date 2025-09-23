"use client"

import { useEffect, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Loader2, Mail, MailOpen } from "lucide-react"

interface Email {
  _id: string
  subject: string
  from: {
    name?: string
    address: string
  }
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

interface EmailListProps {
  emails: Email[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  selectedEmailId: string | null
  onEmailSelect: (emailId: string) => void
  onLoadMore: () => void
}

const categoryColors = {
  Interested: "bg-green-100 text-green-800 border-green-200",
  "Meeting Booked": "bg-blue-100 text-blue-800 border-blue-200",
  "Not Interested": "bg-red-100 text-red-800 border-red-200",
  Spam: "bg-orange-100 text-orange-800 border-orange-200",
  "Out of Office": "bg-purple-100 text-purple-800 border-purple-200",
}

export function EmailList({ emails, loading, loadingMore, error, hasMore, selectedEmailId, onEmailSelect, onLoadMore }: EmailListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollArea
      if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !loadingMore) {
        onLoadMore()
      }
    }

    scrollArea.addEventListener('scroll', handleScroll)
    return () => scrollArea.removeEventListener('scroll', handleScroll)
  }, [hasMore, loadingMore, onLoadMore])
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading emails...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center text-destructive">
          <p className="font-medium">Error loading emails</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <Mail className="mx-auto h-12 w-12 mb-4" />
          <p className="font-medium">No emails found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full" ref={scrollAreaRef}>
      <div className="p-4 space-y-2">
        {emails.map((email) => (
          <Button
            key={email._id}
            variant="ghost"
            className={cn(
              "w-full h-auto p-4 justify-start text-left hover:bg-accent/50 transition-colors",
              selectedEmailId === email._id && "bg-accent text-accent-foreground",
              !email.isRead && "border-l-4 border-l-secondary",
            )}
            onClick={() => onEmailSelect(email._id)}
          >
            <div className="flex w-full flex-col gap-2">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {email.isRead ? (
                    <MailOpen className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Mail className="h-4 w-4 text-secondary" />
                  )}
                  <span className="text-xs text-muted-foreground">{email.accountEmail}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                </span>
              </div>

              {/* From */}
              <div className="font-medium text-sm truncate">{email.from.name || email.from.address}</div>

              {/* Subject */}
              <div className={cn("text-sm truncate", !email.isRead && "font-semibold")}>{email.subject}</div>

              {/* Preview */}
              <div className="text-xs text-muted-foreground line-clamp-2">
                {email.body.text?.substring(0, 150) || "No preview available"}
              </div>

              {/* AI Category */}
              {email.aiCategory && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      categoryColors[email.aiCategory as keyof typeof categoryColors] ||
                        "bg-gray-100 text-gray-800 border-gray-200",
                    )}
                  >
                    {email.aiCategory}
                  </Badge>
                  {email.aiConfidence && (
                    <span className="text-xs text-muted-foreground">{Math.round(email.aiConfidence * 100)}%</span>
                  )}
                </div>
              )}
            </div>
          </Button>
        ))}
        
        {/* Load More Indicator */}
        {loadingMore && (
          <div className="flex items-center justify-center p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading more emails...</span>
            </div>
          </div>
        )}
        
        {!hasMore && emails.length > 0 && (
          <div className="flex items-center justify-center p-4 text-muted-foreground text-sm">
            No more emails to load
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
