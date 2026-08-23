// mock-api.js (Updated to interact with Real Backend)
// This file acts as the API client for the frontend.

class APIClient {
    constructor() {
        this.baseUrl = 'http://localhost:3000/api';
    }

    _getAuthToken() {
        return localStorage.getItem('auth_token');
    }

    async _fetch(endpoint, options = {}) {
        const token = this._getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        };
        
        // Remove Content-Type if sending FormData (e.g. for file uploads)
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.message || 'API request failed');
            }
            return data;
        } else {
            if (!response.ok) {
                throw new Error('API request failed');
            }
            // For file downloads
            return response.blob();
        }
    }

    async register(email, password, name) {
        return this._fetch('/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name })
        });
    }

    async login(email, password) {
        const data = await this._fetch('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        localStorage.setItem('auth_token', data.token);
        return data;
    }

    async logout() {
        await this._fetch('/logout', { method: 'POST' });
        localStorage.removeItem('auth_token');
        return { message: 'Logout successful' };
    }

    async getProfile() {
        return this._fetch('/profile');
    }

    async listFiles() {
        return this._fetch('/files');
    }
    
    async getFile(fileId) {
        return this._fetch(`/files/${fileId}`);
    }
    
    // Additional method to support actual file uploads required by the backend
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        return this._fetch('/files', {
            method: 'POST',
            body: formData
        });
    }
}

// Map the new client to the window.api object expected by index.html
window.api = new APIClient();
