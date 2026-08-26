-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'CANCELLED', 'COMPLETED');

-- AlterTable: User.role TEXT → enum Role
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING "role"::"Role";

-- AlterTable: Reservation.status TEXT → enum ReservationStatus
ALTER TABLE "Reservation" ALTER COLUMN "status" TYPE "ReservationStatus" USING "status"::"ReservationStatus";

-- AlterTable: Product Float → Decimal(10,2)
ALTER TABLE "Product" ALTER COLUMN "priceDay" TYPE DECIMAL(10,2);
ALTER TABLE "Product" ALTER COLUMN "priceMonth" TYPE DECIMAL(10,2);
ALTER TABLE "Product" ALTER COLUMN "deposit" TYPE DECIMAL(10,2);

-- AlterTable: Add audit fields to Reservation
ALTER TABLE "Reservation" ADD COLUMN "cancellationConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN "paymentReceivedAt" TIMESTAMP(3);

-- CreateIndex: User
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");

-- CreateIndex: Product
CREATE INDEX "Product_ownerId_idx" ON "Product"("ownerId");
CREATE INDEX "Product_category_idx" ON "Product"("category");
CREATE INDEX "Product_city_idx" ON "Product"("city");
CREATE INDEX "Product_isDeleted_idx" ON "Product"("isDeleted");

-- CreateIndex: Reservation
CREATE INDEX "Reservation_userId_idx" ON "Reservation"("userId");
CREATE INDEX "Reservation_productId_idx" ON "Reservation"("productId");
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX "Reservation_dateInit_idx" ON "Reservation"("dateInit");
