/**
 * Ben Memory Service - Sistema de Memória Dupla
 * 
 * Gerencia memória de conversa e memória geral consolidada do usuário
 */

import { prisma } from './prisma'
import { GoogleGenAI } from '@google/genai'

const MAX_METADATA_SIZE = 2048 // 2KB em bytes

/**
 * Avalia se uma conversa contém informações relevantes para memória
 * Retorna um score de relevância e decisão se deve registrar
 */
export async function shouldRegisterMemory(conversationId: string): Promise<{ shouldRegister: boolean; relevanceScore: number; reason: string }> {
  try {
    // Buscar conversa com últimas mensagens
    const conversation = await prisma.benConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10 // Últimas 10 mensagens para avaliação rápida
        }
      }
    })

    if (!conversation || conversation.messages.length < 2) {
      return { shouldRegister: false, relevanceScore: 0, reason: 'Conversa muito curta ou vazia' }
    }

    // Construir histórico recente
    const recentMessages = conversation.messages
      .reverse() // Voltar ordem cronológica
      .map(msg => `${msg.role === 'USER' ? 'Usuário' : 'Ben'}: ${msg.content}`)
      .join('\n\n')

    const prompt = `Analise esta conversa recente e determine se contém informações importantes sobre o usuário que devem ser registradas na memória permanente.

**CRITÉRIOS DE RELEVÂNCIA (em ordem de importância):**

1. **INFORMAÇÕES PESSOAIS DE INVESTIMENTO** (Score: 80-100)
   - Preferências de investimento (conservador, moderado, arrojado)
   - Perfil de risco explícito
   - Objetivos de investimento (curto, médio, longo prazo)
   - Mudanças de perfil ou preferências

2. **EMPRESAS DE INTERESSE** (Score: 60-80)
   - Tickers mencionados com contexto ou razão de interesse
   - Decisões sobre compra/venda
   - Análises solicitadas sobre empresas específicas
   - **REMOÇÃO DE INTERESSE** (Score: 70-90) - Se o usuário mencionar explicitamente que NÃO tem interesse em uma empresa (ex: "não tenho interesse em GNDI3"), isso é MUITO RELEVANTE e deve ser registrado

3. **APRENDIZADOS E DECISÕES** (Score: 40-60)
   - Aprendizados importantes mencionados
   - Decisões de investimento tomadas
   - Estratégias ou planos mencionados

4. **CONVERSA CASUAL OU PERGUNTAS GENÉRICAS** (Score: 0-30)
   - Perguntas simples sem contexto pessoal
   - Conversas muito curtas
   - Informações já conhecidas sem novidades

**HISTÓRICO RECENTE DA CONVERSA:**
${recentMessages}

**FORMATO DE RESPOSTA (JSON):**
{
  "shouldRegister": true ou false,
  "relevanceScore": 0-100,
  "reason": "Explicação breve do motivo da decisão",
  "keyTopics": ["tópico1", "tópico2"] // Tópicos principais identificados
}

**REGRAS:**
- Se relevanceScore >= 50, shouldRegister deve ser true
- Se relevanceScore < 50, shouldRegister deve ser false
- Seja conservador: só registre se realmente houver informação útil e nova
- Considere o contexto: conversas muito curtas ou genéricas não devem ser registradas

Retorne APENAS o JSON, sem nenhum texto adicional antes ou depois.`

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!
    })

    const model = 'gemini-2.5-flash-lite'
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    })

    // @ts-ignore - response.text pode não estar tipado
    const fullResponse = response.text || ''

    if (!fullResponse.trim()) {
      return { shouldRegister: false, relevanceScore: 0, reason: 'Resposta vazia do modelo' }
    }

    // Extrair JSON da resposta
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { shouldRegister: false, relevanceScore: 0, reason: 'Não foi possível extrair JSON' }
    }

    const evaluation = JSON.parse(jsonMatch[0])
    return {
      shouldRegister: evaluation.shouldRegister === true,
      relevanceScore: evaluation.relevanceScore || 0,
      reason: evaluation.reason || 'Avaliação realizada'
    }
  } catch (error) {
    console.error(`Erro ao avaliar se deve registrar memória para conversa ${conversationId}:`, error)
    // Em caso de erro, ser conservador e não registrar
    return { shouldRegister: false, relevanceScore: 0, reason: `Erro na avaliação: ${error instanceof Error ? error.message : 'Erro desconhecido'}` }
  }
}

