const FlexSearch = require("flexsearch");
// const db = require("../db");

// Create a new search index.
// We use 'document' to index multiple fields
const index = new FlexSearch.Document({
  document: {
    id: "id",
    index: [
      "title",
      "originalname",
      "extractedText", // Search this field
    ],
  },
  tokenize: "forward", // Allows partial word matching (e.g., "doc" matches "document")
});

/**
 * Initializes the search index by loading all files from the database.
 * This should be called on server startup.
 */
const initializeIndex = async (getFiles) => {
  // This function is now "injected"
  if (typeof getFiles !== "function") {
    console.error("initializeIndex requires a getFiles function.");
    return;
  }

  try {
    console.log("Initializing search index...");
    // Use the new db.js function to get files
    const files = await getFiles();

    if (!files || files.length === 0) {
      console.log("No files found to index.");
      return;
    }

    let indexedCount = 0;
    files.forEach((file) => {
      // Create a document to add to the index
      const doc = {
        id: file.id,
        title: file.title,
        originalname: file.originalname,
        // Only add extractedText if it exists (for PDFs)
        extractedText: file.extractedText || "",
      };
      index.add(doc);
      indexedCount++;
    });
    console.log(`Search index initialized with ${indexedCount} documents.`);
  } catch (error) {
    console.error("Error initializing search index:", error);
  }
};

/**
 * Adds a single new file to the search index.
 * @param {object} file - The file object returned from Prisma
 */
const addToFileIndex = (file) => {
  const doc = {
    id: file.id,
    title: file.title,
    originalname: file.originalname,
    extractedText: file.extractedText || "",
  };
  index.add(doc);
  console.log(`Added file ${file.id} to search index.`);
};

/**
 * Removes a file from the search index.
 * @param {string} id - The ID of the file to remove
 */
const removeFromFileIndex = (id) => {
  index.remove(id);
  console.log(`Removed file ${id} from search index.`);
};

/**
 * Searches the index.
 * @param {string} query - The search query
 * @returns {Array<string>} A list of matching file IDs
 */
const searchIndex = (query) => {
  // This searches all indexed fields
  const results = index.search(query, {
    enrich: true, // Returns the full document
  });


  // FlexSearch can return results from multiple fields. We need to flatten and get unique IDs.
  const idSet = new Set();
  results.forEach((result) => {
    result.result.forEach((doc) => {
      idSet.add(doc);
    });
  });

  return Array.from(idSet);
};

module.exports = {
  initializeIndex,
  addToFileIndex,
  removeFromFileIndex,
  searchIndex,
};
