-- CreateTable
CREATE TABLE "Complex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sigungu" TEXT NOT NULL,
    "dongName" TEXT NOT NULL,
    "buildYear" INTEGER,
    "totalHouseholds" INTEGER,
    "latitude" REAL,
    "longitude" REAL,
    "nearestElemSchoolM" INTEGER,
    "nearestSubwayM" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "complexId" TEXT NOT NULL,
    "dealDate" DATETIME NOT NULL,
    "priceKrw" BIGINT NOT NULL,
    "area" REAL NOT NULL,
    "floor" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MOLIT',
    CONSTRAINT "Transaction_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "Complex" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommuteCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originKey" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Complex_sigungu_dongName_idx" ON "Complex"("sigungu", "dongName");

-- CreateIndex
CREATE UNIQUE INDEX "Complex_sigungu_dongName_name_key" ON "Complex"("sigungu", "dongName", "name");

-- CreateIndex
CREATE INDEX "Transaction_complexId_dealDate_idx" ON "Transaction"("complexId", "dealDate");

-- CreateIndex
CREATE INDEX "Transaction_complexId_area_dealDate_idx" ON "Transaction"("complexId", "area", "dealDate");

-- CreateIndex
CREATE INDEX "CommuteCache_originKey_idx" ON "CommuteCache"("originKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommuteCache_originKey_complexId_mode_key" ON "CommuteCache"("originKey", "complexId", "mode");