/**
 * Extrai informações importantes de uma conversa usando Gemini
 */
export async function extractImportantInfo(conversationId: string) {
  try {
    // Buscar conversa completa com mensagens
    const conversation = await prisma.benConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!conversation || conversation.messages.length === 0) {
      return null
    }

    // Construir histórico da conversa
    const conversationHistory = conversation.messages.map(msg => 
      `${msg.role === 'USER' ? 'Usuário' : 'Ben'}: ${msg.content}`
    ).join('\n\n')

    const prompt = `Analise esta conversa e extraia informações importantes sobre o usuário que foram MENCIONADAS ou DEMONSTRADAS na conversa.

**PRINCÍPIO FUNDAMENTAL:**
- Extraia informações que o usuário MENCIONOU ou DEMONSTROU interesse
- NÃO invente empresas, preferências ou informações que não aparecem na conversa
- Se o usuário mencionou uma empresa (ex: "Cemig", "CMIG4", "quero investir na Cemig"), extraia
- Se o usuário apenas fez uma pergunta genérica (ex: "qual o valor justo de PETR4?"), NÃO extraia como interesse permanente

**CATEGORIAS DE INFORMAÇÃO:**

1. **PREFERÊNCIAS DE INVESTIMENTO:**
   - Extraia se o usuário mencionou explicitamente seu perfil (ex: "sou conservador", "prefiro moderado")
   - Extraia se o usuário demonstrou preferência através de escolhas ou comentários (ex: "gosto mais de ações defensivas")

2. **EMPRESAS DE INTERESSE:**
   - Extraia tickers que aparecem no texto (ex: "PETR4", "ITSA4", "VALE3", "CMIG4")
   - Extraia nomes de empresas mencionadas (ex: "Cemig", "Petrobras", "Vale")
   - Extraia se o usuário demonstrou interesse (ex: "quero investir em X", "estou pensando em comprar Y", "gosto da empresa Z")
   - NÃO extraia empresas que aparecem apenas em exemplos genéricos ou comparações sem contexto de interesse
   - NÃO invente empresas baseado em setores mencionados (ex: se mencionar "tech", não liste TSLA, NVDA a menos que tenham sido mencionados)

2.1. **REMOÇÃO DE INTERESSE EM EMPRESAS (CRÍTICO - SEMPRE VERIFICAR):**
   - **OBRIGATÓRIO**: Se o usuário mencionar explicitamente que NÃO tem interesse em uma empresa, SEMPRE extraia em "removedCompanies"
   - Frases que indicam remoção: "não tenho interesse em X", "não me interesso por Y", "remova Z da minha lista", "não quero mais acompanhar W", "não quero investir em X", "não gosto de Y", "não quero Y"
   - Identifique o ticker ou nome da empresa mencionada na mesma frase
   - Se o usuário diz "não tenho interesse em GNDI3", extraia: {"ticker": "GNDI3", "name": "NotreDame Intermédica", "context": "usuário mencionou que não tem interesse", "confidence": "ALTA"}
   - Marque confiança como "ALTA" se explícito (ex: "não tenho interesse"), "MEDIA" se inferido de forma clara
   - **IMPORTANTE**: Se houver uma empresa mencionada com "não tenho interesse", "não me interesso", "não quero", etc., ela DEVE aparecer em "removedCompanies", NUNCA em "companies"

3. **OBJETIVOS DE INVESTIMENTO:**
   - Extraia se o usuário mencionou objetivos (ex: "meu objetivo é longo prazo", "investo para aposentadoria")
   - Extraia se o usuário demonstrou horizonte temporal através de comentários

4. **PERFIL DE RISCO:**
   - Extraia se o usuário descreveu seu perfil ou tolerância ao risco
   - Extraia se o usuário demonstrou preferências que indicam perfil (ex: "não gosto de risco", "aceito mais risco")

5. **APRENDIZADOS IMPORTANTES:**
   - Extraia se o usuário mencionou que aprendeu algo (ex: "agora entendo que...", "aprendi que...")
   - Extraia insights importantes que o usuário demonstrou compreender

6. **DECISÕES OU INTENÇÕES:**
   - Extraia decisões explícitas (ex: "vou comprar X", "pretendo investir em Y")
   - Extraia intenções claras demonstradas (ex: "estou considerando investir em Z")

**DETECÇÃO DE MUDANÇAS:**
- Extraia mudanças se o usuário mencionou explicitamente que mudou algo
- Exemplo: "agora sou mais arrojado" (antes era conservador)
- Marque confiança como "ALTA" se explícito, "MEDIA" se inferido de forma clara

**LIMITE DE METADATA:**
- Mantenha o campo "metadata" conciso (máximo ~2KB quando serializado)
- Use apenas campos essenciais (ex: ticker, sector, dates)
- Evite arrays ou objetos muito grandes

**HISTÓRICO DA CONVERSA:**
${conversationHistory}

**FORMATO DE RESPOSTA (JSON):**
{
  "preferences": {
    "risk_profile": "conservador" // se mencionado
  },
  "companies": [
    {
      "ticker": "CMIG4",
      "name": "Cemig",
      "context": "usuário mencionou interesse em investir na Cemig"
    }
  ],
  "removedCompanies": [
    {
      "ticker": "GNDI3",
      "name": "NotreDame Intermédica",
      "context": "usuário mencionou que não tem interesse",
      "confidence": "ALTA"
    }
  ],
  "goals": {
    "time_horizon": "longo prazo" // se mencionado
  },
  "profile": {
    "risk_tolerance": "moderado" // se mencionado
  },
  "learnings": [
    "aprendizado mencionado pelo usuário"
  ],
  "decisions": [
    "decisão ou intenção mencionada"
  ],
  "changes": [
    {
      "category": "PREFERENCE",
      "key": "risk_profile",
      "oldValue": "conservador",
      "newValue": "arrojado",
      "confidence": "ALTA",
      "reason": "Usuário explicitamente mencionou mudança"
    }
  ]
}

**REGRAS IMPORTANTES:**
- Se o usuário mencionou uma empresa (nome ou ticker) com interesse, extraia como interesse
- Se o usuário mencionou explicitamente que NÃO tem interesse em uma empresa, extraia em "removedCompanies"
- Se o usuário apenas fez uma pergunta sobre uma empresa, NÃO extraia como interesse permanente
- Se não houver informações em uma categoria, retorne objeto vazio {} ou array vazio []
- Seja conservador: quando em dúvida, não extraia
- **CRÍTICO**: Se o usuário diz "não tenho interesse em X", isso DEVE aparecer em "removedCompanies", NUNCA em "companies"

**EXEMPLOS DE REMOÇÃO DE INTERESSE:**
- Usuário diz: "Não tenho interesse em GNDI3"
  → Resposta: {"removedCompanies": [{"ticker": "GNDI3", "name": "NotreDame Intermédica", "context": "usuário mencionou que não tem interesse", "confidence": "ALTA"}]}

- Usuário diz: "Não me interesso por Petrobras"
  → Resposta: {"removedCompanies": [{"ticker": "PETR4", "name": "Petrobras", "context": "usuário mencionou que não tem interesse", "confidence": "ALTA"}]}

- Usuário diz: "Remova VALE3 da minha lista"
  → Resposta: {"removedCompanies": [{"ticker": "VALE3", "name": "Vale", "context": "usuário pediu para remover da lista", "confidence": "ALTA"}]}

Retorne APENAS o JSON válido, sem nenhum texto adicional antes ou depois.`

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!
    })

    const model = 'gemini-2.5-flash-lite'
    const response = await ai.models.generateContentStream({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    })

    let fullResponse = ''
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text
      }
    }

    if (!fullResponse.trim()) {
      throw new Error('Resposta vazia do Gemini')
    }

    // Extrair JSON da resposta
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Não foi possível extrair JSON da resposta')
    }

    const extractedInfo = JSON.parse(jsonMatch[0])
    
    if (extractedInfo.removedCompanies && Array.isArray(extractedInfo.removedCompanies) && extractedInfo.removedCompanies.length > 0) {
      console.log(`[Memória] ✅ Remoções detectadas:`, extractedInfo.removedCompanies)
    }
    
    return extractedInfo
  } catch (error) {
    console.error(`Erro ao extrair informações da conversa ${conversationId}:`, error)
    return null
  }
}

