import { DatabaseConfig } from "../config/database"
import elasticsearchService from "../services/elasticsearchService"

async function setupDatabase() {
  try {
    console.log("Setting up database connections...")

    // Connect to MongoDB
    await DatabaseConfig.connectMongoDB()

    // Connect to Elasticsearch
    const esClient = await DatabaseConfig.connectElasticsearch()
    await elasticsearchService.initialize(esClient)

    console.log("Database setup completed successfully!")

    // Test connections
    console.log("Testing connections...")
    console.log("MongoDB connected:", DatabaseConfig.isMongoConnected())
    console.log("Elasticsearch healthy:", elasticsearchService.isHealthy())

    const esHealth = await DatabaseConfig.getElasticsearchHealth()
    if (esHealth) {
      console.log("Elasticsearch cluster status:", esHealth.status)
    }

    process.exit(0)
  } catch (error) {
    console.error("Database setup failed:", error)
    process.exit(1)
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase()
}

export { setupDatabase }
