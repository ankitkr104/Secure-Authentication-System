// appwrite-api.js
// This file acts as the API client for the frontend, using Appwrite as the backend.
// To use this, replace the <script src="mock-api.js"></script> in index.html with:
// <script src="https://cdn.jsdelivr.net/npm/appwrite@13.0.1"></script>
// <script src="appwrite-api.js"></script>

class AppwriteAPIClient {
    constructor() {
        if (typeof Appwrite === 'undefined') {
            console.error('Appwrite SDK not loaded. Please include it via CDN in index.html.');
            return;
        }
        
        this.client = new Appwrite.Client();
        // Replace with your Appwrite Endpoint and Project ID
        this.client
            .setEndpoint('https://cloud.appwrite.io/v1') 
            .setProject('ankitkr104'); 
            
        this.account = new Appwrite.Account(this.client);
        this.storage = new Appwrite.Storage(this.client);
        
        // Replace with your Appwrite Storage Bucket ID
        this.bucketId = '6a859e4e000b46be6d00'; 
    }

    async register(email, password, name) {
        try {
            // Appwrite uses unique IDs for users
            const res = await this.account.create(Appwrite.ID.unique(), email, password, name);
            return { message: 'Registration successful' };
        } catch (err) {
            console.error("Register error:", err);
            throw new Error(err.message || 'Registration failed');
        }
    }

    async login(email, password) {
        try {
            // Creates a session cookie automatically handled by the browser
            const session = await this.account.createEmailSession(email, password);
            const user = await this.account.get();
            
            // We simulate returning a token to satisfy index.html's expectations, 
            // even though Appwrite uses httpOnly cookies by default for web.
            const fakeToken = session.$id; 
            localStorage.setItem('auth_token', fakeToken);
            
            return {
                token: fakeToken,
                user: { id: user.$id, email: user.email, name: user.name }
            };
        } catch (err) {
            // Appwrite might throw specific errors; we wrap it in a generic one per requirements
            console.error("Login error:", err);
            throw new Error('Invalid email or password');
        }
    }

    async logout() {
        try {
            await this.account.deleteSession('current');
        } catch (err) {
            // If there's no session in Appwrite (e.g., stale local storage), ignore the error
            console.warn('Appwrite session already deleted or missing.', err);
        } finally {
            // Always clear the local storage so the UI resets
            localStorage.removeItem('auth_token');
        }
        return { message: 'Logout successful' };
    }

    async getProfile() {
        try {
            const user = await this.account.get();
            return { id: user.$id, email: user.email, name: user.name };
        } catch (err) {
            throw new Error('Unauthorized');
        }
    }

    async listFiles() {
        try {
            // In Appwrite, document-level security ensures users only see their files
            const filesList = await this.storage.listFiles(this.bucketId);
            return filesList.files.map(f => ({
                id: f.$id,
                filename: f.name,
                size: f.sizeOriginal,
                uploadedAt: f.$createdAt
            }));
        } catch (err) {
            console.error("List files error:", err);
            throw new Error('Failed to list files: ' + err.message);
        }
    }
    
    async getFile(fileId) {
        try {
            const file = await this.storage.getFile(this.bucketId, fileId);
            // Returns file metadata just like the Custom Backend
            return {
                id: file.$id,
                filename: file.name,
                size: file.sizeOriginal,
                uploadedAt: file.$createdAt
            };
        } catch (err) {
            console.error("Get file error:", err);
            throw new Error('File not found or access denied: ' + err.message);
        }
    }
    
    async uploadFile(file) {
        try {
            // Uses Appwrite's built-in file upload with document security
            // Appwrite.Role.user(userId) can be used for precise permissions, 
            // but default bucket permissions (users can write, users can read their own) is standard.
            const user = await this.account.get();
            const res = await this.storage.createFile(
                this.bucketId,
                Appwrite.ID.unique(),
                file,
                [
                    Appwrite.Permission.read(Appwrite.Role.user(user.$id)),
                    Appwrite.Permission.update(Appwrite.Role.user(user.$id)),
                    Appwrite.Permission.delete(Appwrite.Role.user(user.$id))
                ]
            );
            return res;
        } catch (err) {
            console.error("Upload error:", err);
            throw new Error('File upload failed: ' + err.message);
        }
    }
}

// Map the new client to the window.api object expected by index.html
if (typeof Appwrite !== 'undefined') {
    window.api = new AppwriteAPIClient();
}