/**
 * Trunca metadata se exceder o limite de tamanho
 */
function truncateMetadata(metadata: any, maxSize: number): any {
  const metadataStr = JSON.stringify(metadata)
  if (metadataStr.length <= maxSize) {
    return metadata
  }

  // Tentar remover campos menos importantes primeiro
  const truncated = { ...metadata }
  
  // Remover arrays grandes mantendo apenas primeiros itens
  for (const key in truncated) {
    if (Array.isArray(truncated[key]) && truncated[key].length > 5) {
      truncated[key] = truncated[key].slice(0, 5)
    }
  }

  // Se ainda exceder, remover campos opcionais
  const fieldsToRemove = ['description', 'notes', 'details', 'extra']
  for (const field of fieldsToRemove) {
    if (truncated[field]) {
      delete truncated[field]
      const newSize = JSON.stringify(truncated).length
      if (newSize <= maxSize) {
        break
      }
    }
  }

  const finalSize = JSON.stringify(truncated).length
  if (finalSize > maxSize) {
    console.warn(`Metadata ainda excede limite após truncamento: ${finalSize} > ${maxSize}`)
  }

  return truncated
}

/**
 * Remove uma empresa da memória quando o usuário expressa falta de interesse
 * @param userId ID do usuário
 * @param ticker Ticker ou nome da empresa
 * @param removedCompany Dados da empresa removida
 * @param conversationId ID da conversa de origem
 */
