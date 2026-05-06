# FinShield AI 

AI-powered privacy engine for detecting and masking sensitive PII data from datasets in real time.

FinShield AI helps organizations securely process structured and unstructured datasets by automatically detecting, classifying, and masking sensitive information while preserving data utility.

---

# Features

- Detects Aadhaar, PAN, Emails, Credit Cards, Tokens, IPs, Bank Details, OTPs, etc.
- AI-powered masking pipeline
- Multi-layer PII detection engine
- Smart masking & redaction
- Analytics dashboard with utility scores
- Processing history tracking
- CSV / JSON / XLSX / DOCX / LOG support
- Export masked datasets
- Privacy-first architecture
- Real-time processing pipeline

---

#  Detection Pipeline

FinShield uses a multi-stage privacy detection architecture:

### 1. Regex-Based Detection
Fast pattern matching for common PII formats.

### 2. NLP Fallback Detection
Uses NLP-based entity recognition with:
- compromise

### 3. Microsoft Presidio Fallback
If regex + NLP fail, FinShield uses:
- Microsoft Presidio

Presidio runs inside Docker containers for scalable processing.

---

# 🛠️ Tech Stack

## Frontend (`client`)
- React.js
- Vite
- TypeScript
- Tailwind CSS
- Redux Toolkit
- RTK Query
- Recharts
- Framer Motion

## Authentication
- Google OAuth Login
- JWT Authentication

## Backend (`server`)
- Node.js
- Express.js
- Regex-based PII detection
- NLP detection pipeline
- Microsoft Presidio integration
- Docker

## Deployment
- AWS Lightsail
- Nginx
- SSL Enabled
- Custom backend domain:
  `api.refynai.org`

---

#  Project Structure

```bash
FinShield-AI/
│
├── client/         # React + Vite frontend
├── server/         # Express backend
├── presidio-server/       # Presidio docker setup
└── README.md
```

---

#  How to Run Locally

## Clone Repository

```bash
git clone https://github.com/your-username/finshield-ai.git
cd finshield-ai
```

---

# Frontend Setup

```bash
cd client
npm install
npm run dev
```

Frontend runs on:

```bash
http://localhost:5173
```

---

# Backend Setup

```bash
cd server
npm install
npm start
```

Backend runs on:

```bash
http://localhost:3000
```

---

# Docker Presidio Setup

```bash
docker-compose up
```

---

# 🔐 Environment Variables

## Client `.env`

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

---

## Server `.env`

```env
PORT=3000
DATABASE_URL=your_db_url
DB_NAME=db_name
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id
ACCESS_TOKEN_SECRET=your_access_token_secret
ACCESS_TOKEN_EXPIRY=2d
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRY=10d
PRESIDIO_URL=your_local_url
```

---


#  Privacy Features

- Zero permanent dataset storage
- In-memory processing
- Secure masking architecture
- Multi-layer detection pipeline
- Utility-preserving transformations

---

#  Deployment

Frontend and backend are deployed on AWS Lightsail.

Backend API is connected using custom domain:

```bash
api.refynai.org
```

Nginx is used as reverse proxy with SSL enabled.

---

#  Use Cases

- Financial datasets
- Healthcare records
- Internal enterprise data
- Compliance workflows
- Log sanitization
- AI training data cleaning

---
