"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Reply, ReplyAll, Forward, Archive, Trash2, Star, MoreHorizontal, X, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { AIReplyPanel } from "./ai-reply-panel"

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

interface EmailViewProps {
  email: Email
  onClose: () => void
}

const categoryColors = {
  Interested: "bg-green-100 text-green-800 border-green-200",
  "Meeting Booked": "bg-blue-100 text-blue-800 border-blue-200",
  "Not Interested": "bg-red-100 text-red-800 border-red-200",
  Spam: "bg-orange-100 text-orange-800 border-orange-200",
  "Out of Office": "bg-purple-100 text-purple-800 border-purple-200",
}

export function EmailView({ email, onClose }: EmailViewProps) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState("")

  const handleUseAIReply = (reply: string) => {
    setReplyText(reply)
    setShowReply(true)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-balance">{email.subject}</h2>
          {email.aiCategory && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                categoryColors[email.aiCategory as keyof typeof categoryColors] ||
                  "bg-gray-100 text-gray-800 border-gray-200",
              )}
            >
              {email.aiCategory}
              {email.aiConfidence && <span className="ml-1">({Math.round(email.aiConfidence * 100)}%)</span>}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Star className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            <Card>
              <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-medium">
                      {(email.from.name || email.from.address).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{email.from.name || email.from.address}</div>
                      <div className="text-sm text-muted-foreground">{email.from.address}</div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    To: {email.to.map((recipient) => recipient.address).join(", ")}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                {email.body.html ? (
                  <div dangerouslySetInnerHTML={{ __html: email.body.html }} />
                ) : (
                  <div className="whitespace-pre-wrap text-pretty">{email.body.text}</div>
                )}
              </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>

      {/* Action Buttons */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Button onClick={() => setShowReply(!showReply)}>
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </Button>
          <Button variant="outline">
            <ReplyAll className="h-4 w-4 mr-2" />
            Reply All
          </Button>
          <Button variant="outline">
            <Forward className="h-4 w-4 mr-2" />
            Forward
          </Button>
        </div>

        {/* Reply Section */}
        {showReply && (
          <div className="space-y-4">
            <Separator />

            <Tabs defaultValue="compose" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="compose">Compose Reply</TabsTrigger>
                <TabsTrigger value="ai-assist">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Assist
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compose" className="space-y-3">
                <Textarea
                  placeholder="Type your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-32 resize-none"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button size="sm">Send</Button>
                    <Button size="sm" variant="outline">
                      Save Draft
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowReply(false)
                      setReplyText("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="ai-assist">
                <AIReplyPanel emailId={email._id} onUseReply={handleUseAIReply} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