async function removeCompanyFromMemory(
  userId: string,
  ticker: string,
  removedCompany: any,
  conversationId?: string
) {
  try {
    console.log(`[Memória] 🔍 Iniciando remoção de empresa: ticker=${ticker}, userId=${userId}`)
    
    // Normalizar ticker para maiúsculas
    const normalizedTicker = ticker.toUpperCase().trim()
    console.log(`[Memória] Ticker normalizado: ${normalizedTicker}`)
    
    // Buscar memória existente da empresa na categoria COMPANIES
    // Pode estar armazenada com o ticker como key
    const existingMemory = await prisma.benMemory.findUnique({
      where: {
        userId_category_key: {
          userId,
          category: 'COMPANIES',
          key: normalizedTicker
        }
      }
    })
    
    console.log(`[Memória] Busca por key=${normalizedTicker}: ${existingMemory ? 'ENCONTRADA' : 'NÃO ENCONTRADA'}`)

    if (existingMemory) {
      // DELETAR FISICAMENTE o registro do banco (hard delete)
      await prisma.benMemory.delete({
        where: { id: existingMemory.id }
      })

      console.log(`[Memória] ✅ Empresa ${normalizedTicker} DELETADA fisicamente da memória do usuário ${userId}`)
    } else {
      // Se não encontrou pelo ticker, buscar todas as memórias de empresas e procurar por ticker ou nome
      // IMPORTANTE: Buscar TODAS incluindo removidas, pois precisamos encontrar para remover
      console.log(`[Memória] Buscando em todas as memórias de empresas...`)
      const memoriesByCategory = await prisma.benMemory.findMany({
        where: {
          userId,
          category: 'COMPANIES'
          // Não filtrar removidas aqui - precisamos encontrar a memória para removê-la
        }
      })

      console.log(`[Memória] Encontradas ${memoriesByCategory.length} memórias na categoria COMPANIES`)

      let found = false
      // Procurar por ticker ou nome no metadata, content ou key
      for (const memory of memoriesByCategory) {
        const metadata = memory.metadata as any
        const memoryKey = memory.key?.toUpperCase().trim()
        const memoryContent = memory.content?.toUpperCase() || ''
        
        // Verificar se a key corresponde ao ticker
        if (memoryKey === normalizedTicker) {
          console.log(`[Memória] ✅ Encontrada por key: ${memoryKey}`)
          found = true
        } else if (metadata) {
          const memoryTicker = metadata.ticker?.toUpperCase().trim()
          const memoryName = metadata.name?.toLowerCase().trim()
          const searchTicker = normalizedTicker
          const searchName = removedCompany.name?.toLowerCase().trim()

          // Verificar se há match por ticker ou nome no metadata
          if (
            (memoryTicker && memoryTicker === searchTicker) ||
            (memoryName && searchName && memoryName.includes(searchName)) ||
            (memoryName && searchName && searchName.includes(memoryName)) ||
            (memoryContent.includes(normalizedTicker))
          ) {
            console.log(`[Memória] ✅ Encontrada por metadata/content: ticker=${memoryTicker}, name=${memoryName}, key=${memoryKey}`)
            found = true
          }
        } else if (memoryContent.includes(normalizedTicker)) {
          console.log(`[Memória] ✅ Encontrada por content: ${memoryContent.substring(0, 100)}`)
          found = true
        }

        if (found) {
          // DELETAR FISICAMENTE o registro do banco (hard delete)
          await prisma.benMemory.delete({
            where: { id: memory.id }
          })

          console.log(`[Memória] ✅ Empresa ${normalizedTicker} DELETADA fisicamente da memória do usuário ${userId} (ID: ${memory.id})`)
          return
        }
      }

      if (!found) {
        console.warn(`[Memória] ⚠️ Empresa ${normalizedTicker} não encontrada na memória do usuário ${userId} para remoção`)
        console.log(`[Memória] Memórias disponíveis:`, memoriesByCategory.map(m => ({
          key: m.key,
          ticker: (m.metadata as any)?.ticker,
          name: (m.metadata as any)?.name
        })))
      }
    }
  } catch (error) {
    console.error(`Erro ao remover empresa ${ticker} da memória do usuário ${userId}:`, error)
  }
}

