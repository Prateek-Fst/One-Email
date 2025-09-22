import mongoose from "mongoose"
import { Client } from "@elastic/elasticsearch"

export class DatabaseConfig {
  private static mongoConnection: typeof mongoose | null = null
  private static esClient: Client | null = null

  static async connectMongoDB(): Promise<typeof mongoose> {
    if (this.mongoConnection) {
      return this.mongoConnection
    }

    try {
      const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/email-onebox"

      this.mongoConnection = await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        bufferMaxEntries: 0,
      })

      console.log("MongoDB connected successfully")

      // Handle connection events
      mongoose.connection.on("error", (error) => {
        console.error("MongoDB connection error:", error)
      })

      mongoose.connection.on("disconnected", () => {
        console.log("MongoDB disconnected")
        this.mongoConnection = null
      })

      mongoose.connection.on("reconnected", () => {
        console.log("MongoDB reconnected")
      })

      return this.mongoConnection
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error)
      throw error
    }
  }

  static async connectElasticsearch(): Promise<Client> {
    if (this.esClient) {
      return this.esClient
    }

    try {
      const node = process.env.ELASTICSEARCH_URL || "http://localhost:9200"

      this.esClient = new Client({
        node,
        requestTimeout: 30000,
        pingTimeout: 3000,
        maxRetries: 3,
      })

      // Test connection
      await this.esClient.ping()
      console.log("Elasticsearch connected successfully")

      return this.esClient
    } catch (error) {
      console.error("Failed to connect to Elasticsearch:", error)
      console.log("Continuing without Elasticsearch - search functionality will be limited")

      // Return a mock client that doesn't break the app
      return {
        ping: async () => false,
        indices: {
          exists: async () => false,
          create: async () => ({}),
        },
        index: async () => ({}),
        search: async () => ({ body: { hits: { hits: [], total: { value: 0 } } } }),
      } as any
    }
  }

  static async disconnect(): Promise<void> {
    if (this.mongoConnection) {
      await mongoose.disconnect()
      this.mongoConnection = null
    }

    if (this.esClient) {
      await this.esClient.close()
      this.esClient = null
    }
  }

  static isMongoConnected(): boolean {
    return mongoose.connection.readyState === 1
  }

  static async getElasticsearchHealth(): Promise<any> {
    if (!this.esClient) return null

    try {
      const health = await this.esClient.cluster.health()
      return health.body
    } catch (error) {
      return null
    }
  }
}
