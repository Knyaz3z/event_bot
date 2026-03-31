-- AlterTable
ALTER TABLE "Order" ADD COLUMN "address" TEXT;
ALTER TABLE "Order" ADD COLUMN "comment" TEXT;
ALTER TABLE "Order" ADD COLUMN "date" TEXT;
ALTER TABLE "Order" ADD COLUMN "people" TEXT;
ALTER TABLE "Order" ADD COLUMN "price" TEXT;
ALTER TABLE "Order" ADD COLUMN "time" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Host" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL DEFAULT 'Без имени',
    "telegramId" TEXT NOT NULL
);
INSERT INTO "new_Host" ("id", "name", "telegramId") SELECT "id", coalesce("name", 'Без имени') AS "name", "telegramId" FROM "Host";
DROP TABLE "Host";
ALTER TABLE "new_Host" RENAME TO "Host";
CREATE UNIQUE INDEX "Host_telegramId_key" ON "Host"("telegramId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