/**
 * Consolida memória extraída com memória existente
 * @param userId ID do usuário
 * @param extractedInfo Informações extraídas da conversa
 * @param conversationId ID da conversa de origem (para rastreabilidade)
 */
export async function consolidateMemory(userId: string, extractedInfo: any, conversationId?: string) {
  try {
    if (!extractedInfo) {
      return
    }

    // Processar mudanças detectadas (auto-correção)
    if (extractedInfo.changes && Array.isArray(extractedInfo.changes)) {
      for (const change of extractedInfo.changes) {
        // Buscar memória antiga
        const oldMemory = await prisma.benMemory.findUnique({
          where: {
            userId_category_key: {
              userId,
              category: change.category,
              key: change.key
            }
          }
        })

        if (oldMemory) {
          // Arquivar memória antiga
          const updatedMetadata = oldMemory.metadata as any || {}
          updatedMetadata.supersededBy = 'new_memory_id' // Será atualizado após criar nova
          updatedMetadata.reason = change.reason || 'user_preference_changed'
          updatedMetadata.supersededAt = new Date().toISOString()

          // Validar tamanho do metadata
          const validatedMetadata = truncateMetadata(updatedMetadata, MAX_METADATA_SIZE)

          await prisma.benMemory.update({
            where: { id: oldMemory.id },
            data: {
              importance: 20, // Baixa prioridade
              metadata: validatedMetadata
            }
          })

          // Criar/atualizar memória nova
          const newMetadata: any = {
            supersedes: oldMemory.id,
            ...(change.newValue && { value: change.newValue })
          }
          const validatedNewMetadata = truncateMetadata(newMetadata, MAX_METADATA_SIZE)

          // Buscar memória existente para preservar sourceConversationIds
          const existingNewMemory = await prisma.benMemory.findUnique({
            where: {
              userId_category_key: {
                userId,
                category: change.category,
                key: change.key
              }
            }
          })

          const newSourceIds = existingNewMemory?.sourceConversationIds || []
          const updatedNewSourceIds = conversationId && !newSourceIds.includes(conversationId)
            ? [...newSourceIds, conversationId]
            : newSourceIds

          await prisma.benMemory.upsert({
            where: {
              userId_category_key: {
                userId,
                category: change.category,
                key: change.key
              }
            },
            create: {
              userId,
              category: change.category,
              key: change.key,
              content: change.reason || `Mudança de ${change.oldValue} para ${change.newValue}`,
              metadata: validatedNewMetadata,
              importance: change.confidence === 'ALTA' ? 90 : 70,
              sourceConversationIds: conversationId ? [conversationId] : []
            },
            update: {
              content: change.reason || `Mudança de ${change.oldValue} para ${change.newValue}`,
              metadata: validatedNewMetadata,
              importance: change.confidence === 'ALTA' ? 90 : 70,
              sourceConversationIds: updatedNewSourceIds,
              updatedAt: new Date()
            }
          })

          // Atualizar referência na memória antiga
          await prisma.benMemory.update({
            where: { id: oldMemory.id },
            data: {
              metadata: {
                ...validatedMetadata,
                supersededBy: (await prisma.benMemory.findUnique({
                  where: {
                    userId_category_key: {
                      userId,
                      category: change.category,
                      key: change.key
                    }
                  }
                }))?.id
              }
            }
          })
        }
      }
    }

    // Processar remoções de empresas primeiro (antes de adicionar novas)
    if (extractedInfo.removedCompanies && Array.isArray(extractedInfo.removedCompanies)) {
      console.log(`[Memória] Processando ${extractedInfo.removedCompanies.length} remoção(ões) de empresas...`)
      for (const removedCompany of extractedInfo.removedCompanies) {
        const ticker = removedCompany.ticker || removedCompany.name
        if (ticker) {
          console.log(`[Memória] Removendo empresa: ${ticker}`, removedCompany)
          await removeCompanyFromMemory(userId, ticker, removedCompany, conversationId)
        } else {
          console.warn(`[Memória] ⚠️ Empresa removida sem ticker/nome:`, removedCompany)
        }
      }
    } else {
      console.log(`[Memória] Nenhuma remoção de empresa detectada em extractedInfo`)
    }

    // Processar outras informações extraídas
    const categories = ['preferences', 'companies', 'goals', 'profile', 'learnings', 'decisions']
    for (const category of categories) {
      if (extractedInfo[category]) {
        await processCategory(userId, category.toUpperCase(), extractedInfo[category], conversationId)
      }
    }
  } catch (error) {
    console.error(`Erro ao consolidar memória para usuário ${userId}:`, error)
  }
}

