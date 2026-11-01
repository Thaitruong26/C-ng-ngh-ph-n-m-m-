-- CreateEnum
CREATE TYPE "IngredientUnit" AS ENUM ('G', 'ML', 'PCS');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ORDER_RESERVE', 'ORDER_RELEASE', 'RESTOCK', 'ADJUST');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "consumption" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "IngredientUnit" NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lowThreshold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");
CREATE INDEX "Ingredient_name_idx" ON "Ingredient"("name");

-- CreateTable
CREATE TABLE "ProductRecipe" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ProductRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecipe_productId_ingredientId_key" ON "ProductRecipe"("productId", "ingredientId");
CREATE INDEX "ProductRecipe_productId_idx" ON "ProductRecipe"("productId");
CREATE INDEX "ProductRecipe_ingredientId_idx" ON "ProductRecipe"("ingredientId");

-- CreateTable
CREATE TABLE "ToppingRecipe" (
    "id" SERIAL NOT NULL,
    "toppingId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ToppingRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ToppingRecipe_toppingId_ingredientId_key" ON "ToppingRecipe"("toppingId", "ingredientId");
CREATE INDEX "ToppingRecipe_toppingId_idx" ON "ToppingRecipe"("toppingId");
CREATE INDEX "ToppingRecipe_ingredientId_idx" ON "ToppingRecipe"("ingredientId");

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "orderId" INTEGER,
    "userId" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_ingredientId_createdAt_idx" ON "StockMovement"("ingredientId", "createdAt");
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- AddForeignKey
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "ProductRecipe_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToppingRecipe" ADD CONSTRAINT "ToppingRecipe_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "Topping"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToppingRecipe" ADD CONSTRAINT "ToppingRecipe_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Check constraints
ALTER TABLE "Ingredient"
  ADD CONSTRAINT "Ingredient_nonnegative"
  CHECK ("stock" >= 0 AND "version" >= 0 AND "lowThreshold" >= 0);

ALTER TABLE "ProductRecipe"
  ADD CONSTRAINT "ProductRecipe_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "ToppingRecipe"
  ADD CONSTRAINT "ToppingRecipe_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_quantity_nonzero"
  CHECK ("quantity" <> 0);
