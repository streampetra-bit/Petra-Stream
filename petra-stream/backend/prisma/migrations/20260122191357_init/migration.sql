-- CreateTable
CREATE TABLE "ClipListing" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "nftContract" TEXT,
    "seller" TEXT NOT NULL,
    "buyer" TEXT,
    "price" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'listed',
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClipListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClipListing_marketplace_tokenId_key" ON "ClipListing"("marketplace", "tokenId");
