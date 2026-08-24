-- CreateTable
CREATE TABLE "PhotoProduct" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "PhotoProduct_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PhotoProduct" ADD CONSTRAINT "PhotoProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
