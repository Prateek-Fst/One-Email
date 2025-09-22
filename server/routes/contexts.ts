import express from "express"
import AIContext from "../models/AIContext"

const router = express.Router()

// Get all AI contexts
router.get("/", async (req, res) => {
  try {
    const contexts = await AIContext.find({ isActive: true }).sort({ name: 1 })
    res.json(contexts)
  } catch (error) {
    console.error("Error fetching contexts:", error)
    res.status(500).json({ error: "Failed to fetch contexts" })
  }
})

// Create new AI context
router.post("/", async (req, res) => {
  try {
    const { name, description, context } = req.body

    if (!name || !description || !context) {
      return res.status(400).json({ error: "Name, description, and context are required" })
    }

    const existingContext = await AIContext.findOne({ name })
    if (existingContext) {
      return res.status(409).json({ error: "Context with this name already exists" })
    }

    const newContext = new AIContext({
      name,
      description,
      context,
    })

    await newContext.save()
    res.status(201).json(newContext)
  } catch (error) {
    console.error("Error creating context:", error)
    res.status(500).json({ error: "Failed to create context" })
  }
})

// Update AI context
router.put("/:id", async (req, res) => {
  try {
    const { name, description, context, isActive } = req.body
    const contextDoc = await AIContext.findById(req.params.id)

    if (!contextDoc) {
      return res.status(404).json({ error: "Context not found" })
    }

    if (name) contextDoc.name = name
    if (description) contextDoc.description = description
    if (context) contextDoc.context = context
    if (isActive !== undefined) contextDoc.isActive = isActive

    await contextDoc.save()
    res.json(contextDoc)
  } catch (error) {
    console.error("Error updating context:", error)
    res.status(500).json({ error: "Failed to update context" })
  }
})

// Delete AI context
router.delete("/:id", async (req, res) => {
  try {
    const contextDoc = await AIContext.findById(req.params.id)
    if (!contextDoc) {
      return res.status(404).json({ error: "Context not found" })
    }

    contextDoc.isActive = false
    await contextDoc.save()

    res.json({ message: "Context deactivated successfully" })
  } catch (error) {
    console.error("Error deleting context:", error)
    res.status(500).json({ error: "Failed to delete context" })
  }
})

// Increment usage count
router.post("/:id/use", async (req, res) => {
  try {
    const contextDoc = await AIContext.findById(req.params.id)
    if (!contextDoc) {
      return res.status(404).json({ error: "Context not found" })
    }

    contextDoc.usageCount += 1
    contextDoc.lastUsed = new Date()
    await contextDoc.save()

    res.json({ message: "Usage recorded" })
  } catch (error) {
    console.error("Error recording usage:", error)
    res.status(500).json({ error: "Failed to record usage" })
  }
})

export default router
