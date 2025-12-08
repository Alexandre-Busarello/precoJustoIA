/**
 * Setup Script: IPJ-VALUE Index
 * 
 * Cria o índice IPJ-VALUE inicial com configuração padrão
 * e executa o primeiro screening para definir a composição inicial
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const IPJ_VALUE_CONFIG = {
  type: 'VALUE',
  universe: 'B3',
  assetTypes: ['STOCK'], // Apenas ações B3 (não inclui BDRs)
  excludedTickerPatterns: ['*5', '*6', '*RSUL3', '*RSUL4'], // Excluir tickers terminados em 5 e 6
  liquidity: {
    minAverageDailyVolume: 2000000 // R$ 2 milhões
  },
  filters: {
    requirePositiveUpside: true // Apenas empresas com upside positivo
  },
  quality: {
    roe: { gte: 0.10 }, // ROE >= 10%
    margemLiquida: { gte: 0.05 }, // Margem Líquida >= 5%
    dividaLiquidaEbitda: { lte: 3.0 }, // Dívida Líquida/EBITDA <= 3x
    marketCap: { gte: 1000000000 }, // Market Cap >= R$ 1 bilhão
    overallScore: { gte: 50 } // Score Geral >= 50
  },
  selection: {
    topN: 15,
    orderBy: 'upside',
    orderDirection: 'desc',
    scoreBands: [
      { min: 50, max: 69, maxCount: 4 }, // Máximo 3 ativos com score entre 50-69
      { min: 70, max: 100, maxCount: 11 } // Restante apenas acima de 70
    ]
  },
  weights: {
    type: 'overallScore', // Pesos proporcionais ao score geral
    minWeight: 0.03, // 3% mínimo
    maxWeight: 0.12 // 12% máximo
  },
  rebalance: {
    threshold: 0.05, // 5% de diferença de upside para trocar
    checkQuality: true
  },
  diversification: {
    type: 'maxCount',
    maxCountPerSector: {
      // Máximo 4 empresas por setor (aplicado a todos os setores)
      // Setores não especificados também terão limite de 4
    }
  }
};

async function setupIPJValue(forceRecreate: boolean = false) {
  try {
    console.log('🚀 Iniciando setup do IPJ-VALUE...');

    // 1. Verificar se o índice já existe
    const existing = await prisma.indexDefinition.findUnique({
      where: { ticker: 'IPJ-VALUE' },
      include: {
        composition: true,
        history: true
      }
    });

    if (existing) {
      if (forceRecreate) {
        console.log('🔄 Forçando recriação do índice IPJ-VALUE...');
        
        const indexId = existing.id;
        
        // Deletar composição existente
        await prisma.indexComposition.deleteMany({
          where: { indexId }
        });
        
        // Deletar histórico existente
        await prisma.indexHistoryPoints.deleteMany({
          where: { indexId }
        });
        
        // Deletar logs existentes
        await prisma.indexRebalanceLog.deleteMany({
          where: { indexId }
        });
        
        // Deletar checkpoints existentes (se houver)
        await prisma.indexCronCheckpoint.deleteMany({
          where: {
            jobType: { in: ['mark-to-market', 'screening'] },
            OR: [
              { indexId },
              { indexId: null } // Checkpoints globais também
            ]
          }
        }).catch(() => {
          // Ignorar erro se a tabela não existir ainda
        });
        
        // Deletar definição usando deleteMany para evitar erro se já foi deletado
        await prisma.indexDefinition.deleteMany({
          where: { id: indexId }
        });
        
        console.log('✅ Índice antigo removido. Criando novo...');
      } else {
        console.log('⚠️ Índice IPJ-VALUE já existe.');
        console.log(`   - ID: ${existing.id}`);
        console.log(`   - Composição: ${existing.composition.length} ativos`);
        console.log(`   - Histórico: ${existing.history.length} pontos`);
        console.log('\n💡 Para recriar o índice, execute:');
        console.log('   npx tsx scripts/setup-ipj-value.ts --force');
        return;
      }
    }

    // Verificar novamente se o índice não existe (evitar race condition)
    const stillExists = await prisma.indexDefinition.findUnique({
      where: { ticker: 'IPJ-VALUE' }
    });
    
    if (stillExists) {
      console.log('⚠️ Índice IPJ-VALUE ainda existe (possível race condition). Aguardando 1 segundo e tentando novamente...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const checkAgain = await prisma.indexDefinition.findUnique({
        where: { ticker: 'IPJ-VALUE' }
      });
      
      if (checkAgain) {
        console.log('⚠️ Índice ainda existe após espera. Pulando criação.');
        return;
      }
    }

    // 2. Criar definição do índice (com tratamento de erro para race condition)
    let indexDefinition;
    try {
      indexDefinition = await prisma.indexDefinition.create({
        data: {
          ticker: 'IPJ-VALUE',
        name: 'Índice Preço Justo Value',
        description: 'Carteira teórica de Deep Value Investing com travas de segurança. Seleciona as 15 empresas com maior upside que atendem critérios rigorosos de qualidade.',
        color: '#10b981', // Verde
        methodology: `**Metodologia IPJ-VALUE:**

1. **Universo**: Ações listadas na B3
2. **Liquidez**: Volume Médio Diário > R$ 2.000.000
3. **Qualidade (Travas de Segurança)**:
   - ROE > 10%
   - Margem Líquida > 5%
   - Dívida Líquida / EBITDA < 3x
   - Market Cap >= R$ 1 bilhão
   - Score Geral > 50
4. **Seleção**: 
   - Máximo 4 ativos com Score Geral entre 50-69
   - Restante apenas com Score Geral acima de 70
   - Ordenação por maior Upside (diferença entre Valor Justo calculado e Preço Atual)
5. **Diversificação**: Máximo 4 empresas do mesmo setor
6. **Pesos**: Proporcionais ao Score Geral (mínimo 3%, máximo 12% por ativo)
   - Ativos com maior score recebem maior peso na carteira
   - Distribuição automática baseada na qualidade fundamentalista
7. **Rebalanceamento**: Monitoramento diário. A troca ocorre apenas se:
   - Um ativo deixar de atender aos critérios de Qualidade
   - Um novo ativo surgir com Upside superior a 5% em relação ao 15º colocado

**Modelo de Cálculo**: Total Return com reinvestimento automático de dividendos. Os dividendos são detectados no ex-date e incorporados ao cálculo do retorno do índice, evitando penalizar carteiras pagadoras de dividendos.`,
          config: IPJ_VALUE_CONFIG
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('ticker')) {
        console.log('⚠️ Índice IPJ-VALUE já existe (race condition detectada). Buscando índice existente...');
        const existingIndex = await prisma.indexDefinition.findUnique({
          where: { ticker: 'IPJ-VALUE' }
        });
        if (existingIndex) {
          indexDefinition = existingIndex;
          console.log(`✅ Usando índice existente com ID: ${indexDefinition.id}`);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    console.log(`✅ Índice IPJ-VALUE criado/encontrado com ID: ${indexDefinition.id}`);

    // Verificar novamente se o índice realmente existe no banco antes de continuar
    const verifyIndex = await prisma.indexDefinition.findUnique({
      where: { id: indexDefinition.id },
      include: {
        composition: true
      }
    });

    if (!verifyIndex) {
      console.error('❌ Erro: Índice não encontrado no banco após criação. Possível race condition.');
      return;
    }

    // Usar o índice verificado do banco
    const indexDefinitionVerified = verifyIndex;

    // 3. Executar primeiro screening para definir composição inicial
    console.log('🔍 Executando primeiro screening...');
    const { runScreening, updateComposition } = await import('../src/lib/index-screening-engine');
    
    const idealComposition = await runScreening(indexDefinitionVerified);

    if (idealComposition.length === 0) {
      console.warn('⚠️ Nenhuma empresa encontrada no screening inicial. O índice será criado sem composição.');
      return;
    }

    // 4. Criar composição inicial com pesos proporcionais ao score
    const { getLatestPrices } = await import('../src/lib/quote-service');
    const tickers = idealComposition.map(c => c.ticker);
    const prices = await getLatestPrices(tickers);

    // Calcular pesos proporcionais ao score
    const minWeight = IPJ_VALUE_CONFIG.weights?.minWeight || 0.03;
    const maxWeight = IPJ_VALUE_CONFIG.weights?.maxWeight || 0.12;
    
    // Filtrar candidatos com score válido
    const candidatesWithScore = idealComposition.filter(c => c.overallScore !== null && c.overallScore !== undefined);
    const candidatesWithoutScore = idealComposition.filter(c => c.overallScore === null || c.overallScore === undefined);
    
    const weights = new Map<string, number>();
    
    if (candidatesWithScore.length > 0) {
      const totalScore = candidatesWithScore.reduce((sum, c) => sum + (c.overallScore || 0), 0);
      
      if (totalScore > 0) {
        // Calcular pesos proporcionais ao score
        let totalAssignedWeight = 0;
        const rawWeights = new Map<string, number>();
        
        for (const candidate of candidatesWithScore) {
          const score = candidate.overallScore || 0;
          const proportionalWeight = score / totalScore;
          const constrainedWeight = Math.max(minWeight, Math.min(maxWeight, proportionalWeight));
          rawWeights.set(candidate.ticker, constrainedWeight);
          totalAssignedWeight += constrainedWeight;
        }
        
        // Normalizar se necessário
        if (totalAssignedWeight > 1.0) {
          const normalizationFactor = 1.0 / totalAssignedWeight;
          rawWeights.forEach((weight, ticker) => {
            weights.set(ticker, weight * normalizationFactor);
          });
        } else {
          rawWeights.forEach((weight, ticker) => {
            weights.set(ticker, weight);
          });
          
          // Distribuir peso restante entre candidatos sem score
          const remainingWeight = 1.0 - totalAssignedWeight;
          const weightForNoScore = candidatesWithoutScore.length > 0 
            ? remainingWeight / candidatesWithoutScore.length 
            : 0;
          candidatesWithoutScore.forEach(c => {
            weights.set(c.ticker, weightForNoScore);
          });
        }
      } else {
        // Se todos os scores são 0, usar equal weight
        const equalWeight = 1.0 / idealComposition.length;
        idealComposition.forEach(c => weights.set(c.ticker, equalWeight));
      }
    } else {
      // Se nenhum tem score, usar equal weight
      const equalWeight = 1.0 / idealComposition.length;
      idealComposition.forEach(c => weights.set(c.ticker, equalWeight));
    }
    
    // Garantir normalização final
    const finalTotal = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
    if (Math.abs(finalTotal - 1.0) > 0.0001) {
      const normalizationFactor = 1.0 / finalTotal;
      weights.forEach((weight, ticker) => {
        weights.set(ticker, weight * normalizationFactor);
      });
    }

    const { getTodayInBrazil } = await import('../src/lib/market-status');
    const today = getTodayInBrazil();

    // Garantir que não há composição existente antes de criar (evitar constraint única)
    await prisma.indexComposition.deleteMany({
      where: { indexId: indexDefinitionVerified.id }
    });

    for (const candidate of idealComposition) {
      const priceData = prices.get(candidate.ticker);
      const entryPrice = priceData?.price || candidate.currentPrice;
      const targetWeight = weights.get(candidate.ticker) || (1.0 / idealComposition.length);

      // Usar upsert para evitar erro de constraint única (caso haja race condition)
      await prisma.indexComposition.upsert({
        where: {
          indexId_assetTicker: {
            indexId: indexDefinitionVerified.id,
            assetTicker: candidate.ticker
          }
        },
        update: {
          targetWeight,
          entryPrice,
          entryDate: today
        },
        create: {
          indexId: indexDefinitionVerified.id,
          assetTicker: candidate.ticker,
          targetWeight,
          entryPrice,
          entryDate: today
        }
      });
    }

    console.log(`✅ Composição inicial criada com ${idealComposition.length} ativos`);

    // 5. Criar primeiro ponto histórico (base 100)
    // Usar updateIndexPoints para garantir consistência e calcular DY médio
    const { updateIndexPoints } = await import('../src/lib/index-engine');
    const pointCreated = await updateIndexPoints(indexDefinitionVerified.id, today);
    
    if (pointCreated) {
      console.log(`✅ Primeiro ponto histórico criado (base 100)`);
    } else {
      console.warn(`⚠️ Não foi possível criar o primeiro ponto histórico`);
    }

    // 6. Criar log inicial
    await prisma.indexRebalanceLog.create({
      data: {
        indexId: indexDefinition.id,
        date: today,
        action: 'ENTRY',
        ticker: 'SETUP',
        reason: `Índice IPJ-VALUE criado com ${idealComposition.length} ativos selecionados pelo screening inicial`
      }
    });

    console.log('✅ Setup do IPJ-VALUE concluído com sucesso!');
    console.log(`\n📊 Resumo:`);
    console.log(`   - Ticker: IPJ-VALUE`);
    console.log(`   - Nome: ${indexDefinitionVerified.name}`);
    console.log(`   - Ativos: ${idealComposition.length}`);
    console.log(`   - Data de criação: ${today.toISOString().split('T')[0]}`);
    console.log(`\n🎯 Próximos passos:`);
    console.log(`   1. O cron job executará mark-to-market diariamente às 19:00h`);
    console.log(`   2. O cron job executará screening diariamente às 19:30h`);
    console.log(`   3. Acesse /indices/IPJ-VALUE para visualizar o índice`);

  } catch (error) {
    console.error('❌ Erro no setup do IPJ-VALUE:', error);
    throw error;
  } finally {
    // Não desconectar aqui, pois pode haver mais índices para criar
  }
}

const IPJ_MAGIC_CONFIG = {
  type: 'MAGIC_FORMULA',
  universe: 'B3',
  assetTypes: ['STOCK'], // Apenas ações B3 (não inclui BDRs)
     // Excluir tickers terminados em 5 e 6
  liquidity: {
    minAverageDailyVolume: 2000000 // R$ 2 milhões
  },
  filters: {
    requirePositiveUpside: true // Apenas empresas com upside positivo
  },
  quality: {
    overallScore: { gte: 65 }, // Score Geral >= 65
    marketCap: { gte: 1000000000 }, // Market Cap >= R$ 1 bilhão
    strategy: {
      type: 'magicFormula',
      params: {
        minROIC: 0.10, // ROIC mínimo de 10%
        minEY: 0.08,  // Earnings Yield mínimo de 8%
        limit: 50
      }
    }
  },
  selection: {
    topN: 20,
    orderBy: 'overallScore',
    orderDirection: 'desc'
  },
  weights: {
    type: 'equal',
    value: 1.0 / 15 // Equal weight
  },
  rebalance: {
    threshold: 0.05, // 5% de diferença para trocar
    checkQuality: true
  },
  diversification: {
    type: 'maxCount',
    maxCountPerSector: {
      // Máximo 4 empresas por setor (aplicado a todos os setores)
      // Setores não especificados também terão limite de 4
    }
  }
};

async function setupIPJMagic(forceRecreate: boolean = false) {
  try {
    console.log('🚀 Iniciando setup do IPJ-MAGIC...');

    // 1. Verificar se o índice já existe
    const existing = await prisma.indexDefinition.findUnique({
      where: { ticker: 'IPJ-MAGIC' },
      include: {
        composition: true,
        history: true
      }
    });

    if (existing) {
      if (forceRecreate) {
        console.log('🔄 Forçando recriação do índice IPJ-MAGIC...');
        
        const indexId = existing.id;
        
        // Deletar composição existente
        await prisma.indexComposition.deleteMany({
          where: { indexId }
        });
        
        // Deletar histórico existente
        await prisma.indexHistoryPoints.deleteMany({
          where: { indexId }
        });
        
        // Deletar logs existentes
        await prisma.indexRebalanceLog.deleteMany({
          where: { indexId }
        });
        
        // Deletar checkpoints existentes
        await prisma.indexCronCheckpoint.deleteMany({
          where: {
            jobType: { in: ['mark-to-market', 'screening'] },
            OR: [
              { indexId },
              { indexId: null } // Checkpoints globais também
            ]
          }
        }).catch(() => {
          // Ignorar erro se a tabela não existir ainda
        });
        
        // Deletar definição usando deleteMany para evitar erro se já foi deletado
        await prisma.indexDefinition.deleteMany({
          where: { id: indexId }
        });
        
        console.log('✅ Índice antigo removido. Criando novo...');
      } else {
        console.log('⚠️ Índice IPJ-MAGIC já existe.');
        console.log(`   - ID: ${existing.id}`);
        console.log(`   - Composição: ${existing.composition.length} ativos`);
        console.log(`   - Histórico: ${existing.history.length} pontos`);
        console.log('\n💡 Para recriar o índice, execute:');
        console.log('   npx tsx scripts/setup-ipj-value.ts --force');
        return;
      }
    }

    // Verificar novamente se o índice não existe (evitar race condition)
    const stillExistsMagic = await prisma.indexDefinition.findUnique({
      where: { ticker: 'IPJ-MAGIC' }
    });
    
    if (stillExistsMagic) {
      console.log('⚠️ Índice IPJ-MAGIC ainda existe (possível race condition). Aguardando 1 segundo e tentando novamente...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const checkAgain = await prisma.indexDefinition.findUnique({
        where: { ticker: 'IPJ-MAGIC' }
      });
      
      if (checkAgain) {
        console.log('⚠️ Índice ainda existe após espera. Pulando criação.');
        return;
      }
    }

    // 2. Criar definição do índice (com tratamento de erro para race condition)
    let indexDefinition;
    try {
      indexDefinition = await prisma.indexDefinition.create({
        data: {
          ticker: 'IPJ-MAGIC',
        name: 'Índice Preço Justo Magic Formula',
        description: 'Carteira teórica baseada na Fórmula Mágica de Joel Greenblatt. Seleciona as 15 empresas com melhor combinação de ROIC e Earnings Yield.',
        color: '#3b82f6', // Azul
        methodology: `**Metodologia IPJ-MAGIC:**

1. **Universo**: Ações listadas na B3
2. **Liquidez**: Volume Médio Diário > R$ 2.000.000
3. **Qualidade**:
   - Score Geral >= 65
4. **Estratégia**: Fórmula Mágica de Joel Greenblatt
   - ROIC mínimo de 10%
   - Earnings Yield mínimo de 8%
   - Ranking combinado de ROIC e Earnings Yield
5. **Seleção**: Top 20 empresas do ranking da Fórmula Mágica
6. **Diversificação**: Máximo 4 empresas do mesmo setor
7. **Pesos**: Equal Weight (6.67% para cada ativo)
8. **Rebalanceamento**: Monitoramento diário. A troca ocorre apenas se:
   - Um ativo deixar de atender aos critérios da Fórmula Mágica
   - Um novo ativo surgir com ranking superior

**Modelo de Cálculo**: Total Return com reinvestimento automático de dividendos. Os dividendos são detectados no ex-date e incorporados ao cálculo do retorno do índice, evitando penalizar carteiras pagadoras de dividendos.

**Sobre a Fórmula Mágica**: Desenvolvida por Joel Greenblatt, combina duas métricas fundamentais:
- **ROIC (Return on Invested Capital)**: Mede a eficiência do uso do capital
- **Earnings Yield**: Mede o retorno sobre o preço pago (inverso do P/L)

Empresas com alto ROIC e alto Earnings Yield tendem a ser boas oportunidades de investimento.`,
          config: IPJ_MAGIC_CONFIG
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('ticker')) {
        console.log('⚠️ Índice IPJ-MAGIC já existe (race condition detectada). Buscando índice existente...');
        const existingIndex = await prisma.indexDefinition.findUnique({
          where: { ticker: 'IPJ-MAGIC' }
        });
        if (existingIndex) {
          indexDefinition = existingIndex;
          console.log(`✅ Usando índice existente com ID: ${indexDefinition.id}`);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    console.log(`✅ Índice IPJ-MAGIC criado/encontrado com ID: ${indexDefinition.id}`);

    // Verificar novamente se o índice realmente existe no banco antes de continuar
    const verifyIndex = await prisma.indexDefinition.findUnique({
      where: { id: indexDefinition.id },
      include: {
        composition: true
      }
    });

    if (!verifyIndex) {
      console.error('❌ Erro: Índice não encontrado no banco após criação. Possível race condition.');
      return;
    }

    // Usar o índice verificado do banco
    const indexDefinitionVerified = verifyIndex;

    // 3. Executar primeiro screening para definir composição inicial
    console.log('🔍 Executando primeiro screening com Fórmula Mágica...');
    const { runScreening, updateComposition } = await import('../src/lib/index-screening-engine');
    
    const idealComposition = await runScreening(indexDefinitionVerified);

    if (idealComposition.length === 0) {
      console.warn('⚠️ Nenhuma empresa encontrada no screening inicial. O índice será criado sem composição.');
      return;
    }

    // 4. Criar composição inicial
    const { getLatestPrices } = await import('../src/lib/quote-service');
    const tickers = idealComposition.map(c => c.ticker);
    const prices = await getLatestPrices(tickers);

    const targetWeight = 1.0 / idealComposition.length;
    const { getTodayInBrazil } = await import('../src/lib/market-status');
    const today = getTodayInBrazil();

    // Criar mudanças iniciais (todas são ENTRY)
    const initialChanges = idealComposition.map(candidate => ({
      action: 'ENTRY' as const,
      ticker: candidate.ticker,
      reason: `Ativo selecionado pela Fórmula Mágica com ${candidate.upside !== null ? `${candidate.upside.toFixed(1)}% de upside` : 'critérios atendidos'}`
    }));

    await updateComposition(indexDefinitionVerified.id, idealComposition, initialChanges);

    console.log(`✅ Composição inicial criada com ${idealComposition.length} ativos`);

    // 5. Criar primeiro ponto histórico (base 100)
    // Usar updateIndexPoints para garantir consistência e calcular DY médio
    const { updateIndexPoints } = await import('../src/lib/index-engine');
    const pointCreated = await updateIndexPoints(indexDefinitionVerified.id, today);
    
    if (pointCreated) {
      console.log(`✅ Primeiro ponto histórico criado (base 100)`);
    } else {
      console.warn(`⚠️ Não foi possível criar o primeiro ponto histórico`);
    }

    // 6. Criar log inicial
    await prisma.indexRebalanceLog.create({
      data: {
        indexId: indexDefinitionVerified.id,
        date: today,
        action: 'ENTRY',
        ticker: 'SETUP',
        reason: `Índice IPJ-MAGIC criado com ${idealComposition.length} ativos selecionados pela Fórmula Mágica`
      }
    });

    console.log('✅ Setup do IPJ-MAGIC concluído com sucesso!');
    console.log(`\n📊 Resumo:`);
    console.log(`   - Ticker: IPJ-MAGIC`);
    console.log(`   - Nome: ${indexDefinitionVerified.name}`);
    console.log(`   - Ativos: ${idealComposition.length}`);
    console.log(`   - Data de criação: ${today.toISOString().split('T')[0]}`);
    console.log(`\n🎯 Próximos passos:`);
    console.log(`   1. O cron job executará mark-to-market diariamente às 19:00h`);
    console.log(`   2. O cron job executará screening diariamente às 19:30h`);
    console.log(`   3. Acesse /indices/IPJ-MAGIC para visualizar o índice`);

  } catch (error) {
    console.error('❌ Erro no setup do IPJ-MAGIC:', error);
    throw error;
  } finally {
    // Não desconectar aqui, pois pode haver mais índices para criar
  }
}

const IPJ_CRESCIMENTO_CONFIG = {
  type: 'GROWTH',
  universe: 'B3',
  assetTypes: ['STOCK'], // Apenas ações B3 (não inclui BDRs)
  excludedTickerPatterns: ['*5', '*6', '*RSUL3', '*RSUL4'], // Excluir tickers terminados em 5 e 6
  liquidity: {
    minAverageDailyVolume: 2000000 // R$ 2 milhões
  },
  filters: {
    requirePositiveUpside: true // Apenas empresas com upside positivo
  },
  quality: {
    roe: { gte: 0.1 }, // ROE >= 10%
    margemLiquida: { gte: 0.10 }, // Margem Líquida >= 10%
    dividaLiquidaEbitda: { lte: 2.0 }, // Dívida Líquida/EBITDA <= 2x
    payout: { lte: 0.40 }, // Payout <= 40%
    marketCap: { gte: 500000000 }, // Market Cap >= R$ 500 milhões
    overallScore: { gte: 60 } // Score Geral >= 70
  },
  selection: {
    topN: 15,
    orderBy: 'overallScore',
    orderDirection: 'desc'
  },
  weights: {
    type: 'overallScore', // Pesos proporcionais ao score geral
    minWeight: 0.04, // 4% mínimo
    maxWeight: 0.12 // 12% máximo
  },
  rebalance: {
    threshold: 0.05, // 5% de diferença para trocar
    checkQuality: true
  },
  diversification: {
    type: 'maxCount',
    maxCountPerSector: {
      // Máximo 2 empresas por setor (aplicado a todos os setores)
    }
  }
};

async function setupIPJCrescimento(forceRecreate: boolean = false) {
  try {
    console.log('🚀 Iniciando setup do IPJ-CRESCIMENTO...');

    // 1. Verificar se o índice já existe
    const existing = await prisma.indexDefinition.findUnique({
      where: { ticker: 'IPJ-CRESCIMENTO' },
      include: {
        composition: true,
        history: true
      }
    });

    if (existing) {
      if (forceRecreate) {
        console.log('🔄 Forçando recriação do índice IPJ-CRESCIMENTO...');
        
        const indexId = existing.id;
        
        // Deletar composição existente
        await prisma.indexComposition.deleteMany({
          where: { indexId }
        });
        
        // Deletar histórico existente
        await prisma.indexHistoryPoints.deleteMany({
          where: { indexId }
        });
        
        // Deletar logs existentes
        await prisma.indexRebalanceLog.deleteMany({
          where: { indexId }
        });
        
        // Deletar checkpoints existentes
        await prisma.indexCronCheckpoint.deleteMany({
          where: {
            jobType: { in: ['mark-to-market', 'screening'] },
            OR: [
              { indexId },
              { indexId: null } // Checkpoints globais também
            ]
          }
        }).catch(() => {
          // Ignorar erro se a tabela não existir ainda
        });
        
        // Deletar definição usando deleteMany para evitar erro se já foi deletado
        await prisma.indexDefinition.deleteMany({
          where: { id: indexId }
        });
        
        console.log('✅ Índice antigo removido. Criando novo...');
      } else {
        console.log('⚠️ Índice IPJ-CRESCIMENTO já existe.');
        console.log(`   - ID: ${existing.id}`);
        console.log(`   - Composição: ${existing.composition.length} ativos`);
        console.log(`   - Histórico: ${existing.history.length} pontos`);
        console.log('\n💡 Para recriar o índice, execute:');
        console.log('   npx tsx scripts/setup-ipj-value.ts --force');
        return;
      }
    }

    // Verificar novamente se o índice não existe (evitar race condition)
    const stillExists = await prisma.indexDefinition.findUnique({
      where: { ticker: 'IPJ-CRESCIMENTO' }
    });
    
    if (stillExists) {
      console.log('⚠️ Índice IPJ-CRESCIMENTO ainda existe (possível race condition). Aguardando 1 segundo e tentando novamente...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const checkAgain = await prisma.indexDefinition.findUnique({
          where: { ticker: 'IPJ-CRESCIMENTO' }
        });
      
      if (checkAgain) {
        console.log('⚠️ Índice ainda existe após espera. Pulando criação.');
        return;
      }
    }

    // 2. Criar definição do índice (com tratamento de erro para race condition)
    let indexDefinition;
    try {
      indexDefinition = await prisma.indexDefinition.create({
        data: {
          ticker: 'IPJ-CRESCIMENTO',
        name: 'Índice Preço Justo Crescimento',
        description: 'Carteira teórica focada em empresas de crescimento com payout baixo. Seleciona empresas de alta qualidade que reinvestem lucros para crescimento.',
        color: '#f59e0b', // Laranja/Amarelo
        methodology: `**Metodologia IPJ-CRESCIMENTO:**

1. **Universo**: Ações listadas na B3
2. **Liquidez**: Volume Médio Diário > R$ 2.000.000
3. **Qualidade (Travas de Segurança)**:
   - ROE >= 10%
   - Margem Líquida >= 10%
   - Dívida Líquida / EBITDA <= 2x
   - Payout <= 40% (empresas que reinvestem lucros)
   - Market Cap >= R$ 500 milhões
   - Score Geral >= 60
4. **Seleção**: Top 15 empresas ordenadas por Score Geral (maior qualidade primeiro)
5. **Diversificação**: Máximo 4 empresas do mesmo setor
6. **Pesos**: Proporcionais ao Score Geral (mínimo 4%, máximo 12% por ativo)
   - Empresas com maior score recebem maior peso na carteira
   - Distribuição automática baseada na qualidade fundamentalista
7. **Rebalanceamento**: Monitoramento diário. A troca ocorre apenas se:
   - Um ativo deixar de atender aos critérios de Qualidade
   - Um novo ativo surgir com Score superior a 5% em relação ao 15º colocado

**Modelo de Cálculo**: Total Return com reinvestimento automático de dividendos. Os dividendos são detectados no ex-date e incorporados ao cálculo do retorno do índice, evitando penalizar carteiras pagadoras de dividendos.

**Filosofia**: Empresas com payout baixo (< 30%) tendem a reinvestir mais lucros em crescimento, potencializando valorização futura. Este índice busca empresas de alta qualidade que priorizam crescimento sobre distribuição imediata de dividendos.`,
          config: IPJ_CRESCIMENTO_CONFIG
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('ticker')) {
        console.log('⚠️ Índice IPJ-CRESCIMENTO já existe (race condition detectada). Buscando índice existente...');
        const existingIndex = await prisma.indexDefinition.findUnique({
          where: { ticker: 'IPJ-CRESCIMENTO' }
        });
        if (existingIndex) {
          indexDefinition = existingIndex;
          console.log(`✅ Usando índice existente com ID: ${indexDefinition.id}`);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    console.log(`✅ Índice IPJ-CRESCIMENTO criado/encontrado com ID: ${indexDefinition.id}`);

    // Verificar novamente se o índice realmente existe no banco antes de continuar
    const verifyIndex = await prisma.indexDefinition.findUnique({
      where: { id: indexDefinition.id },
      include: {
        composition: true
      }
    });

    if (!verifyIndex) {
      console.error('❌ Erro: Índice não encontrado no banco após criação. Possível race condition.');
      return;
    }

    // Usar o índice verificado do banco
    const indexDefinitionVerified = verifyIndex;

    // 3. Executar primeiro screening para definir composição inicial
    console.log('🔍 Executando primeiro screening...');
    const { runScreening, updateComposition } = await import('../src/lib/index-screening-engine');
    
    const idealComposition = await runScreening(indexDefinitionVerified);

    if (idealComposition.length === 0) {
      console.warn('⚠️ Nenhuma empresa encontrada no screening inicial. O índice será criado sem composição.');
      return;
    }

    // 4. Criar composição inicial com pesos proporcionais ao score
    const { getLatestPrices } = await import('../src/lib/quote-service');
    const tickers = idealComposition.map(c => c.ticker);
    const prices = await getLatestPrices(tickers);

    // Calcular pesos proporcionais ao score
    const minWeight = IPJ_CRESCIMENTO_CONFIG.weights?.minWeight || 0.04;
    const maxWeight = IPJ_CRESCIMENTO_CONFIG.weights?.maxWeight || 0.12;
    
    // Filtrar candidatos com score válido
    const candidatesWithScore = idealComposition.filter(c => c.overallScore !== null && c.overallScore !== undefined);
    const candidatesWithoutScore = idealComposition.filter(c => c.overallScore === null || c.overallScore === undefined);
    
    const weights = new Map<string, number>();
    
    if (candidatesWithScore.length > 0) {
      const totalScore = candidatesWithScore.reduce((sum, c) => sum + (c.overallScore || 0), 0);
      
      if (totalScore > 0) {
        // Calcular pesos proporcionais ao score
        let totalAssignedWeight = 0;
        const rawWeights = new Map<string, number>();
        
        for (const candidate of candidatesWithScore) {
          const score = candidate.overallScore || 0;
          const proportionalWeight = score / totalScore;
          const constrainedWeight = Math.max(minWeight, Math.min(maxWeight, proportionalWeight));
          rawWeights.set(candidate.ticker, constrainedWeight);
          totalAssignedWeight += constrainedWeight;
        }
        
        // Normalizar se necessário
        if (totalAssignedWeight > 1.0) {
          const normalizationFactor = 1.0 / totalAssignedWeight;
          rawWeights.forEach((weight, ticker) => {
            weights.set(ticker, weight * normalizationFactor);
          });
        } else {
          rawWeights.forEach((weight, ticker) => {
            weights.set(ticker, weight);
          });
          
          // Distribuir peso restante entre candidatos sem score
          const remainingWeight = 1.0 - totalAssignedWeight;
          const weightForNoScore = candidatesWithoutScore.length > 0 
            ? remainingWeight / candidatesWithoutScore.length 
            : 0;
          candidatesWithoutScore.forEach(c => {
            weights.set(c.ticker, weightForNoScore);
          });
        }
      } else {
        // Se todos os scores são 0, usar equal weight
        const equalWeight = 1.0 / idealComposition.length;
        idealComposition.forEach(c => weights.set(c.ticker, equalWeight));
      }
    } else {
      // Se nenhum tem score, usar equal weight
      const equalWeight = 1.0 / idealComposition.length;
      idealComposition.forEach(c => weights.set(c.ticker, equalWeight));
    }
    
    // Garantir normalização final
    const finalTotal = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
    if (Math.abs(finalTotal - 1.0) > 0.0001) {
      const normalizationFactor = 1.0 / finalTotal;
      weights.forEach((weight, ticker) => {
        weights.set(ticker, weight * normalizationFactor);
      });
    }

    const { getTodayInBrazil } = await import('../src/lib/market-status');
    const today = getTodayInBrazil();

    // Criar mudanças iniciais (todas são ENTRY)
    const initialChanges = idealComposition.map(candidate => ({
      action: 'ENTRY' as const,
      ticker: candidate.ticker,
      reason: `Ativo selecionado por crescimento com payout baixo (Score: ${candidate.overallScore?.toFixed(1) || 'N/A'})`
    }));

    await updateComposition(indexDefinitionVerified.id, idealComposition, initialChanges);

    console.log(`✅ Composição inicial criada com ${idealComposition.length} ativos`);

    // 5. Criar primeiro ponto histórico (base 100)
    // Usar updateIndexPoints para garantir consistência e calcular DY médio
    const { updateIndexPoints } = await import('../src/lib/index-engine');
    const pointCreated = await updateIndexPoints(indexDefinitionVerified.id, today);
    
    if (pointCreated) {
      console.log(`✅ Primeiro ponto histórico criado (base 100)`);
    } else {
      console.warn(`⚠️ Não foi possível criar o primeiro ponto histórico`);
    }

    // 6. Criar log inicial
    await prisma.indexRebalanceLog.create({
      data: {
        indexId: indexDefinitionVerified.id,
        date: today,
        action: 'ENTRY',
        ticker: 'SETUP',
        reason: `Índice IPJ-CRESCIMENTO criado com ${idealComposition.length} ativos selecionados pelo screening inicial`
      }
    });

    console.log('✅ Setup do IPJ-CRESCIMENTO concluído com sucesso!');
    console.log(`\n📊 Resumo:`);
    console.log(`   - Ticker: IPJ-CRESCIMENTO`);
    console.log(`   - Nome: ${indexDefinitionVerified.name}`);
    console.log(`   - Ativos: ${idealComposition.length}`);
    console.log(`   - Data de criação: ${today.toISOString().split('T')[0]}`);
    console.log(`\n🎯 Próximos passos:`);
    console.log(`   1. O cron job executará mark-to-market diariamente às 19:00h`);
    console.log(`   2. O cron job executará screening diariamente às 19:30h`);
    console.log(`   3. Acesse /indices/IPJ-CRESCIMENTO para visualizar o índice`);

  } catch (error) {
    console.error('❌ Erro no setup do IPJ-CRESCIMENTO:', error);
    throw error;
  } finally {
    // Não desconectar aqui, pois pode haver mais índices para criar
  }
}

const IPJ_TECNICO_CONFIG = {
  type: 'TECHNICAL',
  universe: 'B3',
  assetTypes: ['STOCK'], // Apenas ações B3 (não inclui BDRs)
  excludedTickerPatterns: ['*5', '*6', '*RSUL3', '*RSUL4'], // Excluir tickers terminados em 5 e 6
  liquidity: {
    minAverageDailyVolume: 2000000 // R$ 2 milhões
  },
  quality: {
    overallScore: { gte: 50 } // Score Geral >= 50
  },
  filters: {
    requirePositiveUpside: true, // Apenas empresas com upside positivo
    technicalFairValue: {
      enabled: true,
      requireBelowFairPrice: true, // Preço atual <= preço justo técnico
      requireAboveMinPrice: true // Preço atual >= preço mínimo técnico
    }
  },
  selection: {
    topN: 15,
    orderBy: 'technicalMargin',
    orderDirection: 'asc' // Asc porque margem negativa é melhor (preço mais abaixo do justo)
  },
  weights: {
    type: 'equal',
    value: 1.0 / 15 // Equal weight
  },
  rebalance: {
    threshold: 0.05, // 5% de diferença para trocar
    checkQuality: true
  },
  diversification: {
    type: 'maxCount',
    maxCountPerSector: {
      // Máximo 4 empresas por setor (aplicado a todos os setores)
    }
  }
};

async function setupIPJTecnico(forceRecreate: boolean = false) {
  try {
    console.log('🚀 Iniciando setup do IPJ-TECNICO...');

    // 1. Verificar se o índice já existe
    const existing = await prisma.indexDefinition.findUnique({
      where: { ticker: 'IPJ-TECNICO' },
      include: {
        composition: true,
        history: true
      }
    });

    if (existing) {
      if (forceRecreate) {
        console.log('🔄 Forçando recriação do índice IPJ-TECNICO...');
        
        const indexId = existing.id;
        
        // Deletar composição existente
        await prisma.indexComposition.deleteMany({
          where: { indexId }
        });
        
        // Deletar histórico existente
        await prisma.indexHistoryPoints.deleteMany({
          where: { indexId }
        });
        
        // Deletar logs existentes
        await prisma.indexRebalanceLog.deleteMany({
          where: { indexId }
        });
        
        // Deletar checkpoints existentes
        await prisma.indexCronCheckpoint.deleteMany({
          where: {
            jobType: { in: ['mark-to-market', 'screening'] },
            OR: [
              { indexId },
              { indexId: null } // Checkpoints globais também
            ]
          }
        }).catch(() => {
          // Ignorar erro se a tabela não existir ainda
        });
        
        // Deletar definição usando deleteMany para evitar erro se já foi deletado
        await prisma.indexDefinition.deleteMany({
          where: { id: indexId }
        });
        
        console.log('✅ Índice antigo removido. Criando novo...');
      } else {
        console.log('⚠️ Índice IPJ-TECNICO já existe.');
        console.log(`   - ID: ${existing.id}`);
        console.log(`   - Composição: ${existing.composition.length} ativos`);
        console.log(`   - Histórico: ${existing.history.length} pontos`);
        console.log('\n💡 Para recriar o índice, execute:');
        console.log('   npx tsx scripts/setup-ipj-value.ts --force');
        return;
      }
    }

    // Verificar novamente se o índice não existe (evitar race condition)
    const stillExists = await prisma.indexDefinition.findUnique({
      where: { ticker: 'IPJ-TECNICO' }
    });
    
    if (stillExists) {
      console.log('⚠️ Índice IPJ-TECNICO ainda existe (possível race condition). Aguardando 1 segundo e tentando novamente...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const checkAgain = await prisma.indexDefinition.findUnique({
        where: { ticker: 'IPJ-TECNICO' }
      });
      
      if (checkAgain) {
        console.log('⚠️ Índice ainda existe após espera. Pulando criação.');
        return;
      }
    }

    // 2. Criar definição do índice (com tratamento de erro para race condition)
    let indexDefinition;
    try {
      indexDefinition = await prisma.indexDefinition.create({
        data: {
          ticker: 'IPJ-TECNICO',
          name: 'Índice Preço Justo Técnico',
          description: 'Carteira teórica baseada em análise técnica com IA. Seleciona empresas com score > 50 que estão abaixo do preço justo técnico e dentro da faixa mínima, ordenadas por melhor margem técnica.',
          color: '#8b5cf6', // Roxo
          methodology: `**Metodologia IPJ-TECNICO:**

1. **Universo**: Ações listadas na B3
2. **Liquidez**: Volume Médio Diário > R$ 2.000.000
3. **Qualidade**:
   - Score Geral >= 50
   - Upside positivo (valor justo > preço atual)
4. **Análise Técnica (IA)**:
   - Preço atual <= Preço Justo Técnico (aiFairEntryPrice)
   - Preço atual >= Preço Mínimo Técnico (aiMinPrice)
   - Ordenação por margem técnica (diferença percentual entre preço atual e preço justo técnico)
5. **Seleção**: Top 15 empresas com melhor margem técnica (maior desconto em relação ao preço justo técnico)
6. **Diversificação**: Máximo 4 empresas do mesmo setor
7. **Pesos**: Equal Weight (6.67% para cada ativo)
8. **Rebalanceamento**: Monitoramento diário. A troca ocorre apenas se:
   - Um ativo deixar de atender aos critérios de qualidade ou análise técnica
   - Um novo ativo surgir com margem técnica melhor

**Modelo de Cálculo**: Total Return com reinvestimento automático de dividendos. Os dividendos são detectados no ex-date e incorporados ao cálculo do retorno do índice, evitando penalizar carteiras pagadoras de dividendos.

**Sobre a Análise Técnica com IA**: Utiliza análise técnica avançada combinada com inteligência artificial para calcular preços justos de entrada. A margem técnica indica o desconto percentual do preço atual em relação ao preço justo técnico calculado pela IA. Valores mais negativos indicam maior oportunidade de entrada.`,
          config: IPJ_TECNICO_CONFIG
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('ticker')) {
        console.log('⚠️ Índice IPJ-TECNICO já existe (race condition detectada). Buscando índice existente...');
        const existingIndex = await prisma.indexDefinition.findUnique({
          where: { ticker: 'IPJ-TECNICO' }
        });
        if (existingIndex) {
          indexDefinition = existingIndex;
          console.log(`✅ Usando índice existente com ID: ${indexDefinition.id}`);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    console.log(`✅ Índice IPJ-TECNICO criado/encontrado com ID: ${indexDefinition.id}`);

    // Verificar novamente se o índice realmente existe no banco antes de continuar
    const verifyIndex = await prisma.indexDefinition.findUnique({
      where: { id: indexDefinition.id },
      include: {
        composition: true
      }
    });

    if (!verifyIndex) {
      console.error('❌ Erro: Índice não encontrado no banco após criação. Possível race condition.');
      return;
    }

    // Usar o índice verificado do banco
    const indexDefinitionVerified = verifyIndex;

    // 3. Executar primeiro screening para definir composição inicial
    console.log('🔍 Executando primeiro screening com análise técnica...');
    const { runScreening, updateComposition } = await import('../src/lib/index-screening-engine');
    
    const idealComposition = await runScreening(indexDefinitionVerified);

    if (idealComposition.length === 0) {
      console.warn('⚠️ Nenhuma empresa encontrada no screening inicial. O índice será criado sem composição.');
      return;
    }

    // 4. Criar composição inicial
    const { getLatestPrices } = await import('../src/lib/quote-service');
    const tickers = idealComposition.map(c => c.ticker);
    const prices = await getLatestPrices(tickers);

    const targetWeight = 1.0 / idealComposition.length;
    const { getTodayInBrazil } = await import('../src/lib/market-status');
    const today = getTodayInBrazil();

    // Criar mudanças iniciais (todas são ENTRY)
    const initialChanges = idealComposition.map(candidate => ({
      action: 'ENTRY' as const,
      ticker: candidate.ticker,
      reason: `Ativo selecionado por análise técnica com margem técnica de ${candidate.technicalMargin !== null ? `${candidate.technicalMargin.toFixed(1)}%` : 'N/A'}`
    }));

    await updateComposition(indexDefinitionVerified.id, idealComposition, initialChanges);

    console.log(`✅ Composição inicial criada com ${idealComposition.length} ativos`);

    // 5. Criar primeiro ponto histórico (base 100)
    // Usar updateIndexPoints para garantir consistência e calcular DY médio
    const { updateIndexPoints } = await import('../src/lib/index-engine');
    const pointCreated = await updateIndexPoints(indexDefinitionVerified.id, today);
    
    if (pointCreated) {
      console.log(`✅ Primeiro ponto histórico criado (base 100)`);
    } else {
      console.warn(`⚠️ Não foi possível criar o primeiro ponto histórico`);
    }

    // 6. Criar log inicial
    await prisma.indexRebalanceLog.create({
      data: {
        indexId: indexDefinitionVerified.id,
        date: today,
        action: 'ENTRY',
        ticker: 'SETUP',
        reason: `Índice IPJ-TECNICO criado com ${idealComposition.length} ativos selecionados por análise técnica`
      }
    });

    console.log('✅ Setup do IPJ-TECNICO concluído com sucesso!');
    console.log(`\n📊 Resumo:`);
    console.log(`   - Ticker: IPJ-TECNICO`);
    console.log(`   - Nome: ${indexDefinitionVerified.name}`);
    console.log(`   - Ativos: ${idealComposition.length}`);
    console.log(`   - Data de criação: ${today.toISOString().split('T')[0]}`);
    console.log(`\n🎯 Próximos passos:`);
    console.log(`   1. O cron job executará mark-to-market diariamente às 19:00h`);
    console.log(`   2. O cron job executará screening diariamente às 19:30h`);
    console.log(`   3. Acesse /indices/IPJ-TECNICO para visualizar o índice`);

  } catch (error) {
    console.error('❌ Erro no setup do IPJ-TECNICO:', error);
    throw error;
  } finally {
    // Não desconectar aqui, pois pode haver mais índices para criar
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const args = process.argv.slice(2);
  const forceRecreate = args.includes('--force') || args.includes('-f');
  
  // Executar sequencialmente para evitar condições de corrida
  (async () => {
    try {
      await setupIPJValue(forceRecreate);
      await setupIPJMagic(forceRecreate);
      await setupIPJCrescimento(forceRecreate);
      await setupIPJTecnico(forceRecreate);
      console.log('\n✅ Script concluído - Todos os índices criados!');
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error('❌ Erro fatal:', error);
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    }
  })();
}

export { setupIPJValue, setupIPJMagic, setupIPJCrescimento, setupIPJTecnico };

