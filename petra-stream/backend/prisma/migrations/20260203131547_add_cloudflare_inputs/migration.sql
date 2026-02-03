/*
  Warnings:

  - A unique constraint covering the columns `[cloudflareScreenInputId]` on the table `Stream` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cloudflareCameraInputId]` on the table `Stream` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Stream" ADD COLUMN     "cloudflareCameraInputId" TEXT,
ADD COLUMN     "cloudflareCameraPublishUrl" TEXT,
ADD COLUMN     "cloudflareCameraRtmpsKey" TEXT,
ADD COLUMN     "cloudflareCameraRtmpsUrl" TEXT,
ADD COLUMN     "cloudflareCustomerCode" TEXT,
ADD COLUMN     "cloudflareScreenInputId" TEXT,
ADD COLUMN     "cloudflareScreenPublishUrl" TEXT,
ADD COLUMN     "cloudflareScreenRtmpsKey" TEXT,
ADD COLUMN     "cloudflareScreenRtmpsUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Stream_cloudflareScreenInputId_key" ON "Stream"("cloudflareScreenInputId");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_cloudflareCameraInputId_key" ON "Stream"("cloudflareCameraInputId");
