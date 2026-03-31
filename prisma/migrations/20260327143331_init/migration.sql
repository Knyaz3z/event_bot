/*
  Warnings:

  - You are about to drop the column `hostId` on the `Order` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "OrderHost" (
    "orderId" INTEGER NOT NULL,
    "hostId" INTEGER NOT NULL,

    PRIMARY KEY ("orderId", "hostId"),
    CONSTRAINT "OrderHost_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderHost_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "text" TEXT NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "date" TEXT,
    "time" TEXT,
    "address" TEXT,
    "price" TEXT,
    "people" TEXT,
    "comment" TEXT,
    "tariff" TEXT,
    "clientContact" TEXT,
    "totalCost" REAL,
    "remainingPayment" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Order" ("address", "clientContact", "comment", "createdAt", "date", "id", "people", "price", "remainingPayment", "status", "tariff", "text", "time", "totalCost") SELECT "address", "clientContact", "comment", "createdAt", "date", "id", "people", "price", "remainingPayment", "status", "tariff", "text", "time", "totalCost" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
