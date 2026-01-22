-- CreateTable
CREATE TABLE "ClipNft" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT,
    "contract" TEXT NOT NULL,
    "creatorAddress" TEXT NOT NULL,
    "creatorName" TEXT,
    "title" TEXT NOT NULL,
    "tokenUri" TEXT NOT NULL,
    "coverUrl" TEXT,
    "mediaUrl" TEXT,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipNft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClipNft_txHash_key" ON "ClipNft"("txHash");
