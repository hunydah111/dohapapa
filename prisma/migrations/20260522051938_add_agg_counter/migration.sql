-- CreateTable
CREATE TABLE "AggCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggCounter_pkey" PRIMARY KEY ("key")
);
