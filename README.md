# Secure Authentication System Assignment

This repository contains two distinct implementations of a secure authentication and file access system, fulfilling the assignment requirements.

## 1. Custom Backend (Node.js, Express, PostgreSQL)

### Setup Instructions
1. Ensure Docker is running.
2. Start the PostgreSQL database:
   ```bash
   docker-compose up -d
   ```
3. Install Node.js dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   node server.js
   ```
5. Run the database seeding and verification script to populate 3 users (Alice, Bob, Charlie) and verify file isolation:
   ```bash
   node seed-and-test.js
   ```
6. Open your browser and navigate to `http://localhost:3000` to interact with the client.

### Architecture & Security Decisions
* **Password Hashing**: Implemented using `bcrypt` (cost 10) in `server.js` before saving to PostgreSQL.
* **Rate Limiting**: `express-rate-limit` is used on the `/api/login` endpoint to strictly lock out brute-force attempts (max 5 requests per 15 minutes).
* **Generic Errors**: The login endpoint deliberately returns `401 Unauthorized: Invalid email or password` regardless of whether the email exists or the password is wrong, preventing user enumeration.
* **Data Isolation**: The `/api/files` and `/api/files/:id` endpoints explicitly require the `userId` attached to the validated session token. The query strictly restricts results (`WHERE user_id = $1`), ensuring it is impossible to read another user's files.

### Session Justification (Stateful Tokens)
I chose to use **stateful database-backed session tokens** (a secure UUID stored in a `sessions` table alongside the user's ID) rather than stateless JWTs. 

**Justification**: The assignment strictly required that "Logout... should invalidate the session server-side". Stateless JWTs cannot be reliably invalidated server-side without building a complex token blacklist (effectively making them stateful anyway). By using a database session table, server-side invalidation is achieved trivially and securely by deleting the session row upon logout.

---

## 2. Managed Backend (Appwrite)

The second implementation utilizes Appwrite as a fully managed Backend-as-a-Service, leveraging the Appwrite Web SDK.

### Setup Instructions
1. In `appwrite-api.js`, the `Project ID` and `Bucket ID` have been configured. 
2. Ensure you have registered a **Web Platform** in the Appwrite Console (Hostname: `localhost`).
3. To switch the frontend to use Appwrite, open `index.html` and replace:
   ```html
   <script src="mock-api.js"></script>
   ```
   with:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/appwrite@13.0.1"></script>
   <script src="appwrite-api.js"></script>
   ```
4. Open the frontend in your browser.

## Architecture & Security Decisions
* **Authentication**: Appwrite natively hashes passwords (Argon2) and handles rate-limiting internally. We utilize `createEmailSession` to establish secure sessions.
* **Server-side Invalidation**: The `logout()` function securely terminates the specific session on the server via `account.deleteSession('current')`.
* **File Isolation**: File uploads leverage Appwrite's **Document Level Security**. When a file is uploaded, permissions are explicitly granted *only* to the uploading user's Role (`Appwrite.Role.user(userId)`). This strictly guarantees isolated file access at the database level.
