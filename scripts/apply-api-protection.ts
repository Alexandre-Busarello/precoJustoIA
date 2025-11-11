#!/usr/bin/env tsx
/**
 * SCRIPT PARA APLICAR PROTEÇÕES EM ROTAS DA API
 * 
 * Este script ajuda a identificar rotas que ainda não têm proteção
 * e facilita a aplicação manual quando necessário.
 * 
 * Uso:
 *   tsx scripts/apply-api-protection.ts --check    # Listar rotas sem proteção
 *   tsx scripts/apply-api-protection.ts --list    # Listar todas as rotas
 */

import { readdir, readFile, stat } from 'fs/promises'
import { join, relative } from 'path'

const API_ROUTES_DIR = join(process.cwd(), 'src/app/api')

interface RouteInfo {
  path: string
  file: string
  hasProtection: boolean
  methods: string[]
}

async function findRouteFiles(dir: string, basePath: string = ''): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = []
  
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const routePath = basePath ? `${basePath}/${entry.name}` : entry.name
      
      if (entry.isDirectory()) {
        // Recursivamente buscar em subdiretórios
        const subRoutes = await findRouteFiles(fullPath, routePath)
        routes.push(...subRoutes)
      } else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
        // Encontrou um arquivo de rota
        const content = await readFile(fullPath, 'utf-8')
        const hasProtection = checkHasProtection(content)
        const methods = extractMethods(content)
        
        routes.push({
          path: `/api/${routePath.replace('/route', '')}`,
          file: relative(process.cwd(), fullPath),
          hasProtection,
          methods
        })
      }
    }
  } catch (error) {
    // Ignorar erros de leitura
  }
  
  return routes
}

function checkHasProtection(content: string): boolean {
  // Verificar se usa algum dos helpers de proteção
  const protectionPatterns = [
    'protectGetRoute',
    'protectPostRoute',
    'protectPutRoute',
    'protectDeleteRoute',
    'withApiProtection',
    'withRateLimit',
    'applyGlobalApiProtection'
  ]
  
  return protectionPatterns.some(pattern => content.includes(pattern))
}

function extractMethods(content: string): string[] {
  const methods: string[] = []
  const methodPatterns = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  
  for (const method of methodPatterns) {
    // Procurar por export const METHOD ou export async function METHOD
    const patterns = [
      new RegExp(`export\\s+(const|async function)\\s+${method}`, 'i'),
      new RegExp(`export\\s+const\\s+${method}\\s*=`, 'i')
    ]
    
    if (patterns.some(pattern => pattern.test(content))) {
      methods.push(method)
    }
  }
  
  return methods
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || '--check'
  
  console.log('🔍 Buscando rotas da API...\n')
  
  const routes = await findRouteFiles(API_ROUTES_DIR)
  
  if (command === '--list') {
    console.log('📋 Todas as rotas da API:\n')
    routes.forEach(route => {
      const status = route.hasProtection ? '✅' : '⚠️'
      console.log(`${status} ${route.path}`)
      console.log(`   Arquivo: ${route.file}`)
      console.log(`   Métodos: ${route.methods.join(', ') || 'Nenhum'}`)
      console.log(`   Proteção: ${route.hasProtection ? 'SIM' : 'NÃO'}\n`)
    })
  } else if (command === '--check') {
    const unprotected = routes.filter(r => !r.hasProtection)
    
    if (unprotected.length === 0) {
      console.log('✅ Todas as rotas têm proteção!\n')
    } else {
      console.log(`⚠️  Encontradas ${unprotected.length} rotas sem proteção:\n`)
      unprotected.forEach(route => {
        console.log(`   ${route.path}`)
        console.log(`   Arquivo: ${route.file}`)
        console.log(`   Métodos: ${route.methods.join(', ') || 'Nenhum'}\n`)
      })
      
      console.log('\n💡 Dica: Use protectGetRoute/protectPostRoute para proteger essas rotas.')
      console.log('   Exemplo:')
      console.log('   ```typescript')
      console.log('   import { protectPostRoute } from "@/lib/api-protection"')
      console.log('   ')
      console.log('   export const POST = protectPostRoute(')
      console.log('     async (request: NextRequest) => {')
      console.log('       // Sua lógica aqui')
      console.log('     },')
      console.log('     { rateLimit: "API_GENERAL" }')
      console.log('   )')
      console.log('   ```\n')
    }
    
    const protectedRoutes = routes.filter(r => r.hasProtection)
    console.log(`\n📊 Estatísticas:`)
    console.log(`   Total de rotas: ${routes.length}`)
    console.log(`   Com proteção: ${protectedRoutes.length} ✅`)
    console.log(`   Sem proteção: ${unprotected.length} ${unprotected.length > 0 ? '⚠️' : '✅'}`)
  } else {
    console.log('Uso:')
    console.log('  tsx scripts/apply-api-protection.ts --check    # Verificar rotas sem proteção')
    console.log('  tsx scripts/apply-api-protection.ts --list      # Listar todas as rotas')
  }
}

main().catch(console.error)

