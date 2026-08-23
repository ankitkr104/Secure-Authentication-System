const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const db = require('./db');

const app = express();
const PORT = 3000;

// Setup Middleware
app.use(express.json());
app.use(cors());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Setup Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

// Init DB
db.initDB();

// Rate Limiting for Login
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // Limit each IP to 5 login requests per `window` (here, per 15 minutes)
	message: { error: 'Too many login attempts, please try again later.' },
	standardHeaders: true,
	legacyHeaders: false,
});

// Auth Middleware to check DB session
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
        const { rows } = await db.query(
            'SELECT user_id, expires_at FROM sessions WHERE token = $1 AND expires_at > NOW()',
            [token]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        req.userId = rows[0].user_id;
        req.token = token;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// --- Endpoints ---

// Registration
app.post('/api/register', async (req, res) => {
    const { email, password, name, fullName, displayName, bio, role } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const defaultName = email.split('@')[0];
    const finalFullName = fullName || name || defaultName;
    const finalDisplayName = displayName || defaultName;
    const finalBio = bio || 'New user bio';
    const finalRole = role || 'user';

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (email, password_hash, full_name, display_name, bio, role) VALUES ($1, $2, $3, $4, $5, $6)',
            [email, passwordHash, finalFullName, finalDisplayName, finalBio, finalRole]
        );
        res.status(201).json({ message: 'Registration successful' });
    } catch (err) {
        if (err.code === '23505') { // unique violation
            res.status(400).json({ error: 'User already exists' });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Login
app.post('/api/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Missing credentials' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' }); // Generic error
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' }); // Generic error
        }

        const token = uuidv4();
        // Set expiry to 1 day from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1);

        await db.query(
            'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
            [token, user.id, expiresAt]
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                profile: {
                    fullName: user.full_name,
                    displayName: user.display_name,
                    bio: user.bio,
                    role: user.role,
                    createdAt: user.created_at
                }
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout
app.post('/api/logout', requireAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM sessions WHERE token = $1', [req.token]);
        res.json({ message: 'Logout successful' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Profile
app.get('/api/profile', requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = rows[0];
        res.json({
            id: user.id,
            email: user.email,
            profile: {
                fullName: user.full_name,
                displayName: user.display_name,
                bio: user.bio,
                role: user.role,
                createdAt: user.created_at
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// File Upload
app.post('/api/files', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const { originalname, filename, size, mimetype } = req.file;
        const { rows } = await db.query(
            'INSERT INTO files (user_id, filename, filepath, mime_type, size) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [req.userId, originalname, filename, mimetype, size]
        );
        const f = rows[0];
        res.status(201).json({
            id: f.id,
            ownerId: f.user_id,
            fileName: f.filename,
            mimeType: f.mime_type,
            sizeBytes: f.size,
            uploadedAt: f.uploaded_at
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// List Files
app.get('/api/files', requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM files WHERE user_id = $1 ORDER BY uploaded_at DESC',
            [req.userId]
        );
        res.json(rows.map(f => ({
            id: f.id,
            ownerId: f.user_id,
            fileName: f.filename,
            mimeType: f.mime_type,
            sizeBytes: f.size,
            uploadedAt: f.uploaded_at
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Access Specific File (Metadata)
app.get('/api/files/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await db.query(
            'SELECT * FROM files WHERE id = $1 AND user_id = $2',
            [id, req.userId]
        );

        if (rows.length === 0) {
            return res.status(403).json({ error: 'File not found or access denied' });
        }

        const f = rows[0];
        res.json({
            id: f.id,
            ownerId: f.user_id,
            fileName: f.filename,
            mimeType: f.mime_type,
            sizeBytes: f.size,
            uploadedAt: f.uploaded_at
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download Specific File
app.get('/api/files/:id/download', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await db.query(
            'SELECT * FROM files WHERE id = $1 AND user_id = $2',
            [id, req.userId]
        );

        if (rows.length === 0) {
            return res.status(403).json({ error: 'File not found or access denied' });
        }

        const fileData = rows[0];
        const filePath = path.join(__dirname, 'uploads', fileData.filepath);
        
        if (fs.existsSync(filePath)) {
            res.download(filePath, fileData.filename);
        } else {
            res.status(404).json({ error: 'File physically missing from server' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Serve the frontend static files if we want to run them via this server
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
