# Drive Merge - Comprehensive System Documentation

## 1. Project Overview

**Drive Merge** is a distributed file storage aggregator. It solves the problem of fragmented cloud storage by virtually pooling multiple Google Drive accounts into a single, unified file system.

### Core Value Proposition
-   **Virtual Storage Pool**: Combines free tiers of multiple Google accounts (e.g., 15GB + 15GB = 30GB).
-   **Intelligent "Sharding"**: Large files are automatically split (chunked) and distributed across accounts based on real-time available space.
-   **Transparency**: Users see one file, but the backend manages the complexity of storage locations.

---

## 2. Architecture & Tech Stack

### High-Level Architecture
The system functions as a middleware between the user and Google's servers.

```mermaid
graph TD
    User((User))
    Client[React Client]
    Server[Node/Express Server]
    DB[(Prisma/MySQL)]
    
    User <-->|Interact| Client
    Client <-->|REST API| Server
    Server <-->|SQL Queries| DB
    
    subgraph "Cloud Layer"
        G1[Google Account 1]
        G2[Google Account 2]
        G3[Google Account 3]
        Cloud[Cloudinary]
    end
    
    Server <-->|Upload/Download| G1
    Server <-->|Upload/Download| G2
    Server <-->|Upload/Download| G3
    Server <-->|Thumbnails| Cloud
```

### Technology Stack
| Layer | Tech | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React, Vite, TS | UI/UX, Upload Dashboard, File Browser |
| **Styling** | Tailwind, Shadcn/UI | Modern, responsive aesthetics |
| **Backend** | Express.js, Node.js | Business logic, API endpoints, Stream handling |
| **Database** | Prisma + MySQL | relational data modeling, tracking file chunks |
| **Auth** | Google OAuth2 | Secure access to user's Drive accounts |
| **Storage** | Google Drive API v3 | Actual physical storage of bytes |

---

## 3. Database Schema (ER Diagram)

The backbone of Drive Merge is its ability to map a single virtual file to potentially multiple physical Drive locations.

```mermaid
erDiagram
    User ||--o{ DriveAccount : "owns"
    User ||--o{ File : "uploads"
    User ||--o{ TransferJob : "initiates"

    DriveAccount {
        int id PK
        string email
        string refreshToken
        float usedSpaceGb
        float totalSpaceGb
    }

    File {
        int id PK
        string driveFileId "Virtual ID if split"
        boolean isSplit "True if chunked"
        bigint sizeBytes
        string name
    }

    File ||--|{ FileChunk : "composed of"
    DriveAccount ||--o{ File : "stores (if not split)"
    DriveAccount ||--o{ FileChunk : "stores parts"

    FileChunk {
        int id PK
        int chunkIndex "Order: 0, 1, 2..."
        string driveFileId "Physical ID on Drive"
        int driveAccountId FK
    }

    TransferJob {
        int id PK
        string uploadId "UUID"
        string status "pending|success|failed"
    }
```

-   **Files**: A `File` record exists for every file the user sees.
-   **Splitting**: If `isSplit` is false, the `File` points directly to a `DriveAccount`. If true, it relies on `FileChunk` records to find its data.

---

## 4. Key Workflows

### 4.1 Authentication & Account Linking
The system uses OAuth2 to act on behalf of the user. We request `offline` access to get a **Refresh Token**, which allows us to upload/download files even when the user is not actively logged in (though currently session-based).

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    participant G as Google Auth

    U->>C: Click "Link Drive Account"
    C->>S: GET /auth/url
    S->>C: Return Google Auth URL
    C->>U: Redirect to Google
    U->>G: Grant Permissions (Drive Scope)
    G->>S: Callback Code (GET /auth/callback)
    S->>G: Exchange Code for Refresh Token
    G->>S: Return Refresh + Access Tokens
    S->>S: Verify Email & Save to DB
    S->>C: Redirect to Dashboard
