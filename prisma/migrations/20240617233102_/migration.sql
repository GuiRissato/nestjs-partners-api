/*
  Warnings:

  - You are about to drop the column `statis` on the `ReservationHistory` table. All the data in the column will be lost.
  - Added the required column `status` to the `ReservationHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ReservationHistory` DROP COLUMN `statis`,
    ADD COLUMN `status` ENUM('reserved', 'canceled') NOT NULL;
