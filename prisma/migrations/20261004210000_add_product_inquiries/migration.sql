-- CreateTable
CREATE TABLE "ProductInquiry" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductInquiry_productId_requesterId_key" ON "ProductInquiry"("productId", "requesterId");

-- CreateIndex
CREATE INDEX "ProductInquiry_requesterId_updatedAt_idx" ON "ProductInquiry"("requesterId", "updatedAt");

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "reservationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "inquiryId" TEXT;

-- CreateIndex
CREATE INDEX "Message_inquiryId_createdAt_idx" ON "Message"("inquiryId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductInquiry" ADD CONSTRAINT "ProductInquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInquiry" ADD CONSTRAINT "ProductInquiry_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "ProductInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddConstraint
ALTER TABLE "Message"
ADD CONSTRAINT "Message_exactly_one_parent_check"
CHECK (("reservationId" IS NOT NULL AND "inquiryId" IS NULL) OR ("reservationId" IS NULL AND "inquiryId" IS NOT NULL));
