-- CreateTable
CREATE TABLE "Complex" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sigungu" TEXT NOT NULL,
    "dongName" TEXT NOT NULL,
    "buildYear" INTEGER,
    "totalHouseholds" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "nearestElemSchoolM" INTEGER,
    "nearestSubwayM" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Complex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "dealDate" TIMESTAMP(3) NOT NULL,
    "priceKrw" BIGINT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "floor" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MOLIT',

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommuteCache" (
    "id" TEXT NOT NULL,
    "originKey" TEXT NOT NULL,
    "complexId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommuteCache_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_complexId_fkey" FOREIGN KEY ("complexId") REFERENCES "Complex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
