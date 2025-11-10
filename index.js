const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const { PDFParse } = require("pdf-parse");
const db = require("./db");
const search = require("./lib/search");

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fsSync.existsSync(UPLOADS_DIR)) {
  fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log("Created uploads directory");
}

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    console.error("Request timeout:", req.method, req.path);
    res.status(408).json({
      message: "Request timeout. The operation took too long to complete.",
    });
  });
  res.setTimeout(30000, () => {
    console.error("Response timeout:", req.method, req.path);
  });
  next();
});

// Serve static files from the 'uploads' directory
app.use("/uploads", express.static(UPLOADS_DIR));

// --- File Storage with Multer---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFilename = `${Date.now()}_${sanitizedName}`;
    cb(null, uniqueFilename);
  },
});

// --- PDF Multer Config ---
const pdfFileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only .pdf files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: pdfFileFilter,
  limits: { fileSize: 105 * 1024 * 1024 }, // 100 MB limit
});

// --- VIDEO Multer Config---
const videoFileFilter = (req, file, cb) => {
  if (file.mimetype === "video/mp4") {
    cb(null, true);
  } else {
    cb(new Error("Only .mp4 video files are allowed!"), false);
  }
};

const uploadVideo = multer({
  storage: storage,
  fileFilter: videoFileFilter,
  limits: { fileSize: 525 * 1024 * 1024 }, // 500 MB limit
});

// --- Helper function to clean up file ---
async function cleanupFile(filePath) {
  try {
    await fs.unlink(filePath);
    console.log(`Cleaned up file: ${filePath}`);
  } catch (error) {
    console.error(`Failed to cleanup file ${filePath}:`, error.message);
  }
}

// --- API Endpoints ---

/**
 * POST /upload
 * Uploads a PDF file.
 */
app.post("/upload", upload.single("file"), async (req, res) => {
  let uploadedFilePath = null;
  const startTime = Date.now();
  console.log("accessing /upload route (PDF)");
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    uploadedFilePath = req.file.path;
    const { title } = req.body;

    if (title && title.trim().length === 0) {
      await cleanupFile(uploadedFilePath);
      return res.status(400).json({ message: "Title cannot be empty." });
    }

    const dataBuffer = await fs.readFile(uploadedFilePath);

    const parser = new PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();
    await parser.destroy();

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      await cleanupFile(uploadedFilePath);
      return res
        .status(400)
        .json({ message: "PDF contains no extractable text." });
    }

    // Create metadata object
    const fileMetadata = {
      title: title?.trim() || req.file.originalname,
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadDate: new Date().toISOString(),
      extractedText: pdfData.text.trim(),
      fileType: "pdf",
    };

    const newFile = await db.addFile(fileMetadata);

    if (!newFile) {
      await cleanupFile(uploadedFilePath);
      return res
        .status(500)
        .json({ message: "Failed to save file metadata to database." });
    }

    search.addToFileIndex(newFile);

    res.status(201).json({
      message: "File uploaded and processed successfully!",
      file: {
        id: newFile.id,
        title: newFile.title,
        originalname: newFile.originalname,
        uploadDate: newFile.uploadDate,
        size: newFile.size,
        fileType: newFile.fileType,
      },
      processingTime: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    console.error(`Upload failed after ${Date.now() - startTime}ms`);

    if (uploadedFilePath) {
      await cleanupFile(uploadedFilePath);
    }

    if (error.message.includes("Only .pdf files are allowed")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes("File too large")) {
      return res
        .status(400)
        .json({ message: "File size exceeds 100MB limit." });
    }

    res.status(500).json({
      message: "Server error during file upload.",
      error: error.message,
    });
  }
});

/**
 * POST /upload/video
 * Uploads an MP4 video file. (NEW)
 */
app.post("/upload/video", uploadVideo.single("file"), async (req, res) => {
  let uploadedFilePath = null;
  const startTime = Date.now();
  console.log("accessing /upload/video route");
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    uploadedFilePath = req.file.path;
    const { title } = req.body;

    if (title && title.trim().length === 0) {
      await cleanupFile(uploadedFilePath);
      return res.status(400).json({ message: "Title cannot be empty." });
    }

    // Create metadata object for video
    const fileMetadata = {
      title: title?.trim() || req.file.originalname,
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadDate: new Date().toISOString(),
      fileType: "video",
      extractedText: null,
    };

    const newFile = await db.addFile(fileMetadata);

    if (!newFile) {
      await cleanupFile(uploadedFilePath);
      return res
        .status(500)
        .json({ message: "Failed to save file metadata to database." });
    }

    search.addToFileIndex(newFile);

    res.status(201).json({
      message: "Video file uploaded successfully!",
      file: {
        id: newFile.id,
        title: newFile.title,
        originalname: newFile.originalname,
        uploadDate: newFile.uploadDate,
        size: newFile.size,
        fileType: newFile.fileType,
      },
      processingTime: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("Error uploading video:", error);
    console.error(`Upload failed after ${Date.now() - startTime}ms`);

    if (uploadedFilePath) {
      await cleanupFile(uploadedFilePath);
    }

    if (error.message.includes("Only .mp4 video files are allowed")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes("File too large")) {
      return res
        .status(400)
        .json({ message: "File size exceeds 500MB limit." });
    }

    res.status(500).json({
      message: "Server error during video file upload.",
      error: error.message,
    });
  }
});

/**
 * GET /files
 * Returns a list of all uploaded files.
 */
app.get("/files", async (req, res) => {
  try {
    const files = await db.getFiles();

    if (!files) {
      return res
        .status(500)
        .json({ message: "Error retrieving files from database." });
    }


    res.status(200).json(files);
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
});

/**
 * GET /files/:id
 * Returns a specific file's details including extracted text.
 */
app.get("/files/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const file = await db.getFileById(id);

    if (!file) {
      return res.status(404).json({ message: "File not found." });
    }

    res.status(200).json(file);
  } catch (error) {
    console.error("Error fetching file:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
});

/**
 * GET /search?query=...
 * Searches files by title, name, or extracted text.
 */
app.get("/search", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res
        .status(400)
        .json({ message: "Search query is required and cannot be empty." });
    }

    const matchingIds = search.searchIndex(query.trim().toLowerCase());

    if (matchingIds.length === 0) {
      return res.status(200).json([]); // Return empty array, not an error
    }

    const results = await db.getFilesByIds(matchingIds);

    if (!results) {
      return res.status(500).json({ message: "Error searching files." });
    }

    const formattedResults = results.map((file) => ({
      ...file,
      snippet: file.extractedText
        ? file.extractedText.substring(0, 200) + "..."
        : "",
    }));

    res.status(200).json(results);
  } catch (error) {
    console.error("Error searching files:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
});

/**
 * DELETE /files/:id
 * Deletes a file and its metadata.
 */
app.delete("/files/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const file = await db.getFileById(id);

    if (!file) {
      return res.status(404).json({ message: "File not found." });
    }

    // Delete the physical file
    await cleanupFile(file.path);

    // Delete from database
    const deleted = await db.deleteFile(id);

    if (!deleted) {
      return res
        .status(500)
        .json({ message: "Failed to delete file from database." });
    }

    search.removeFromFileIndex(id);

    res.status(200).json({ message: "File deleted successfully." });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File size limit exceeded." });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }

  res.status(500).json({ message: "Internal server error." });
});

// --- Start Server ---
app.listen(PORT, async () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  await search.initializeIndex(db.getFiles);
});
