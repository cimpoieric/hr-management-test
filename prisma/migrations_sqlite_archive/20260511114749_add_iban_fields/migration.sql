-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyIban" TEXT,
    "companyBank" TEXT,
    "updatedAt" DATETIME NOT NULL
);
