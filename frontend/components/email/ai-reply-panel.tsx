"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sparkles, RefreshCw, ThumbsUp, ThumbsDown, Copy, Edit } from "lucide-react"
import { cn } from "@/lib/utils"

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

interface AIReplyPanelProps {
  emailId: string
  onUseReply: (reply: string) => void
}

export function AIReplyPanel({ emailId, onUseReply }: AIReplyPanelProps) {
  const [replies, setReplies] = useState<RAGResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedReply, setSelectedReply] = useState<number | null>(null)
  const [feedback, setFeedback] = useState("")
  const [showImprovement, setShowImprovement] = useState(false)

  const generateReplies = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/rag/replies/${emailId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 3 }),
        },
      )

      if (response.ok) {
        const data = await response.json()
        setReplies(data.replies || [])
      }
    } catch (error) {
      console.error("Error generating replies:", error)
    } finally {
      setLoading(false)
    }
  }

  const improveReply = async (originalReply: string) => {
    if (!feedback.trim()) return

    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/rag/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalReply,
          feedback,
          emailId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Add improved reply to the list
        const improvedReply: RAGResponse = {
          reply: data.improvedReply,
          confidence: 0.9,
          sources: [],
          reasoning: `Improved based on feedback: ${feedback}`,
        }
        setReplies([improvedReply, ...replies])
        setFeedback("")
        setShowImprovement(false)
      }
    } catch (error) {
      console.error("Error improving reply:", error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800"
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  const getSourceTypeColor = (type: string) => {
    const colors = {
      product: "bg-blue-100 text-blue-800",
      outreach: "bg-purple-100 text-purple-800",
      template: "bg-gray-100 text-gray-800",
      knowledge: "bg-green-100 text-green-800",
    }
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-secondary" />
          <h3 className="text-lg font-semibold">AI Reply Suggestions</h3>
        </div>
        <Button onClick={generateReplies} disabled={loading} size="sm">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Generating..." : "Generate Replies"}
        </Button>
      </div>

      {/* Reply Options */}
      {replies.length > 0 && (
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {replies.map((reply, index) => (
              <Card
                key={index}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-accent/50",
                  selectedReply === index && "ring-2 ring-secondary",
                )}
                onClick={() => setSelectedReply(selectedReply === index ? null : index)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Reply Option {index + 1}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getConfidenceColor(reply.confidence)}>
                        {Math.round(reply.confidence * 100)}% confidence
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-pretty">{reply.reply}</div>

                  {selectedReply === index && (
                    <>
                      <Separator />

                      {/* Sources */}
                      {reply.sources.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Sources Used
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {reply.sources.map((source, sourceIndex) => (
                              <Badge key={sourceIndex} variant="outline" className={getSourceTypeColor(source.type)}>
                                {source.type} ({Math.round(source.similarity * 100)}%)
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reasoning */}
                      {reply.reasoning && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            AI Reasoning
                          </h4>
                          <p className="text-xs text-muted-foreground">{reply.reasoning}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => onUseReply(reply.reply)}>
                            Use This Reply
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(reply.reply)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowImprovement(!showImprovement)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost">
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Improvement Panel */}
                      {showImprovement && (
                        <div className="space-y-3 pt-3 border-t">
                          <h4 className="text-sm font-medium">Improve This Reply</h4>
                          <Textarea
                            placeholder="Provide feedback on how to improve this reply..."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            className="min-h-20"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => improveReply(reply.reply)}
                              disabled={!feedback.trim() || loading}
                            >
                              Generate Improved Version
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowImprovement(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Empty State */}
      {replies.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">AI-Powered Reply Suggestions</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate contextual reply suggestions using our AI and knowledge base
          </p>
          <Button onClick={generateReplies}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Smart Replies
          </Button>
        </Card>
      )}
    </div>
  )
}
