-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateTable
CREATE TABLE "Groups" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Units" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Products" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "nameEn" VARCHAR(200) NOT NULL,
    "nameAr" VARCHAR(200) NOT NULL,
    "unitId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "onHandQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouses" (
    "id" SERIAL NOT NULL,
    "store" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreVoucherHeader" (
    "txNo" VARCHAR(20) NOT NULL,
    "storeId" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "transferRef" VARCHAR(20),
    "note" VARCHAR(500),
    "insertUid" VARCHAR(60) NOT NULL DEFAULT 'system',
    "insertDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedUid" VARCHAR(60),
    "postedDate" TIMESTAMP(3),

    CONSTRAINT "StoreVoucherHeader_pkey" PRIMARY KEY ("txNo")
);

-- CreateTable
CREATE TABLE "StoreVoucherDetails" (
    "id" SERIAL NOT NULL,
    "txNo" VARCHAR(20) NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,4) NOT NULL,
    "trnsDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreVoucherDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "txId" SERIAL NOT NULL,
    "ref" VARCHAR(20) NOT NULL,
    "productId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "cost" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("txId")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "avgCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "prefix" VARCHAR(10) NOT NULL,
    "lastNo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("prefix")
);

-- CreateIndex
CREATE UNIQUE INDEX "Groups_code_key" ON "Groups"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Units_code_key" ON "Units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Products_sku_key" ON "Products"("sku");

-- CreateIndex
CREATE INDEX "Products_groupId_idx" ON "Products"("groupId");

-- CreateIndex
CREATE INDEX "Products_unitId_idx" ON "Products"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouses_store_key" ON "Warehouses"("store");

-- CreateIndex
CREATE INDEX "StoreVoucherHeader_storeId_idx" ON "StoreVoucherHeader"("storeId");

-- CreateIndex
CREATE INDEX "StoreVoucherHeader_status_idx" ON "StoreVoucherHeader"("status");

-- CreateIndex
CREATE INDEX "StoreVoucherHeader_transferRef_idx" ON "StoreVoucherHeader"("transferRef");

-- CreateIndex
CREATE INDEX "StoreVoucherDetails_txNo_idx" ON "StoreVoucherDetails"("txNo");

-- CreateIndex
CREATE INDEX "StoreVoucherDetails_productId_idx" ON "StoreVoucherDetails"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_storeId_idx" ON "StockMovement"("productId", "storeId");

-- CreateIndex
CREATE INDEX "StockMovement_ref_idx" ON "StockMovement"("ref");

-- CreateIndex
CREATE INDEX "StockBalance_storeId_idx" ON "StockBalance"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_productId_storeId_key" ON "StockBalance"("productId", "storeId");

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreVoucherHeader" ADD CONSTRAINT "StoreVoucherHeader_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreVoucherDetails" ADD CONSTRAINT "StoreVoucherDetails_txNo_fkey" FOREIGN KEY ("txNo") REFERENCES "StoreVoucherHeader"("txNo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreVoucherDetails" ADD CONSTRAINT "StoreVoucherDetails_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ref_fkey" FOREIGN KEY ("ref") REFERENCES "StoreVoucherHeader"("txNo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
