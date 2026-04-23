-- AlterTable
ALTER TABLE "fii_data" ADD COLUMN "cotacao" DECIMAL(15,4),
ADD COLUMN "ffo_yield" DECIMAL(10,6),
ADD COLUMN "pvp" DECIMAL(10,4),
ADD COLUMN "valor_mercado" DECIMAL(20,2),
ADD COLUMN "liquidez" DECIMAL(20,2),
ADD COLUMN "qtd_imoveis" INTEGER,
ADD COLUMN "preco_m2" DECIMAL(15,4),
ADD COLUMN "aluguel_m2" DECIMAL(15,4),
ADD COLUMN "cap_rate" DECIMAL(10,6),
ADD COLUMN "vacancia_media" DECIMAL(10,6),
ADD COLUMN "segment" TEXT,
ADD COLUMN "is_papel" BOOLEAN DEFAULT false,
ADD COLUMN "data_source" TEXT DEFAULT 'fundamentus',
ADD COLUMN "last_fetched_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "fii_data_segment_idx" ON "fii_data"("segment");

-- CreateIndex
CREATE INDEX "fii_data_is_papel_idx" ON "fii_data"("is_papel");
