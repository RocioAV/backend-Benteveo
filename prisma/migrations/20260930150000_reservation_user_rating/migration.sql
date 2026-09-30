-- CreateTable
CREATE TABLE "UserRating" (
    "id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reservationId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "ratedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRating_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserRating_score_check" CHECK ("score" BETWEEN 1 AND 5)
);

-- CreateIndex
CREATE INDEX "UserRating_ratedUserId_idx" ON "UserRating"("ratedUserId");

-- CreateIndex
CREATE INDEX "UserRating_reservationId_idx" ON "UserRating"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRating_reservationId_raterId_key" ON "UserRating"("reservationId", "raterId");

-- AddForeignKey
ALTER TABLE "UserRating" ADD CONSTRAINT "UserRating_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRating" ADD CONSTRAINT "UserRating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRating" ADD CONSTRAINT "UserRating_ratedUserId_fkey" FOREIGN KEY ("ratedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
