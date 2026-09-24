-- CreateTable
CREATE TABLE "Stamp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "productId" TEXT,
    "tableCode" TEXT,
    "dayKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WholesaleAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ParLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "unitGrams" INTEGER NOT NULL,
    "parGrams" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParLevel_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WholesaleAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Stamp_shop_customerId_idx" ON "Stamp"("shop", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Stamp_shop_customerId_kind_refCode_dayKey_key" ON "Stamp"("shop", "customerId", "kind", "refCode", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "WholesaleAccount_shop_customerId_key" ON "WholesaleAccount"("shop", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ParLevel_accountId_variantId_key" ON "ParLevel"("accountId", "variantId");