```

### 4.2 The "Merge" Upload Logic (Core Engine)
This is the most complex part of the system. It decides *how* to store a file to maximize space utilization.

#### Decision Flowchart

```mermaid
flowchart TD
    Start([User Selects File]) --> Hash[Calculate SHA-256 Hash]
    Hash --> Dup{Duplicate?}
    Dup -- Yes --> Skip[Mark as Duplicate]
    Dup -- No --> Space[Refresh Real-time Quotas]
    
    Space --> Calc[Calculate Chunk Distribution]
    Calc --> Fit{Fits in One Account?}
    
    Fit -- Yes --> Single[Strategy: Single Direct Upload]
    Fit -- No --> Multi[Strategy: Distributed Chunking]
    
    Single --> Up1[Stream to Target Account]
    Multi --> Split[Split File Stream]
    Split --> P1[Upload Chunk A -> Account 1]
    Split --> P2[Upload Chunk B -> Account 2]
    
    Up1 --> Verify
    P1 --> Verify
    P2 --> Verify
    
    Verify[Verify Integrity] --> DB[Commit to Database]
    DB --> End([Success])
```

#### Detailed Logic
1.  **Storage Analysis**: Before *every* upload, the server queries the Google Drive API for the latest `storageQuota` (limit & usage) of every connected account. DB values are updated.
2.  **Greedy Allocation**:
    -   If a user selects a "Preferred Account" and it fits, use it.
    -   Else, look for *any* single account that fits the whole file (prioritizing the one with the *least* free space that still fits it, to leave big gaps for big files? Or largest first? Current logic: Largest free space first).
    -   **Fallback (Chunking)**: If no single account fits, the system "fills up" accounts. It takes the account with the most free space, calculates a chunk size equal to that free space, assigns a chunk, and repeats with the remaining file bytes and accounts.

### 4.3 Download & Reassembly
When a user downloads a split file, the server acts as a streaming proxy.

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant G1 as Drive Acct 1
    participant G2 as Drive Acct 2

    Client->>Server: GET /files/:id/download
    Server->>Server: Lookup File & Chunks
    
    alt isSplit = false
        Server->>G1: Get File Stream
        G1-->>Client: Stream Bytes...
    else isSplit = true
        note right of Server: Sequential Streaming
        Server->>G1: Get Chunk 0 Stream
        G1-->>Client: Stream Chunk 0 Bytes...
        Server->>G2: Get Chunk 1 Stream
        G2-->>Client: Stream Chunk 1 Bytes...
    end
```
**Result**: The client receives a single continuous byte stream, unaware that the data came from two different Google accounts.

---

## 5. Application Structure

### Backend (`/server`)
*   **`controllers/driveController.js`**:
    *   `uploadFiles`: Entry point. Parses multipart form, handles hashing, calls distribution logic.
    *   `uploadWithStorageAwareChunking`: The "Engine". Manages the concurrency (limit: 3) of chunk uploads. It uses a `Promise.race` queue to manage parallel streams.
    *   `deleteFile`: Handles localized deletion (one account) or distributed deletion (looping through chunks).
*   **`utils/googleDrive.js`**: Helper for initializing the `googleapis` library.

### Frontend (`/client`)
*   **`context/uploads.tsx`**:
    *   **Polling/SSE**: Listens for progress events. The server writes to a localized `progressMap` (in-memory) and the client polls/receives these updates to show bars like "Uploading Chunk 1/4 to user@gmail.com".
*   **`pages/Transfers.tsx`**:
    *   Displays the real-time logs.
    *   Columns: File Name, Size, Progress Bar, Speed/Status.

## 6. How to Run

### Prerequisites
1.  **Node.js** (v18+)
2.  **Google Cloud Console Project**:
    *   Enable Drive API.
    *   Create OAuth 2.0 Credentials (Client ID & Secret).
    *   Redirect URI: `http://localhost:5000/auth/callback`.

### Steps
1.  **Clone & Install**:
    ```bash
    git clone repo
    cd server && npm install
    cd ../client && npm install
    ```
2.  **Environment Setup**:
    Create `server/.env`:
    ```env
    DATABASE_URL="file:./dev.db"
    GOOGLE_CLIENT_ID="..."
    GOOGLE_CLIENT_SECRET="..."
    BACKEND_URL="http://localhost:5000"
    FRONTEND_URL="http://localhost:5173"
    ```
3.  **Run**:
    *   Server: `npm run dev` (starts on port 5000)
    *   Client: `npm run dev` (starts on port 5173)

---
