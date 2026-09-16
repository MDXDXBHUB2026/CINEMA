-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingRef" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showtimeId" TEXT NOT NULL,
    "holdId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotalCents" INTEGER NOT NULL,
    "feesCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_showtimeId_fkey" FOREIGN KEY ("showtimeId") REFERENCES "Showtime" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "SeatHold" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("bookingRef", "createdAt", "currency", "discountCents", "feesCents", "holdId", "id", "showtimeId", "status", "subtotalCents", "taxCents", "totalCents", "updatedAt", "userId") SELECT "bookingRef", "createdAt", "currency", "discountCents", "feesCents", "holdId", "id", "showtimeId", "status", "subtotalCents", "taxCents", "totalCents", "updatedAt", "userId" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE UNIQUE INDEX "Booking_bookingRef_key" ON "Booking"("bookingRef");
CREATE UNIQUE INDEX "Booking_holdId_key" ON "Booking"("holdId");
CREATE INDEX "Booking_userId_status_idx" ON "Booking"("userId", "status");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
