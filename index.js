// index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());
// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- File Storage with Multer ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Store as timestamp_originalname.pdf
        const uniqueFilename = `${Date.now()}_${file.originalname}`;
        cb(null, uniqueFilename);
    },
});

// File filter to accept only PDFs
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only .pdf files are allowed!'), false);
    }
};

// Multer configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

// --- API Endpoints ---

/**
 * POST /upload
 * Uploads a PDF file.
 */
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        // Get title from request body
        const { title } = req.body;

        // Read the uploaded PDF file to extract text
        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdf(dataBuffer);

        // Create metadata object
        const fileMetadata = {
            title: title || req.file.originalname, // Use title or fallback to original name
            originalname: req.file.originalname,
            filename: req.file.filename,
            path: req.file.path,
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploadDate: new Date().toISOString(),
            extractedText: pdfData.text.trim(), // Store the extracted text
        };

        // Save metadata to the database
        const newFile = db.addFile(fileMetadata);

        res.status(201).json({
            message: 'File uploaded and processed successfully!',
            file: newFile,
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        // Handle file filter error
        if (error.message.includes('Only .pdf files are allowed')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error during file upload.' });
    }
});

/**
 * GET /files
 * Returns a list of all uploaded files.
 */
app.get('/files', (req, res) => {
    try {
        const files = db.getFiles();
        // Return metadata, not the full text (for brevity)
        const filesMetadata = files.map(f => ({
            id: f.id,
            title: f.title,
            originalname: f.originalname,
            uploadDate: f.uploadDate,
            size: f.size,
        }));
        res.status(200).json(filesMetadata);
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * GET /search?query=...
 * Searches files by title, name, or extracted text.
 */
app.get('/search', (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'Search query is required.' });
        }

        const results = db.searchFiles(query);

        // Format results (remove extractedText for brevity)
        const formattedResults = results.map(f => ({
            id: f.id,
            title: f.title,
            originalname: f.originalname,
            uploadDate: f.uploadDate,
            size: f.size,
        }));

        res.status(200).json(formattedResults);
    } catch (error) {
        console.error('Error searching files:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});