# FinShield AI

Privacy-first AI engine for detecting, classifying, and masking sensitive PII data from structured and unstructured datasets in real time.

FinShield AI helps organizations securely process datasets while preserving analytical utility through a multi-layer privacy pipeline built for real-world enterprise workflows.

---

# Problem

Modern organizations process massive amounts of sensitive information across:

- Financial datasets
- KYC records
- Internal logs
- Healthcare records
- AI training datasets
- Enterprise exports

Most datasets contain Personally Identifiable Information (PII) such as:

- Aadhaar numbers
- PAN cards
- Emails
- Phone numbers
- Credit cards
- Bank details
- Tokens
- IP addresses
- OTPs
- Session identifiers

Manually sanitizing this data is:
- Slow
- Error-prone
- Non-scalable
- Unsafe for compliance workflows

FinShield AI solves this problem using a real-time privacy-preserving masking pipeline.

---

# Solution

FinShield AI automatically:

1. Detects sensitive entities
2. Classifies PII types
3. Applies intelligent masking/redaction
4. Preserves non-sensitive analytical utility
5. Exports sanitized datasets securely

The system supports both:
- Structured datasets
- Unstructured document/log pipelines

without permanently storing raw uploaded data.

---

# Core Features

- Multi-layer PII detection pipeline
- Real-time masking engine
- Structured + unstructured data support
- AI-assisted entity recognition
- Utility-preserving masking
- Analytics dashboard
- Processing history tracking
- Risk scoring & quality metrics
- Export sanitized datasets
- Privacy-first architecture
- In-memory processing
- Zero permanent raw dataset storage

---

# Supported PII Types

FinShield AI detects and masks:

- Aadhaar Numbers
- PAN Cards
- Emails
- Phone Numbers
- Credit Cards
- CVV
- OTPs
- Bank Accounts
- IFSC Codes
- IP Addresses
- Access Tokens
- Session IDs
- Personal Names
- Financial Information
- Log-based identifiers
- Custom enterprise patterns

---

# Supported File Formats

### Structured Data
- CSV
- JSON
- XLSX

### Unstructured Data
- DOCX
- TXT
- LOG

---

# Detection Architecture

FinShield AI uses a multi-stage detection pipeline designed for both speed and accuracy.

---

## 1. Regex-Based Detection

Fast deterministic pattern matching for known PII formats.

Examples:
- Aadhaar
- PAN
- Credit Cards
- OTPs
- IFSC
- Tokens

Advantages:
- Extremely fast
- Low latency
- High precision

---

## 2. NLP Entity Detection

If regex confidence is insufficient, FinShield falls back to NLP-based entity recognition using:

- compromise

Used for:
- Names
- Locations
- Contextual identifiers
- Semi-structured text

---

## 3. Microsoft Presidio Fallback

For advanced entity analysis and contextual validation, FinShield integrates:

- Microsoft Presidio

Presidio runs inside Docker containers for scalable isolated processing.

Used for:
- Context-aware detection
- Additional validation
- Enterprise-grade PII analysis

---

# Privacy-First Architecture

FinShield AI was designed with privacy as the primary constraint.

### Security Principles

- Zero permanent raw data storage
- In-memory processing pipeline
- Temporary processing lifecycle
- Secure masking transformations
- Export-only sanitized datasets
- No third-party data sharing

Uploaded datasets are discarded after processing and are never retained permanently.

---

# Working Prototype

The project currently supports:

- End-to-end upload → detection → masking → export flow  
- Structured dataset processing  
- Unstructured document sanitization  
- Real-time analytics dashboard  
- Utility score generation  
- Historical run tracking  
- Downloadable masked outputs  

---

# Dashboard Features

- PII distribution analysis
- Utility retention score
- Detection trends
- Category breakdowns
- Risk scoring
- Historical processing runs
- Masked dataset preview
- Structured + document preview modes

---

# Tech Stack

## Frontend (`client`)

- React.js
- Vite
- TypeScript
- Tailwind CSS
- Redux Toolkit
- RTK Query
- Framer Motion
- Recharts

---

## Backend (`server`)

- Node.js
- Express.js
- Regex detection engine
- NLP detection pipeline
- Microsoft Presidio integration
- Dockerized processing services

---

## Authentication

- Google OAuth
- JWT Authentication

---

## Infrastructure

- AWS Lightsail
- Nginx Reverse Proxy
- SSL-enabled deployment
- Docker containers

---

# Project Structure

```bash
FinShield-AI/
│
├── client/              # React frontend
├── server/              # Express backend
├── presidio-server/     # Dockerized Presidio service
└── README.md
```

---

# How to Run Locally

## Clone Repository

```bash
git clone https://github.com/ankitsinghrajp/fin-shield-ai.git

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
cd presidio-server
docker-compose up
```

---

# Environment Variables

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

# Deployment

FinShield AI is deployed using:

- AWS Lightsail
- Nginx reverse proxy
- SSL-secured APIs
- Dockerized processing services

Backend API:

```bash
api.refynai.org
```

---

# Example Use Cases

- Financial compliance workflows
- KYC sanitization
- AI dataset preprocessing
- Internal enterprise log cleaning
- Healthcare record protection
- Data sharing compliance
- Secure analytics pipelines

---

# Tradeoffs & Engineering Decisions

### Why multi-layer detection?

Single-method detection pipelines fail on real-world noisy datasets.

FinShield combines:
- Regex precision
- NLP flexibility
- Presidio contextual analysis

to improve both recall and reliability.

---

### Why in-memory processing?

Persistent raw storage introduces unnecessary privacy risk.

FinShield processes datasets temporarily and only returns sanitized outputs.

---

### Why utility-preserving masking?

Most redaction systems destroy analytical usefulness.

FinShield preserves:
- structure
- formatting
- statistical utility
- partial identifiers

where possible.

---

# Future Improvements

- Differential privacy integration
- Role-based masking policies
- Streaming dataset processing
- Batch enterprise workflows
- Custom PII training
- GPU-accelerated NLP pipelines
- Compliance audit reports

---

# Demo Flow

1. Upload dataset
2. Detect sensitive entities
3. Analyze PII categories
4. Apply masking pipeline
5. Preview sanitized output
6. Export masked dataset

---

# Author

Ankit Singh Chouhan

Built for:
Hack to the Future — Blostem AI Hackathon
