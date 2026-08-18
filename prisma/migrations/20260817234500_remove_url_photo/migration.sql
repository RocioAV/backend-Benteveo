-- Back up existing urlPhoto values into PhotoProduct before dropping the column
INSERT INTO "PhotoProduct" ("id", "url", "publicId", "productId")
SELECT gen_random_uuid()::text, "urlPhoto", '', "id"
FROM "Product"
WHERE "urlPhoto" IS NOT NULL AND "urlPhoto" <> '';

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "urlPhoto";
