const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const { v4: uuidv4 } = require("uuid"); // Use uuid for unique IDs

const adapter = new FileSync("db.json");
const db = low(adapter);

// Set default data structure
db.defaults({ files: [] }).write();

// Helper function to add a file
const addFile = (fileData) => {
  const newFile = { id: uuidv4(), ...fileData };
  db.get("files").push(newFile).write();
  return newFile;
};

// Helper function to get all files
const getFiles = () => {
  return db.get("files").value();
};

// Helper function to search files
const searchFiles = (query) => {
  const lowerCaseQuery = query.toLowerCase();
  return db
    .get("files")
    .filter((file) => {
      const inTitle = file.title?.toLowerCase().includes(lowerCaseQuery);
      const inOriginalName = file.originalname
        .toLowerCase()
        .includes(lowerCaseQuery);
      const inText = file.extractedText?.toLowerCase().includes(lowerCaseQuery);

      return inTitle || inOriginalName || inText;
    })
    .value();
};

module.exports = {
  addFile,
  getFiles,
  searchFiles,
};
