# Email Onebox - MERN Stack

A feature-rich email aggregator built with the MERN stack that synchronizes multiple IMAP accounts in real-time and provides AI-powered email categorization and search capabilities.

## Features

- ✅ Real-time email synchronization with IMAP IDLE mode
- ✅ Multiple email account support
- ✅ Elasticsearch-powered search
- ✅ AI-based email categorization
- ✅ Slack notifications for interested emails
- ✅ Webhook integration for external automation
- ✅ Modern React frontend with TypeScript
- ✅ AI-powered reply suggestions with RAG

## Tech Stack

- **Frontend**: React, Next.js, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: MongoDB (primary), Elasticsearch (search)
- **Email**: IMAP with persistent connections
- **AI**: OpenAI GPT for categorization and reply suggestions
- **Real-time**: IMAP IDLE mode (no polling)

## Quick Start

1. **Clone and install all dependencies**
   \`\`\`bash
   npm run install:all
   \`\`\`

2. **Start services with Docker**
   \`\`\`bash
   docker-compose up -d
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env.local
   cp backend/.env.example backend/.env
   # Edit each .env file with your configuration
   \`\`\`

4. **Setup database**
   \`\`\`bash
   npm run setup:db
   \`\`\`

5. **Start both frontend and backend**
   \`\`\`bash
   npm run dev
   \`\`\`

   Or run them separately:
   \`\`\`bash
   # Terminal 1 - Backend (port 5000)
   npm run dev:backend
   
   # Terminal 2 - Frontend (port 3000)
   npm run dev:frontend
   \`\`\`

## Project Structure

\`\`\`
email-onebox/
├── frontend/           # Next.js React app
│   ├── app/           # Next.js app router
│   ├── components/    # React components
│   └── package.json   # Frontend dependencies
├── backend/           # Express.js API server
│   ├── routes/        # API routes
│   ├── services/      # Business logic
│   ├── models/        # MongoDB models
│   └── package.json   # Backend dependencies
├── scripts/           # Database setup scripts
└── docker-compose.yml # MongoDB & Elasticsearch
\`\`\`

## Configuration

### Email Accounts
Add your IMAP accounts through the web interface or directly in MongoDB:

\`\`\`javascript
{
  email: "your-email@gmail.com",
  imapConfig: {
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    username: "your-email@gmail.com",
    password: "your-app-password"
  }
}
\`\`\`

### AI Categories
Emails are automatically categorized into:
- **Interested** - Positive responses, inquiries
- **Meeting Booked** - Calendar invites, meeting confirmations
- **Not Interested** - Rejections, unsubscribes
- **Spam** - Promotional, suspicious content
- **Out of Office** - Auto-replies, vacation messages

## API Endpoints

- `GET /api/emails` - List emails with search and filters
- `POST /api/emails/search` - Advanced search with Elasticsearch
- `GET /api/emails/:id` - Get specific email
- `POST /api/accounts` - Add new email account
- `GET /api/accounts` - List configured accounts
- `POST /api/ai/categorize` - AI email categorization
- `POST /api/rag/reply` - Generate AI-powered replies

## Architecture

\`\`\`
Frontend (React/Next.js) :3000
    ↓
Backend API (Express) :5000
    ↓
┌─────────────┬─────────────────┐
│  MongoDB    │  Elasticsearch  │
│ (Primary)   │   (Search)      │
└─────────────┴─────────────────┘
    ↓
IMAP Services (Real-time sync)
    ↓
AI Services (OpenAI + RAG)
    ↓
Webhooks (Slack, External)
\`\`\`

## Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend
- `npm run install:all` - Install all dependencies
- `npm run build` - Build both applications
- `npm run setup:db` - Initialize database

### Frontend Only
- `npm run dev:frontend` - Start Next.js dev server
- `npm run build:frontend` - Build frontend for production

### Backend Only
- `npm run dev:backend` - Start Express server with hot reload
- `npm run build:backend` - Build backend for production

## Environment Variables

### Backend (.env)
\`\`\`
PORT=5000
MONGODB_URI=mongodb://localhost:27017/email-onebox
ELASTICSEARCH_URL=http://localhost:9200
OPENAI_API_KEY=your_openai_api_key
SLACK_WEBHOOK_URL=your_slack_webhook_url
EXTERNAL_WEBHOOK_URL=your_external_webhook_url
WEBHOOK_SECRET=your_webhook_secret
\`\`\`

### Frontend (.env.local)
\`\`\`
NEXT_PUBLIC_API_URL=http://localhost:5000
\`\`\`

## Deployment

The application is ready for deployment:
- **Frontend**: Deploy to Vercel, Netlify, or any static hosting
- **Backend**: Deploy to Railway, Render, or any Node.js hosting service
- **Database**: Use MongoDB Atlas and Elasticsearch Cloud for production

Make sure to configure environment variables and ensure all services are accessible.
