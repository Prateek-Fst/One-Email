"use client"

import { useState } from "react"
import { useAccounts } from "@/hooks/use-accounts"
import { ChevronLeft, ChevronRight, Inbox, Send, Archive, Trash2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface EmailSidebarProps {
  collapsed: boolean
  onToggle: () => void
  selectedAccount: string
  onAccountChange: (account: string) => void
  selectedCategory: string
  onCategoryChange: (category: string) => void
}

const folders = [
  { id: "inbox", name: "Inbox", icon: Inbox, count: 12 },
  { id: "sent", name: "Sent", icon: Send, count: 0 },
  { id: "starred", name: "Starred", icon: Star, count: 3 },
  { id: "archive", name: "Archive", icon: Archive, count: 0 },
  { id: "trash", name: "Trash", icon: Trash2, count: 0 },
]

const categories = [
  { id: "all", name: "All", color: "bg-gray-500" },
  { id: "Interested", name: "Interested", color: "bg-green-500" },
  { id: "Meeting Booked", name: "Meeting Booked", color: "bg-blue-500" },
  { id: "Not Interested", name: "Not Interested", color: "bg-red-500" },
  { id: "Spam", name: "Spam", color: "bg-orange-500" },
  { id: "Out of Office", name: "Out of Office", color: "bg-purple-500" },
]



export function EmailSidebar({
  collapsed,
  onToggle,
  selectedAccount,
  onAccountChange,
  selectedCategory,
  onCategoryChange,
}: EmailSidebarProps) {
  const [selectedFolder, setSelectedFolder] = useState("inbox")
  const { accounts: apiAccounts } = useAccounts()
  
  const accounts = [
    { id: "all", name: "All Accounts" },
    ...apiAccounts.map(account => ({
      id: account._id,
      name: account.email
    }))
  ]

  return (
    <div
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Toggle Button */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && <h2 className="text-sm font-semibold text-sidebar-foreground">Navigation</h2>}
        <Button variant="ghost" size="sm" onClick={onToggle}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Account Selector */}
        {!collapsed && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-sidebar-foreground uppercase tracking-wider">Account</h3>
            <Select value={selectedAccount} onValueChange={onAccountChange}>
              <SelectTrigger className="w-full bg-sidebar border-sidebar-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Folders */}
        <div className="space-y-2">
          {!collapsed && (
            <h3 className="text-xs font-medium text-sidebar-foreground uppercase tracking-wider">Folders</h3>
          )}
          <nav className="space-y-1">
            {folders.map((folder) => {
              const Icon = folder.icon
              return (
                <Button
                  key={folder.id}
                  variant={selectedFolder === folder.id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed ? "px-2" : "px-3",
                    selectedFolder === folder.id && "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                  onClick={() => setSelectedFolder(folder.id)}
                >
                  <Icon className="h-4 w-4" />
                  {!collapsed && (
                    <>
                      <span className="ml-3">{folder.name}</span>
                      {folder.count > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {folder.count}
                        </Badge>
                      )}
                    </>
                  )}
                </Button>
              )
            })}
          </nav>
        </div>

        {/* AI Categories */}
        <div className="space-y-2">
          {!collapsed && (
            <h3 className="text-xs font-medium text-sidebar-foreground uppercase tracking-wider">AI Categories</h3>
          )}
          <nav className="space-y-1">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed ? "px-2" : "px-3",
                  selectedCategory === category.id && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
                onClick={() => onCategoryChange(category.id)}
              >
                {collapsed ? (
                  <div className={cn("h-3 w-3 rounded-full", category.color)} />
                ) : (
                  <>
                    <div className={cn("h-3 w-3 rounded-full", category.color)} />
                    <span className="ml-3">{category.name}</span>
                  </>
                )}
              </Button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