/**
 * Processa uma categoria de informações extraídas
 * @param userId ID do usuário
 * @param category Categoria da memória
 * @param data Dados da categoria
 * @param conversationId ID da conversa de origem (opcional)
 */
async function processCategory(userId: string, category: string, data: any, conversationId?: string) {
  if (typeof data === 'object' && !Array.isArray(data)) {
    // Objeto com múltiplas chaves
    for (const [key, value] of Object.entries(data)) {
      if (value) {
        const metadata: any = {}
        if (typeof value === 'object') {
          Object.assign(metadata, value)
        } else {
          metadata.value = value
        }

        const validatedMetadata = truncateMetadata(metadata, MAX_METADATA_SIZE)

        // Buscar memória existente para preservar sourceConversationIds
        const existingMemory = await prisma.benMemory.findUnique({
          where: {
            userId_category_key: {
              userId,
              category,
              key
            }
          }
        })

        const sourceIds = existingMemory?.sourceConversationIds || []
        const updatedSourceIds = conversationId && !sourceIds.includes(conversationId)
          ? [...sourceIds, conversationId]
          : sourceIds

        await prisma.benMemory.upsert({
          where: {
            userId_category_key: {
              userId,
              category,
              key
            }
          },
          create: {
            userId,
            category,
            key,
            content: typeof value === 'string' ? value : JSON.stringify(value),
            metadata: validatedMetadata,
            importance: 50,
            sourceConversationIds: conversationId ? [conversationId] : []
          },
          update: {
            content: typeof value === 'string' ? value : JSON.stringify(value),
            metadata: validatedMetadata,
            sourceConversationIds: updatedSourceIds,
            updatedAt: new Date()
          }
        })
      }
    }
  } else if (Array.isArray(data)) {
    // Array de itens
    for (const item of data) {
      if (item && typeof item === 'object') {
        const key = item.ticker || item.name || item.id || `item_${Date.now()}`
        const validatedMetadata = truncateMetadata(item, MAX_METADATA_SIZE)

        // Buscar memória existente para preservar sourceConversationIds
        const existingMemory = await prisma.benMemory.findUnique({
          where: {
            userId_category_key: {
              userId,
              category,
              key: String(key)
            }
          }
        })

        const sourceIds = existingMemory?.sourceConversationIds || []
        const updatedSourceIds = conversationId && !sourceIds.includes(conversationId)
          ? [...sourceIds, conversationId]
          : sourceIds

        await prisma.benMemory.upsert({
          where: {
            userId_category_key: {
              userId,
              category,
              key: String(key)
            }
          },
          create: {
            userId,
            category,
            key: String(key),
            content: item.summary || item.description || JSON.stringify(item),
            metadata: validatedMetadata,
            importance: 60,
            sourceConversationIds: conversationId ? [conversationId] : []
          },
          update: {
            content: item.summary || item.description || JSON.stringify(item),
            metadata: validatedMetadata,
            sourceConversationIds: updatedSourceIds,
            updatedAt: new Date()
          }
        })
      }
    }
  }
}

