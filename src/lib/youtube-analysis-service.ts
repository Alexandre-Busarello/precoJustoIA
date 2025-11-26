import { prisma } from '@/lib/prisma';
import { safeWrite, safeQueryWithParams } from '@/lib/prisma-wrapper';
import { GoogleGenAI } from '@google/genai';

/**
 * Serviço de Análise de Vídeos do YouTube
 * 
 * Busca vídeos mais recentes de empresas no YouTube e analisa o conteúdo
 * usando Gemini AI com Google Search capability.
 */

export interface YouTubeVideoSearchResult {
  videoIds: string[];
  reason?: string;
}

export interface YouTubeAnalysisResult {
  score: number; // 0-100
  summary: string;
  positivePoints: string[];
  negativePoints: string[];
}

export interface WebContentAnalysisResult {
  score: number; // 0-100
  summary: string;
  positivePoints: string[];
  negativePoints: string[];
  sources: string[]; // URLs das fontes utilizadas
}

export interface SavedYouTubeAnalysis {
  id: string;
  companyId: number;
  score: number;
  summary: string;
  positivePoints: string[] | null;
  negativePoints: string[] | null;
  videoIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class YouTubeAnalysisService {
  /**
   * Busca IDs dos vídeos mais recentes sobre uma empresa no YouTube
   * Usa a API interna do YouTube diretamente
   */
  static async searchYouTubeVideos(
    ticker: string,
    companyName: string,
    sector?: string | null,
    industry?: string | null
  ): Promise<string[]> {
    try {
      console.log(`🔍 Buscando vídeos do YouTube para ${ticker} via API...`);
      
      // Construir query de busca
      const searchQuery = ticker;
      
      // Chamar API do YouTube
      const response = await fetch(
        `https://www.youtube.com/youtubei/v1/search?prettyPrint=false`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20241210.01.00',
                hl: 'pt',
                gl: 'BR',
              },
            },
            query: searchQuery,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extrair IDs dos vídeos da resposta
      const videoIds = this.extractVideoIds(data, ticker, companyName);
      
      if (videoIds.length === 0) {
        console.log(`⚠️ ${ticker}: Nenhum vídeo encontrado que atenda aos critérios`);
      } else {
        console.log(`✅ ${videoIds.length} vídeo(s) encontrado(s) para ${ticker}`);
      }
      
      return videoIds.slice(0, 2); // Max 2 videos
    } catch (error) {
      console.error(`❌ Erro ao buscar vídeos para ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Converte o texto de publicação (ex: "há 1 hora", "há 3 dias") em número de dias
   */
  private static parsePublishedTime(publishedTimeText: string): number {
    if (!publishedTimeText) return 999999; // Se não tiver data, considerar muito antigo
    
    const text = publishedTimeText.toLowerCase();
    
    // Extrair número e unidade
    const match = text.match(/(\d+)\s*(hora|dia|semana|mês|meses|ano)/);
    if (!match) return 999999;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    // Converter para dias
    switch (unit) {
      case 'hora':
        return value / 24;
      case 'dia':
        return value;
      case 'semana':
        return value * 7;
      case 'mês':
      case 'meses':
        return value * 30;
      case 'ano':
        return value * 365;
      default:
        return 999999;
    }
  }

  /**
   * Extrai IDs de vídeos da resposta da API do YouTube
   * PRIORIZA vídeos mais recentes (máximo 6 meses)
   */
  private static extractVideoIds(data: any, ticker: string, companyName: string): string[] {
    const MAX_AGE_DAYS = 180; // 6 meses
    const candidateVideos: { videoId: string; ageDays: number; title: string; channel: string }[] = [];
    
    try {
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      
      if (!contents || !Array.isArray(contents)) {
        console.log(`⚠️ Estrutura de resposta inesperada do YouTube`);
        return [];
      }
      
      for (const section of contents) {
        const items = section?.itemSectionRenderer?.contents;
        if (!items || !Array.isArray(items)) continue;
        
        for (const item of items) {
          // Verificar se é um vídeo (não anúncio, não playlist, etc.)
          if (item.videoRenderer) {
            const videoId = item.videoRenderer.videoId;
            const title = item.videoRenderer.title?.runs?.[0]?.text || '';
            const channel = item.videoRenderer.longBylineText?.runs?.[0]?.text || '';
            const lengthText = item.videoRenderer.lengthText?.simpleText || '';
            const publishedTimeText = item.videoRenderer.publishedTimeText?.simpleText || '';
            
            // Calcular idade do vídeo em dias
            const ageDays = this.parsePublishedTime(publishedTimeText);
            
            console.log(`🎥 Avaliando: ${title} (${channel}) - ${lengthText} - ${publishedTimeText} (${ageDays.toFixed(1)} dias)`);
            
            // Filtro de idade: rejeitar vídeos muito antigos (> 6 meses)
            if (ageDays > MAX_AGE_DAYS) {
              console.log(`   ⏳ Vídeo muito antigo (${ageDays.toFixed(0)} dias > ${MAX_AGE_DAYS} dias)`);
              continue;
            }
            
            // Aplicar outros filtros
            if (this.isValidVideo(videoId, title, channel, lengthText, ticker, companyName)) {
              console.log(`   ✅ Vídeo aprovado - adicionando aos candidatos`);
              candidateVideos.push({ videoId, ageDays, title, channel });
            } else {
              console.log(`   ❌ Vídeo rejeitado pelos filtros`);
            }
          }
        }
      }
      
      // Ordenar por idade (mais recentes primeiro)
      candidateVideos.sort((a, b) => a.ageDays - b.ageDays);
      
      // Log dos vídeos selecionados
      console.log(`\n📊 Vídeos candidatos ordenados por recência:`);
      candidateVideos.slice(0, 2).forEach((video, index) => {
        console.log(`   ${index + 1}. ${video.title} (${video.channel}) - ${video.ageDays.toFixed(1)} dias atrás`);
      });
      
      // Retornar os 2 vídeos mais recentes
      return candidateVideos.slice(0, 2).map(v => v.videoId);
      
    } catch (error) {
      console.error(`❌ Erro ao extrair IDs de vídeos:`, error);
    }
    
    return [];
  }

  /**
   * Valida se um vídeo atende aos critérios
   */
  private static isValidVideo(
    videoId: string,
    title: string,
    channel: string,
    lengthText: string,
    ticker: string,
    companyName: string
  ): boolean {
    // Verificar se videoId existe
    if (!videoId) {
      console.log(`      ❌ Sem videoId`);
      return false;
    }
    
    // Verificar duração (< 30 minutos)
    if (!this.isDurationValid(lengthText)) {
      console.log(`      ❌ Duração inválida: ${lengthText}`);
      return false;
    }
    
    // Verificar se título é relevante
    if (!this.isTitleRelevant(title, ticker, companyName)) {
      console.log(`      ❌ Título não relevante`);
      return false;
    }
    
    // Verificar se canal é reconhecido
    if (!this.isChannelRecognized(channel)) {
      console.log(`      ❌ Canal não reconhecido: ${channel}`);
      return false;
    }
    
    return true;
  }

  /**
   * Valida duração do vídeo (deve ser < 30 minutos)
   */
  private static isDurationValid(lengthText: string): boolean {
    if (!lengthText) return false;
    
    // Parse duration like "2:28", "15:43", "1:02:30"
    const parts = lengthText.split(':').map(p => parseInt(p, 10));
    
    if (parts.length === 2) {
      // MM:SS format
      const minutes = parts[0];
      return minutes < 30;
    } else if (parts.length === 3) {
      // HH:MM:SS format
      const hours = parts[0];
      const minutes = parts[1];
      const totalMinutes = hours * 60 + minutes;
      return totalMinutes < 30;
    }
    
    return false;
  }

  /**
   * Verifica se o título é relevante para a empresa
   */
  private static isTitleRelevant(title: string, ticker: string, companyName: string): boolean {
    const titleLower = title.toLowerCase();
    const tickerLower = ticker.toLowerCase();
    
    // Verificar se ticker está no título
    return titleLower.includes(tickerLower);
  }

  /**
   * Verifica se o canal é reconhecido/confiável
   */
  private static isChannelRecognized(channel: string): boolean {
    const recognizedChannels = [
      'clube do valor',
      'nord research',
      'suno research',
      'infomoney',
      'investidor sardinha',
      'me poupe',
      'o primo rico',
      'investidor raiz',
      'economista sincero',
      'eqi investimentos',
      'xp investimentos',
      'mirai investing',
      'neto invest',
      'hamu invest',
      'valueinvesting',
      'investimento em ação',
      'thiago nigro',
      'favelado investidor',
      'raul sena',
      'bruno perini',
      'cruno chimarelli',
      'tiago reis',
      'ativo virtual',
      'kako invest',
      'investindo com estratégia',
      'dividendos em foco',
      'dividendos em ação',
      'engenheiro e investidor',
      'felipe eduardo',
      'método de investimento',
      'market makers',
      'clube dos dividendos',
      'louise e barsi dividendos '
    ];
    
    const channelLower = channel.toLowerCase();
    
    return recognizedChannels.some(recognized => 
      channelLower.includes(recognized) || recognized.includes(channelLower)
    );
  }

  /**
   * Analisa os vídeos do YouTube e extrai insights
   */
  static async analyzeVideos(
    videoIds: string[],
    ticker: string,
    companyName: string
  ): Promise<YouTubeAnalysisResult> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    if (!videoIds || videoIds.length === 0) {
      throw new Error('Nenhum vídeo para analisar');
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });

      const prompt = `Você é um analista fundamentalista especializado em ações brasileiras.

Data Atual: ${new Date().toLocaleDateString()}

Assista ao(s) vídeo(s) fornecido(s) sobre a empresa ${companyName} (${ticker}) e realize uma análise fundamentalista do conteúdo.

**IMPORTANTE SOBRE OS VÍDEOS:**
- Você receberá de 1 a 2 vídeos curtos (máximo 30 minutos cada)
- São vídeos de canais especializados e confiáveis
- Foque nas informações fundamentalistas apresentadas
- Você deve avaliar se for fazer citação da datas no resumo, pontos positivos e/ou negativos, avalie se eles ainda são relevantes para a data atual (Ex: dividendos que ja foram pagos não são mais pontos positivos)
- Você deve garantir que sua resposta esteja em Português Brasileiro

**⚠️ CRÍTICO - FOCO EXCLUSIVO NA EMPRESA:**
- Extraia informações APENAS sobre ${companyName} (${ticker})
- Se o vídeo mencionar múltiplas empresas (ex: carteiras, comparações, rankings), IGNORE informações de outras empresas
- NÃO inclua dados, métricas ou análises de PETR3, PETR4, VALE3, ITUB4, BBDC4, CXSE3 ou QUALQUER outro ticker que NÃO seja ${ticker}
- Se o vídeo não tiver informações suficientes ESPECIFICAMENTE sobre ${ticker}, retorne score 50 com resumo indicando "Informações insuficientes sobre ${ticker} no vídeo"
- VERIFICAÇÃO: Antes de adicionar qualquer ponto positivo ou negativo, confirme que ele se refere ESPECIFICAMENTE a ${ticker}, não a outras empresas mencionadas no vídeo

**Sua análise deve incluir:**

1. **Score Geral (0-100)**: Avalie o sentimento geral sobre a empresa baseado no conteúdo dos vídeos:
   - 0-30: Sentimento muito negativo (problemas graves, recomendação de venda)
   - 31-50: Sentimento negativo (preocupações, cautela)
   - 51-70: Sentimento neutro ou misto (pontos positivos e negativos equilibrados)
   - 71-85: Sentimento positivo (bons fundamentos, otimismo)
   - 86-100: Sentimento muito positivo (excelentes perspectivas, forte recomendação)

2. **Resumo**: Descrição concisa (máximo 280 caracteres) dos pontos-chave discutidos nos vídeos SOBRE ${ticker}
   - Seja direto e objetivo
   - Foque no que é mais relevante para investidores
   - Mencione APENAS ${ticker}, não outras empresas

3. **Pontos Positivos**: Lista de aspectos favoráveis mencionados ESPECIFICAMENTE sobre ${ticker}
   - Máximo 4 pontos mais relevantes
   - Seja específico e factual
   - Priorize dados concretos (números, fatos)
   - Cada ponto deve mencionar ${ticker} ou ser claramente sobre ${ticker}

4. **Pontos Negativos**: Lista de preocupações ou riscos mencionados ESPECIFICAMENTE sobre ${ticker}
   - Máximo 4 pontos mais relevantes
   - Seja específico e factual
   - Priorize riscos reais e tangíveis
   - Cada ponto deve mencionar ${ticker} ou ser claramente sobre ${ticker}

**DIRETRIZES DE ANÁLISE:**
- Baseie sua análise APENAS no conteúdo dos vídeos E APENAS sobre ${ticker}
- Seja objetivo e imparcial
- Priorize informações fundamentalistas (resultados, dividendos, dívida, crescimento, margens)
- Ignore ruídos, especulações sem fundamento e opiniões pessoais dos apresentadores
- Se os vídeos mencionarem dados conflitantes, use o mais recente ou confiável
- Evite jargões excessivos - use linguagem clara
- NUNCA misture informações de outras empresas mencionadas no vídeo

Formato da resposta (JSON válido):
{
  "score": 75,
  "summary": "Empresa apresentou resultados sólidos no trimestre com crescimento de receita de 15% e redução de dívida.",
  "positivePoints": [
    "Crescimento de receita de 15% no último trimestre",
    "Redução da dívida líquida em 20%",
    "Aumento de dividendos aprovado para 2024"
  ],
  "negativePoints": [
    "Margem EBITDA em queda de 2 pontos percentuais",
    "Preocupações com cenário macroeconômico e juros altos"
  ]
}

Retorne APENAS o JSON, sem nenhum texto adicional antes ou depois.`;

      const tools = [
        {
          googleSearch: {},
        },
      ];

      const config = {
        thinkingConfig: {
          thinkingBudget: -1,
        },
        tools,
      };

      const model = 'gemini-2.5-flash-lite';
      
      // Construir parts com os vídeos
      const parts: any[] = [];
      
      // Adicionar vídeos como fileData
      videoIds.forEach((videoId) => {
        parts.push({
          fileData: {
            fileUri: `https://www.youtube.com/watch?v=${videoId}`,
            mimeType: 'video/*',
          },
        });
      });
      
      // Adicionar prompt
      parts.push({ text: prompt });

      const contents = [
        {
          role: 'user',
          parts,
        },
      ];

      console.log(`🎬 Analisando ${videoIds.length} vídeo(s) para ${ticker}...`);

      const response = await ai.models.generateContentStream({
        model,
        config,
        contents,
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      if (!fullResponse || fullResponse.trim().length === 0) {
        throw new Error('Gemini retornou resposta vazia');
      }

      console.log(`📊 Resposta da análise recebida (${fullResponse.length} caracteres)`);
      console.log(`📝 Preview: ${fullResponse.substring(0, 150)}...`);

      // Extrair JSON da resposta
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Resposta da análise não contém JSON válido');
      }

      const parsedResult: YouTubeAnalysisResult = JSON.parse(jsonMatch[0]);

      // Validar resultado
      if (
        typeof parsedResult.score !== 'number' ||
        parsedResult.score < 0 ||
        parsedResult.score > 100
      ) {
        throw new Error('Score inválido na resposta da análise');
      }

      if (!parsedResult.summary || typeof parsedResult.summary !== 'string') {
        throw new Error('Summary inválido na resposta da análise');
      }

      // Garantir que positivePoints e negativePoints são arrays (mesmo que vazios)
      parsedResult.positivePoints = Array.isArray(parsedResult.positivePoints)
        ? parsedResult.positivePoints
        : [];
      parsedResult.negativePoints = Array.isArray(parsedResult.negativePoints)
        ? parsedResult.negativePoints
        : [];

      // Validar se a análise é válida antes de retornar
      if (!this.isValidAnalysis(parsedResult)) {
        console.error(`❌ ${ticker}: Análise retornada pelo Gemini é inválida:`);
        console.error(`   Summary: "${parsedResult.summary}"`);
        console.error(`   Pontos positivos: ${parsedResult.positivePoints.length}`);
        console.error(`   Pontos negativos: ${parsedResult.negativePoints.length}`);
        throw new Error('Análise retornada pelo Gemini não atende aos critérios de validação (summary inválido ou sem pontos positivos/negativos)');
      }

      console.log(`✅ Análise concluída para ${ticker}: Score ${parsedResult.score}/100`);

      return parsedResult;
    } catch (error: any) {
      console.error(`❌ Erro ao analisar vídeos para ${ticker}:`, error);
      
      // Tratamento específico para erro de muitos frames (vídeo muito longo)
      if (error?.message?.includes('Please use fewer than') || 
          error?.message?.includes('images in your request') ||
          error?.code === 400) {
        console.error(`🎥 ${ticker}: Vídeo(s) muito longo(s) (excede limite de frames da API)`);
        throw new Error(`Vídeo muito longo - excede limite de processamento da API. Tente vídeos mais curtos.`);
      }
      
      // Erro genérico
      throw error;
    }
  }

  /**
   * Busca e analisa conteúdo web sobre a empresa (alternativa/complemento ao YouTube)
   */
  static async analyzeWebContent(
    ticker: string,
    companyName: string,
    sector?: string,
    industry?: string
  ): Promise<WebContentAnalysisResult> {
    try {
      console.log(`🌐 ${ticker}: Analisando conteúdo web (blogs, notícias, portais)...`);

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });

      const prompt = `Você é um analista fundamentalista especializado em ações brasileiras.

Busque e analise informações recentes (últimos 3-6 meses) sobre a empresa ${companyName} (${ticker}) em fontes confiáveis da internet:

**FONTES PRIORITÁRIAS (focar apenas em fontes profissionais):**
- InfoMoney, Valor Econômico, Estadão E-Investidor
- Blogs: Clube do Valor, Nord Research, Suno Research
- Sites especializados: TradeMap, Investidor10, Status Invest
- Portais: Bloomberg Brasil, Reuters Brasil
- Relatórios e comunicados oficiais da empresa
${sector ? `- Análises específicas do setor: ${sector}` : ''}
${industry ? `- Notícias da indústria: ${industry}` : ''}

**CRITÉRIOS DE BUSCA:**
1. Priorizar análises fundamentalistas profissionais
2. Focar em notícias e análises dos últimos 3-6 meses
3. Buscar informações sobre:
   - Resultados trimestrais/anuais recentes
   - Projeções e guidance
   - Dividendos e proventos
   - Eventos corporativos relevantes
   - Análises de analistas profissionais
   - Notícias materiais que impactam a empresa
4. Evitar fontes não confiáveis, fóruns, redes sociais
5. Desconsiderar análises técnicas (gráficos, suportes, resistências)

**IMPORTANTE:**
- Se não encontrar informações relevantes ou a empresa não tiver cobertura adequada, retorne score 50 (neutro) e explique no summary
- Cite as principais fontes utilizadas
- Seja objetivo e baseie-se apenas em fatos

**Sua análise deve incluir:**

1. **Score Geral (0-100)**: Baseado no sentimento consolidado das fontes
   - 0-30: Muito negativo (problemas graves, recomendações de venda)
   - 31-50: Negativo (preocupações, cautela)
   - 51-70: Neutro ou misto (equilíbrio de pontos)
   - 71-85: Positivo (bons fundamentos, otimismo)
   - 86-100: Muito positivo (excelentes perspectivas)

2. **Resumo** (máximo 280 caracteres):
   - Consolidação objetiva dos principais pontos encontrados
   - Foque no que é mais relevante para investidores

3. **Pontos Positivos** (máximo 4):
   - Aspectos favoráveis mencionados nas fontes
   - Seja específico e factual
   - Priorize dados concretos

4. **Pontos Negativos** (máximo 4):
   - Preocupações ou riscos mencionados
   - Seja específico e factual
   - Priorize riscos reais

5. **Fontes** (máximo 5 URLs):
   - URLs das principais fontes utilizadas
   - Priorize fontes mais relevantes e recentes

**DIRETRIZES:**
- Seja objetivo e imparcial
- Priorize informações fundamentalistas
- Ignore especulações e rumores
- Use informações recentes (3-6 meses)
- Se houver conflito de informações, use a fonte mais confiável

Formato da resposta (JSON válido):
{
  "score": 72,
  "summary": "Empresa reportou crescimento de receita no último trimestre, mas margem EBITDA em queda preocupa analistas.",
  "positivePoints": [
    "Crescimento de receita de 12% no trimestre",
    "Redução da dívida líquida em 15%",
    "Dividendos aprovados acima do esperado"
  ],
  "negativePoints": [
    "Margem EBITDA caiu 3 p.p. no período",
    "Cenário macroeconômico desafiador"
  ],
  "sources": [
    "https://www.infomoney.com.br/...",
    "https://www.clubedovalor.com.br/...",
    "https://ri.empresa.com.br/..."
  ]
}

Retorne APENAS o JSON, sem nenhum texto adicional antes ou depois.`;

      const tools = [
        {
          googleSearch: {},
        },
      ];

      const config = {
        thinkingConfig: {
          thinkingBudget: -1,
        },
        tools,
      };

      const model = 'gemini-2.5-flash-lite';

      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      const response = await ai.models.generateContentStream({
        model,
        config,
        contents,
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      if (!fullResponse || fullResponse.trim().length === 0) {
        throw new Error('Gemini retornou resposta vazia para análise web');
      }

      console.log(`📊 Resposta da análise web recebida (${fullResponse.length} caracteres)`);

      // Extrair JSON da resposta
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Resposta da análise web não contém JSON válido');
      }

      const parsedResult: WebContentAnalysisResult = JSON.parse(jsonMatch[0]);

      // Validar campos obrigatórios
      if (
        typeof parsedResult.score !== 'number' ||
        !parsedResult.summary ||
        !Array.isArray(parsedResult.positivePoints) ||
        !Array.isArray(parsedResult.negativePoints) ||
        !Array.isArray(parsedResult.sources)
      ) {
        throw new Error('Resposta da análise web tem formato inválido');
      }

      // Garantir que arrays não sejam null
      parsedResult.positivePoints = Array.isArray(parsedResult.positivePoints)
        ? parsedResult.positivePoints
        : [];
      parsedResult.negativePoints = Array.isArray(parsedResult.negativePoints)
        ? parsedResult.negativePoints
        : [];
      parsedResult.sources = Array.isArray(parsedResult.sources)
        ? parsedResult.sources
        : [];

      console.log(
        `✅ Análise web concluída para ${ticker}: Score ${parsedResult.score}/100, ${parsedResult.sources.length} fonte(s)`
      );

      return parsedResult;
    } catch (error: any) {
      console.error(`❌ Erro ao analisar conteúdo web para ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Combina análise do YouTube com análise web para resultado mais completo
   */
  static combineAnalyses(
    youtubeAnalysis: YouTubeAnalysisResult,
    webAnalysis: WebContentAnalysisResult,
    ticker: string
  ): YouTubeAnalysisResult {
    console.log(`🔗 ${ticker}: Combinando análise YouTube + Web...`);

    // Score combinado: 70% YouTube + 30% Web
    const combinedScore = Math.round(
      youtubeAnalysis.score * 0.7 + webAnalysis.score * 0.3
    );

    // Summary combinado (prioriza YouTube, complementa com web se houver divergência significativa)
    let combinedSummary = youtubeAnalysis.summary;
    
    // Se há diferença significativa de score (>20 pontos), mencionar fontes web
    const scoreDifference = Math.abs(youtubeAnalysis.score - webAnalysis.score);
    if (scoreDifference > 20) {
      const webSentiment = webAnalysis.score > youtubeAnalysis.score ? 'mais positivas' : 'mais cautelosas';
      combinedSummary = `${youtubeAnalysis.summary} Fontes web mostram perspectiva ${webSentiment}.`;
    }

    // Combinar pontos positivos (deduplica e mantém até 4)
    const allPositivePoints = [
      ...youtubeAnalysis.positivePoints,
      ...webAnalysis.positivePoints.map(p => `[Web] ${p}`)
    ];
    const uniquePositivePoints = Array.from(new Set(allPositivePoints)).slice(0, 4);

    // Combinar pontos negativos (deduplica e mantém até 4)
    const allNegativePoints = [
      ...youtubeAnalysis.negativePoints,
      ...webAnalysis.negativePoints.map(p => `[Web] ${p}`)
    ];
    const uniqueNegativePoints = Array.from(new Set(allNegativePoints)).slice(0, 4);

    console.log(
      `✅ ${ticker}: Análise combinada - Score ${combinedScore}/100 (YouTube: ${youtubeAnalysis.score}, Web: ${webAnalysis.score})`
    );

    return {
      score: combinedScore,
      summary: combinedSummary,
      positivePoints: uniquePositivePoints,
      negativePoints: uniqueNegativePoints,
    };
  }

  /**
   * Busca análise de empresa relacionada (mesmo nome base, ex: PETR3/PETR4)
   */
  static async findRelatedCompanyAnalysis(ticker: string, companyName: string): Promise<{
    companyId: number;
    analysis: SavedYouTubeAnalysis;
  } | null> {
    try {
      // Extrair ticker base (remover TODOS os números finais)
      // Ex: PETR3 → PETR, PETR4 → PETR, ALUP11 → ALUP, ALUP3 → ALUP
      const tickerBase = ticker.replace(/\d+$/, '');
      
      console.log(`🔗 ${ticker}: Buscando análises relacionadas (base: ${tickerBase})`);
      
      // Buscar empresas com ticker similar
      const relatedCompanies = await prisma.company.findMany({
        where: {
          OR: [
            { ticker: { startsWith: tickerBase } },
            { name: companyName }
          ],
          NOT: {
            ticker
          }
        },
        include: {
          youtubeAnalyses: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });
      
      console.log(`🔗 ${ticker}: Encontradas ${relatedCompanies.length} empresas relacionadas:`, 
        relatedCompanies.map(c => c.ticker).join(', '));

      // Procurar primeira empresa com análise válida (não vazia)
      for (const company of relatedCompanies) {
        console.log(`🔗 ${ticker}: Verificando ${company.ticker}...`);
        
        if (company.youtubeAnalyses && company.youtubeAnalyses.length > 0) {
          const analysis = company.youtubeAnalyses[0];
          
          // Verificar se não é análise vazia
          const videoIds = analysis.videoIds as string[];
          const isEmptyAnalysis = Array.isArray(videoIds) && videoIds.length === 0;
          
          console.log(`🔗 ${ticker}: ${company.ticker} tem análise com ${videoIds?.length || 0} vídeos (vazia: ${isEmptyAnalysis})`);
          
          if (!isEmptyAnalysis) {
            console.log(`✅ ${ticker}: Encontrada análise relacionada em ${company.ticker}, copiando...`);
            
            return {
              companyId: company.id,
              analysis: {
                id: analysis.id,
                companyId: analysis.companyId,
                score: parseFloat(analysis.score.toString()),
                summary: analysis.summary,
                positivePoints: analysis.positivePoints as string[] | null,
                negativePoints: analysis.negativePoints as string[] | null,
                videoIds: analysis.videoIds as string[],
                isActive: analysis.isActive,
                createdAt: analysis.createdAt,
                updatedAt: analysis.updatedAt
              }
            };
          } else {
            console.log(`⚠️ ${ticker}: Análise de ${company.ticker} está vazia, ignorando...`);
          }
        } else {
          console.log(`⚠️ ${ticker}: ${company.ticker} não tem análise ativa`);
        }
      }

      console.log(`❌ ${ticker}: Nenhuma análise relacionada válida encontrada`);
      return null;
    } catch (error) {
      console.error(`❌ Erro ao buscar análise relacionada para ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Copia análise de empresa relacionada para a empresa atual
   */
  static async copyAnalysisFromRelated(
    targetCompanyId: number,
    sourceAnalysis: SavedYouTubeAnalysis,
    sourceTicker: string,
    targetTicker: string
  ): Promise<string> {
    try {
      console.log(`📋 ${targetTicker}: Copiando análise de ${sourceTicker}...`);
      
      // Marcar análises anteriores como inativas
      await safeWrite(
        'deactivate-previous-youtube-analyses',
        () =>
          prisma.youTubeAnalysis.updateMany({
            where: {
              companyId: targetCompanyId,
              isActive: true,
            },
            data: {
              isActive: false,
            },
          }),
        ['youtube_analyses']
      );

      // Criar cópia da análise
      const copiedAnalysis = await safeWrite(
        'copy-youtube-analysis',
        () =>
          prisma.youTubeAnalysis.create({
            data: {
              companyId: targetCompanyId,
              score: sourceAnalysis.score,
              summary: sourceAnalysis.summary,
              positivePoints: sourceAnalysis.positivePoints || undefined,
              negativePoints: sourceAnalysis.negativePoints || undefined,
              videoIds: sourceAnalysis.videoIds,
              isActive: true,
            },
          }),
        ['youtube_analyses']
      );

      console.log(`✅ ${targetTicker}: Análise copiada de ${sourceTicker} (Score: ${sourceAnalysis.score}/100)`);

      return (copiedAnalysis as any).id;
    } catch (error) {
      console.error(`❌ Erro ao copiar análise para companyId ${targetCompanyId}:`, error);
      throw error;
    }
  }

  /**
   * Salva análise vazia quando não há vídeos (para evitar reprocessamento)
   */
  static async saveEmptyAnalysis(
    companyId: number,
    reason: string
  ): Promise<string> {
    try {
      // Marcar análises anteriores como inativas
      await safeWrite(
        'deactivate-previous-youtube-analyses',
        () =>
          prisma.youTubeAnalysis.updateMany({
            where: {
              companyId,
              isActive: true,
            },
            data: {
              isActive: false,
            },
          }),
        ['youtube_analyses']
      );

      // Criar análise vazia com score neutro
      const emptyAnalysis = await safeWrite(
        'create-empty-youtube-analysis',
        () =>
          prisma.youTubeAnalysis.create({
            data: {
              companyId,
              score: 50, // Score neutro
              summary: reason,
              positivePoints: undefined,
              negativePoints: undefined,
              videoIds: [], // Array vazio
              isActive: true,
            },
          }),
        ['youtube_analyses']
      );

      console.log(`💾 Análise vazia salva para companyId ${companyId} (sem vídeos disponíveis)`);

      return (emptyAnalysis as any).id;
    } catch (error) {
      console.error(`❌ Erro ao salvar análise vazia para companyId ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Valida se uma análise é válida para ser salva
   */
  static isValidAnalysis(analysisResult: YouTubeAnalysisResult): boolean {
    // Verificar se summary é válido (não pode ser "Vídeos encontrados" ou valores inválidos)
    const invalidSummaries = ['Vídeos encontrados', 'Vídeos encontrados.', 'Videos encontrados'];
    if (invalidSummaries.includes(analysisResult.summary?.trim())) {
      console.warn(`⚠️ Análise inválida: summary contém valor inválido "${analysisResult.summary}"`);
      return false;
    }

    // Verificar se summary existe e não está vazio
    if (!analysisResult.summary || analysisResult.summary.trim().length === 0) {
      console.warn(`⚠️ Análise inválida: summary vazio ou ausente`);
      return false;
    }

    // Verificar se há pelo menos pontos positivos OU negativos
    const hasPositivePoints = Array.isArray(analysisResult.positivePoints) && analysisResult.positivePoints.length > 0;
    const hasNegativePoints = Array.isArray(analysisResult.negativePoints) && analysisResult.negativePoints.length > 0;
    
    if (!hasPositivePoints && !hasNegativePoints) {
      console.warn(`⚠️ Análise inválida: sem pontos positivos ou negativos`);
      return false;
    }

    // Verificar se score é válido
    if (typeof analysisResult.score !== 'number' || analysisResult.score < 0 || analysisResult.score > 100) {
      console.warn(`⚠️ Análise inválida: score inválido (${analysisResult.score})`);
      return false;
    }

    return true;
  }

  /**
   * Salva análise no banco de dados (marca anterior como inativa)
   */
  static async saveAnalysis(
    companyId: number,
    videoIds: string[],
    analysisResult: YouTubeAnalysisResult
  ): Promise<string> {
    try {
      // Validar análise antes de salvar
      if (!this.isValidAnalysis(analysisResult)) {
        throw new Error('Análise inválida: não atende aos critérios de validação');
      }

      // Marcar análises anteriores como inativas
      await safeWrite(
        'deactivate-previous-youtube-analyses',
        () =>
          prisma.youTubeAnalysis.updateMany({
            where: {
              companyId,
              isActive: true,
            },
            data: {
              isActive: false,
            },
          }),
        ['youtube_analyses']
      );

      // Criar nova análise
      const newAnalysis = await safeWrite(
        'create-youtube-analysis',
        () =>
          prisma.youTubeAnalysis.create({
            data: {
              companyId,
              score: analysisResult.score,
              summary: analysisResult.summary, // Limitar tamanho
              positivePoints: analysisResult.positivePoints.length > 0 
                ? analysisResult.positivePoints 
                : undefined,
              negativePoints: analysisResult.negativePoints.length > 0 
                ? analysisResult.negativePoints 
                : undefined,
              videoIds,
              isActive: true,
            },
          }),
        ['youtube_analyses']
      );

      console.log(`💾 Análise salva para companyId ${companyId}: ${(newAnalysis as any).id}`);

      return (newAnalysis as any).id;
    } catch (error) {
      console.error(`❌ Erro ao salvar análise para companyId ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Busca análise ativa de uma empresa
   */
  static async getActiveAnalysis(companyId: number): Promise<SavedYouTubeAnalysis | null> {
    try {
      const analysis = await safeQueryWithParams(
        'get-active-youtube-analysis',
        () =>
          prisma.youTubeAnalysis.findFirst({
            where: {
              companyId,
              isActive: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          }),
        { companyId }
      );

      if (!analysis) {
        return null;
      }

      return {
        id: (analysis as any).id,
        companyId: (analysis as any).companyId,
        score: parseFloat((analysis as any).score.toString()),
        summary: (analysis as any).summary,
        positivePoints: (analysis as any).positivePoints as string[] | null,
        negativePoints: (analysis as any).negativePoints as string[] | null,
        videoIds: (analysis as any).videoIds as string[],
        isActive: (analysis as any).isActive,
        createdAt: (analysis as any).createdAt,
        updatedAt: (analysis as any).updatedAt,
      };
    } catch (error) {
      console.error(`❌ Erro ao buscar análise ativa para companyId ${companyId}:`, error);
      return null;
    }
  }

  /**
   * Compara IDs de vídeos para verificar se são os mesmos
   */
  static areVideoIdsSame(ids1: string[], ids2: string[]): boolean {
    if (ids1.length !== ids2.length) {
      return false;
    }

    const sorted1 = [...ids1].sort();
    const sorted2 = [...ids2].sort();

    return sorted1.every((id, index) => id === sorted2[index]);
  }

  /**
   * Busca próximo lote de empresas para processar
   * Prioriza: 1) Empresas nunca verificadas, 2) Empresas verificadas há mais tempo
   * Filtra: Apenas empresas lucrativas com ROE positivo
   */
  static async getNextBatchToProcess(batchSize: number) {
    try {
      const currentYear = new Date().getFullYear();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const baseWhere = {
        // Filtrar apenas empresas com dados financeiros recentes
        financialData: {
          some: {
            year: { gte: currentYear - 1 },
            // ROE positivo
            roe: { gt: 0 },
            // Lucrativas (lucro líquido positivo)
            lucroLiquido: { gt: 0 },
          },
        },
      };

      const includeConfig = {
        youtubeAnalyses: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
        financialData: {
          where: {
            year: { gte: currentYear - 1 },
          },
          orderBy: { year: 'desc' as const },
          take: 1,
          select: {
            roe: true,
            lucroLiquido: true,
            year: true,
          },
        },
      };

      // Primeiro busca empresas que nunca foram verificadas (youtubeLastCheckedAt null)
      console.log(`🔍 Buscando empresas nunca verificadas...`);
      const unprocessed = await prisma.company.findMany({
        where: {
          ...baseWhere,
          youtubeLastCheckedAt: null,
        },
        include: includeConfig,
        take: batchSize,
      });

      console.log(`📊 Encontradas ${unprocessed.length} empresas nunca verificadas`);

      // Se já temos o batchSize completo, retorna
      if (unprocessed.length >= batchSize) {
        return this.filterEmptyAnalyses(unprocessed, oneWeekAgo, batchSize);
      }

      // Caso contrário, busca as mais antigas para completar o lote
      const remaining = batchSize - unprocessed.length;
      console.log(`🔍 Buscando ${remaining} empresas mais antigas para completar o lote...`);
      
      const oldest = await prisma.company.findMany({
        where: {
          ...baseWhere,
          youtubeLastCheckedAt: { not: null },
        },
        include: includeConfig,
        orderBy: { youtubeLastCheckedAt: 'asc' },
        take: remaining * 2, // Buscar mais para compensar filtro de análises vazias
      });

      console.log(`📊 Encontradas ${oldest.length} empresas já verificadas`);

      const allCompanies = [...unprocessed, ...oldest];
      return this.filterEmptyAnalyses(allCompanies, oneWeekAgo, batchSize);
    } catch (error) {
      console.error('❌ Erro ao buscar próximo lote de empresas:', error);
      return [];
    }
  }

  /**
   * Filtra empresas com análises recentes (< 1 semana)
   */
  private static filterEmptyAnalyses(
    companies: any[],
    oneWeekAgo: Date,
    batchSize: number
  ): any[] {
    const filtered = companies.filter((company) => {
      const hasAnalysis = company.youtubeAnalyses?.length > 0;
      if (!hasAnalysis) return true;

      const latestAnalysis = company.youtubeAnalyses[0];

      // Verificar se é análise vazia (sem vídeos)
      const isEmptyAnalysis =
        Array.isArray(latestAnalysis.videoIds) &&
        latestAnalysis.videoIds.length === 0;

      // TODAS as análises (vazias ou com vídeos) devem aguardar 1 semana para reprocessamento
      if (latestAnalysis.updatedAt > oneWeekAgo) {
        if (isEmptyAnalysis) {
          console.log(
            `⏭️ ${company.ticker}: Análise vazia recente (< 7 dias), pulando...`
          );
        } else {
          console.log(
            `⏭️ ${company.ticker}: Análise existente recente (< 7 dias), pulando...`
          );
        }
        return false;
      }

      return true;
    });

    console.log(
      `🔍 Filtro aplicado: ${filtered.length} empresas elegíveis (ROE+ e lucrativas, sem análises recentes < 7 dias)`
    );

    return filtered.slice(0, batchSize);
  }

  /**
   * Atualiza youtubeLastCheckedAt de uma empresa
   */
  static async updateLastChecked(companyId: number): Promise<void> {
    try {
      await safeWrite(
        'update-company-youtube-last-checked',
        () =>
          prisma.company.update({
            where: { id: companyId },
            data: { youtubeLastCheckedAt: new Date() },
          }),
        ['companies']
      );
    } catch (error) {
      console.error(`❌ Erro ao atualizar youtubeLastCheckedAt para companyId ${companyId}:`, error);
    }
  }
}

