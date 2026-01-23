-- AlterTable
ALTER TABLE "Stream" ADD COLUMN "streamKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Stream_streamKey_key" ON "Stream"("streamKey");
