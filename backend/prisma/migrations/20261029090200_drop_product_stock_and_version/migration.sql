-- Drop stock and version from Product
ALTER TABLE "Product" DROP COLUMN "stock";
ALTER TABLE "Product" DROP COLUMN "version";

-- Update check constraint on Product to remove stock and version
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_nonnegative";
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_nonnegative"
  CHECK ("price" >= 0);
