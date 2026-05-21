import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.partner.upsert({
    where: { slug: 'clube-dos-dividendos' },
    update: {},
    create: {
      slug: 'clube-dos-dividendos',
      name: 'Clube dos Dividendos',
      lpUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://precojusto.ai'}/parceiros/clube-dos-dividendos`,
      // Substituir pela URL real do Cakto com split configurado
      checkoutUrl: process.env.CAKTO_PARTNER_CLUBE_DOS_DIVIDENDOS_URL ?? 'https://pay.cakto.com.br/SUBSTITUIR_PELA_URL_REAL',
    },
  })

  console.log('✅ Parceiro clube-dos-dividendos inserido/atualizado')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
