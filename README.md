# DriveMerge

## Unified Cloud Storage Management Platform

**A cloud storage aggregation system for intelligent multi-account Google Drive integration**

DriveMerge is a middleware platform that aggregates multiple Google Drive accounts into a unified storage interface. The system intelligently distributes files across linked accounts, overcoming individual storage limitations while maintaining complete transparency from the user's perspective.

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Proposed Solution](#proposed-solution)
- [Hosted URLs](#hosted-urls)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Setup Instructions](#setup-instructions)
- [Current Limitations](#current-limitations)
- [Future Scope](#future-scope)
- [Contributors](#contributors)

---

## Overview

Google Drive's free tier limits individual account storage to **15 GB**, forcing users with larger storage needs to maintain multiple accounts and manually manage data fragmentation. DriveMerge addresses this critical gap by implementing an intelligent middleware layer that seamlessly integrates multiple Google Drive accounts into a single virtual storage pool.

The system employs three key innovations:
1. **Storage-aware distributed allocation** that respects individual account quotas
2. **Parallel chunk uploading** to reduce total transfer time
3. **Transparent file reconstruction** that reassembles distributed files on download without user awareness

---

## Problem Statement

Users seeking to utilize multiple free-tier accounts face significant constraints:

| Challenge | Impact |
|-----------|--------|
| **Storage Limit** | 15 GB per Google Drive account restricts users unable or unwilling to purchase premium storage |
| **Account Switching Overhead** | Manual switching between accounts consumes user time and creates workflow interruptions |
| **File Fragmentation** | Data spread across accounts complicates search, discovery, and collaborative workflows |

---

## Proposed Solution

DriveMerge delivers a comprehensive solution with four core components:

**Unified Interface**
Seamlessly combines multiple Google Drive accounts into a single, intuitive interface for effortless management.

**Automated Segmentation**
Files are automatically segmented and intelligently distributed across linked accounts to optimize total storage usage.

**Transparent Reconstruction**
Files are transparently reconstructed on download, providing a seamless user experience without manual intervention.

**Secure Access**
Leverages industry-standard OAuth 2.0 for secure, credential-less access to linked Google Drive accounts.

---

## Hosted URLs

| Component | URL |
|-----------|-----|
| **Frontend** | [https://drive-merge.vercel.app/](https://drive-merge.vercel.app/) |
| **Backend** | [https://drive-merge-server.vercel.app/](https://drive-merge-server.vercel.app/) |

---

## Key Features

**Authentication & Account Management**
- Multi-account OAuth login with secure Google authentication
- Seamless account linking and concurrent authentication flows

**Storage Management**
- Unified storage management interface combining all linked drives
- Combined dashboard showing total and used storage across accounts
- Real-time storage capacity tracking and quota monitoring

**File Operations**
- Automatic file chunking and smart distribution logic
- Parallel chunk uploads to multiple accounts (up to 3 concurrent transfers)
- Seamless file reconstruction during download
- Memory-safe streaming downloads for large files

**Performance & Optimization**
- Large file handling supporting uploads beyond single-account limits
- Parallel uploads significantly reducing overall upload time
- Efficient storage distribution across connected accounts

---

## Technology Stack

**Frontend**
- React.js with TypeScript for type-safe development
- Responsive user interface with real-time state management
- Intuitive file management with drag-and-drop upload capabilities

**Backend**
- Node.js with Express.js for robust API services
- OAuth2 authentication handler managing refresh tokens
- Upload engine implementing chunking logic and parallel transfer coordination
- Download proxy reconstructing files from distributed chunks

**Database**
- MySQL for relational data storage
- Prisma ORM for schema management and efficient database interaction

**Cloud Integration**
- Google Drive API for authentication, file operations, and quota monitoring

---

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager
- MySQL database
- Google Cloud project with Drive API enabled

### 1. Clone the Repository

```bash
git clone https://github.com/nandu-99/DriveMerge
cd DriveMerge
```

### 2. Setup Backend

```bash
cd server
npm install
cp .env.example .env
```

Configure environment variables with your Google Cloud credentials and database configuration.

Run Prisma migrations:
```bash
npx prisma migrate dev
```

Start the backend server:
```bash
node index.js
```

### 3. Setup Frontend

```bash
cd ..
cd client
npm install
cp .env.example .env
```

Configure environment variables with your API configuration.

Run the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

---

## Current Limitations

- **Google Cloud Test Mode**: Application is in test mode — only developer-approved users can authenticate with Google Drive
- **Single Account Upload**: File uploads currently target the first connected Drive only
- **No Encryption**: Access tokens stored in plain text (encryption planned for Phase 2)
- **Authentication Scope**: Limited to Google Drive integration (multi-cloud support planned)

---

## Future Scope

**End-to-End Encryption**
Client-side encryption before upload to ensure zero-knowledge data privacy and protection from unauthorized access.

**Multi-Cloud Support**
Extend integration to platforms like Dropbox and OneDrive, creating a universal storage aggregation system.

**Advanced File Versioning**
Introduce version control and rollback capabilities to track file changes and restore previous versions across connected accounts.

**Analytics Dashboard**
Provide detailed insights on storage usage trends, distribution patterns, and system performance metrics.

**Content-Based Deduplication**
Identify identical files across accounts and eliminate redundant storage to optimize capacity utilization.

---

## Contributors

| Name | Student ID |
|------|-----------|
| **Charan Adithya** | 230075 |
| **Vivekananda** | 230077 |
| **Aditya Kammati** | 230145 |

---
