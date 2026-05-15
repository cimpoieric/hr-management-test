-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingImport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL_UPLOAD',
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "extractedFields" TEXT NOT NULL,
    "confidenceScore" REAL NOT NULL,
    "uncertainFields" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "employeeId" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingImport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PendingImport" ("confidenceScore", "createdAt", "employeeId", "extractedFields", "fileName", "filePath", "fileSize", "id", "mimeType", "notes", "rawText", "sourceType", "status", "uncertainFields", "updatedAt") SELECT "confidenceScore", "createdAt", "employeeId", "extractedFields", "fileName", "filePath", "fileSize", "id", "mimeType", "notes", "rawText", "sourceType", "status", "uncertainFields", "updatedAt" FROM "PendingImport";
DROP TABLE "PendingImport";
ALTER TABLE "new_PendingImport" RENAME TO "PendingImport";
CREATE INDEX "PendingImport_status_idx" ON "PendingImport"("status");
CREATE INDEX "PendingImport_createdAt_idx" ON "PendingImport"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
