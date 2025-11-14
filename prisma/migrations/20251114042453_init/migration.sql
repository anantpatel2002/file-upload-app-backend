-- CreateTable
CREATE TABLE "uploaded_file" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalname" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedText" TEXT,
    "fileType" TEXT NOT NULL,

    CONSTRAINT "uploaded_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_file_filename_key" ON "uploaded_file"("filename");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_file_path_key" ON "uploaded_file"("path");

-- CreateIndex
CREATE INDEX "uploaded_file_fileType_idx" ON "uploaded_file"("fileType");

-- CreateIndex
CREATE INDEX "uploaded_file_uploadDate_idx" ON "uploaded_file"("uploadDate");