/**
 * Calcula score de relevância dinâmico para uma memória
 */
export function calculateRelevanceScore(
  memory: { importance: number; lastAccessed: Date | null; updatedAt: Date; metadata: any },
  contextUrl?: string
): number {
  const baseImportance = memory.importance

  // Decaimento temporal
  let temporalDecay = 1.0
  if (memory.lastAccessed) {
    const daysSinceAccess = (Date.now() - memory.lastAccessed.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceAccess > 90) {
      temporalDecay = 0.5
    } else if (daysSinceAccess > 30) {
      temporalDecay = 0.7
    }
  } else {
    // Nunca acessada, aplicar decaimento baseado em updatedAt
    const daysSinceUpdate = (Date.now() - memory.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceUpdate > 90) {
      temporalDecay = 0.5
    } else if (daysSinceUpdate > 30) {
      temporalDecay = 0.7
    }
  }

  // Boost contextual
  let contextBoost = 1.0
  if (contextUrl && memory.metadata) {
    const metadata = memory.metadata as any
    
    // Verificar match de ticker
    if (metadata.ticker && contextUrl.includes(`/${metadata.ticker}`)) {
      contextBoost = 1.2 // +20% boost
    }
    
    // Verificar match de setor
    if (metadata.sector && contextUrl.includes(metadata.sector.toLowerCase())) {
      contextBoost = Math.max(contextBoost, 1.1) // +10% boost
    }
  }

  return baseImportance * temporalDecay * contextBoost
}

/**
 * Obtém memória geral do usuário filtrada e ordenada
 */
export async function getUserMemory(userId: string, contextUrl?: string) {
  try {
    // Buscar todas as memórias do usuário
    const memories = await prisma.benMemory.findMany({
      where: { userId },
      orderBy: { importance: 'desc' }
    })

    // Calcular relevanceScore para cada memória
    const memoriesWithScore = memories.map(memory => ({
      ...memory,
      relevanceScore: calculateRelevanceScore(memory, contextUrl)
    }))

    // Ordenar por relevanceScore e limitar a top 20
    const topMemories = memoriesWithScore
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20)

    // Batch update de lastAccessed
    if (topMemories.length > 0) {
      const memoryIds = topMemories.map(m => m.id)
      await prisma.benMemory.updateMany({
        where: { id: { in: memoryIds } },
        data: { lastAccessed: new Date() }
      })
    }

    return topMemories
  } catch (error) {
    console.error(`Erro ao buscar memória do usuário ${userId}:`, error)
    return []
  }
}

/**
 * Constrói contexto de memória para incluir no system prompt
 */
export async function buildMemoryContext(userId: string, contextUrl?: string): Promise<string> {
  const memories = await getUserMemory(userId, contextUrl)

  if (memories.length === 0) {
    return 'Nenhuma memória anterior disponível.'
  }

  // Agrupar por categoria
  const byCategory: Record<string, typeof memories> = {}
  for (const memory of memories) {
    if (!byCategory[memory.category]) {
      byCategory[memory.category] = []
    }
    byCategory[memory.category].push(memory)
  }

  const sections: string[] = []
  for (const [category, categoryMemories] of Object.entries(byCategory)) {
    const items = categoryMemories.map(m => {
      const metadata = m.metadata as any
      const metadataStr = metadata ? ` (${JSON.stringify(metadata)})` : ''
      return `- ${m.key}: ${m.content}${metadataStr}`
    }).join('\n')
    sections.push(`${category}:\n${items}`)
  }

  return sections.join('\n\n')
}

