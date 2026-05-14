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
    CONSTRAINT "Transaction_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "Complex" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "complexId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "brokerName" TEXT,
    "brokerPhoneHash" TEXT,
    "askPriceKrw" BIGINT NOT NULL,
    "area" REAL NOT NULL,
    "floor" INTEGER,
    "direction" TEXT,
    "description" TEXT,
    "photos" TEXT,
    "rawHtml" TEXT,
    "postedAt" DATETIME,
    "lastModifiedAt" DATETIME,
    "refreshHistory" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitterIpHash" TEXT,
    CONSTRAINT "Listing_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "Complex" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "band" TEXT NOT NULL,
    "signals" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Score_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "reporterIpHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "Listing_externalUrl_key" ON "Listing"("externalUrl");

-- CreateIndex
CREATE INDEX "Listing_complexId_area_idx" ON "Listing"("complexId", "area");

-- CreateIndex
CREATE INDEX "Listing_submittedAt_idx" ON "Listing"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Score_listingId_key" ON "Score"("listingId");

-- CreateIndex
CREATE INDEX "Score_total_idx" ON "Score"("total");

-- CreateIndex
CREATE INDEX "Report_listingId_idx" ON "Report"("listingId");
