import type { Client } from "@elastic/elasticsearch"

class ElasticsearchService {
  private client!: Client
  private indexName = "emails"
  private isAvailable = false

  async initialize(client: Client) {
    this.client = client

    try {
      const response = await this.client.ping()
      console.log("Elasticsearch ping successful:", response)
      this.isAvailable = true
      await this.createIndex()
      console.log("Elasticsearch service initialized successfully")
    } catch (error:any) {
      console.error("Elasticsearch not available:", error.message)
      this.isAvailable = false
    }
  }

  private async createIndex() {
    if (!this.isAvailable) return

    try {
      const exists = await this.client.indices.exists({
        index: this.indexName,
      })

      if (!exists) {
        const response = await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  email_analyzer: {
                    type: "custom",
                    tokenizer: "standard",
                    filter: ["lowercase", "stop", "snowball"],
                  },
                },
              },
            },
            mappings: {
              properties: {
                messageId: { type: "keyword" },
                accountId: { type: "keyword" },
                accountEmail: { type: "keyword" },
                subject: {
                  type: "text",
                  analyzer: "email_analyzer",
                  fields: {
                    keyword: { type: "keyword" },
                  },
                },
                from: {
                  properties: {
                    name: {
                      type: "text",
                      analyzer: "email_analyzer",
                    },
                    address: { type: "keyword" },
                  },
                },
                to: {
                  properties: {
                    name: { type: "text" },
                    address: { type: "keyword" },
                  },
                },
                body: {
                  properties: {
                    text: {
                      type: "text",
                      analyzer: "email_analyzer",
                    },
                    html: { type: "text", index: false },
                  },
                },
                folder: { type: "keyword" },
                aiCategory: { type: "keyword" },
                aiConfidence: { type: "float" },
                date: { type: "date" },
                isRead: { type: "boolean" },
                flags: { type: "keyword" },
                uid: { type: "integer" },
                createdAt: { type: "date" },
                updatedAt: { type: "date" },
              },
            },
          },
        })
        console.log("Elasticsearch index created successfully:", response)
      } else {
        console.log("Elasticsearch index already exists")
      }
    } catch (error) {
      console.error("Error creating Elasticsearch index:", error)
      this.isAvailable = false
    }
  }

  async indexEmail(email: any) {
    if (!this.isAvailable) return

    try {
      await this.client.index({
        index: this.indexName,
        id: email._id.toString(),
        body: {
          messageId: email.messageId,
          accountId: email.accountId,
          accountEmail: email.accountEmail,
          subject: email.subject,
          from: email.from,
          to: email.to,
          body: email.body,
          folder: email.folder,
          aiCategory: email.aiCategory,
          aiConfidence: email.aiConfidence,
          date: email.date,
          isRead: email.isRead,
          flags: email.flags,
          uid: email.uid,
          createdAt: email.createdAt,
          updatedAt: email.updatedAt,
        },
      })
    } catch (error) {
      console.error("Error indexing email:", error)
    }
  }

  async searchEmails(query: string, filters: any = {}, options: any = {}) {
    if (!this.isAvailable) {
      return { hits: [], total: { value: 0 } }
    }

    try {
      const { page = 1, limit = 50, sortBy = "date", sortOrder = "desc" } = options

      const searchBody: any = {
        query: {
          bool: {
            must: [],
            filter: [],
          },
        },
        sort: [{ [sortBy]: { order: sortOrder } }],
        size: limit,
        from: (page - 1) * limit,
        highlight: {
          fields: {
            subject: {},
            "body.text": {
              fragment_size: 150,
              number_of_fragments: 3,
            },
          },
        },
      }

      // Add text search
      if (query && query.trim()) {
        searchBody.query.bool.must.push({
          multi_match: {
            query: query.trim(),
            fields: ["subject^3", "body.text^2", "from.name^2", "from.address", "to.name", "to.address"],
            type: "best_fields",
            fuzziness: "AUTO",
          },
        })
      } else {
        searchBody.query.bool.must.push({ match_all: {} })
      }

      // Add filters
      if (filters.accountId) {
        searchBody.query.bool.filter.push({
          term: { accountId: filters.accountId },
        })
      }

      if (filters.accountEmail) {
        searchBody.query.bool.filter.push({
          term: { accountEmail: filters.accountEmail },
        })
      }

      if (filters.folder) {
        searchBody.query.bool.filter.push({
          term: { folder: filters.folder },
        })
      }

      if (filters.aiCategory) {
        searchBody.query.bool.filter.push({
          term: { aiCategory: filters.aiCategory },
        })
      }

      if (filters.isRead !== undefined) {
        searchBody.query.bool.filter.push({
          term: { isRead: filters.isRead },
        })
      }

      if (filters.dateFrom || filters.dateTo) {
        const dateRange: any = {}
        if (filters.dateFrom) dateRange.gte = filters.dateFrom
        if (filters.dateTo) dateRange.lte = filters.dateTo

        searchBody.query.bool.filter.push({
          range: { date: dateRange },
        })
      }

      const response = await this.client.search({
        index: this.indexName,
        body: searchBody,
      })

      return response.hits
    } catch (error) {
      console.error("Error searching emails:", error)
      return { hits: [], total: { value: 0 } }
    }
  }

  async updateEmail(emailId: string, updates: any) {
    if (!this.isAvailable) return

    try {
      await this.client.update({
        index: this.indexName,
        id: emailId,
        body: {
          doc: updates,
        },
      })
    } catch (error) {
      console.error("Error updating email in Elasticsearch:", error)
    }
  }

  async deleteEmail(emailId: string) {
    if (!this.isAvailable) return

    try {
      await this.client.delete({
        index: this.indexName,
        id: emailId,
      })
    } catch (error) {
      console.error("Error deleting email from Elasticsearch:", error)
    }
  }

  async getStats() {
    if (!this.isAvailable) return null

    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: 0,
          aggs: {
            total_emails: { value_count: { field: "_id" } },
            by_category: {
              terms: { field: "aiCategory", missing: "Uncategorized" },
            },
            by_account: {
              terms: { field: "accountEmail" },
            },
            unread_count: {
              filter: { term: { isRead: false } },
            },
            recent_emails: {
              date_histogram: {
                field: "date",
                calendar_interval: "day",
                order: { _key: "desc" },
              },
            },
          },
        },
      })

      return response.aggregations
    } catch (error) {
      console.error("Error getting Elasticsearch stats:", error)
      return null
    }
  }

  isHealthy(): boolean {
    return this.isAvailable
  }
}

export default new ElasticsearchService()
