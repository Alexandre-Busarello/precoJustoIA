import { GrahamStrategy } from './graham-strategy';
import { FCDStrategy } from './fcd-strategy';
import { DividendYieldStrategy } from './dividend-yield-strategy';
import { LowPEStrategy } from './lowpe-strategy';
import { MagicFormulaStrategy } from './magic-formula-strategy';
import { GordonStrategy } from './gordon-strategy';
import { FundamentalistStrategy } from './fundamentalist-strategy';
import { AIStrategy } from './ai-strategy';
import { ScreeningStrategy } from './screening-strategy';
import { BarsiStrategy } from './barsi-strategy';
import { 
  StrategyParams, 
  StrategyAnalysis, 
  CompanyData, 
  RankBuilderResult,
  GrahamParams,
  FCDParams,
  DividendYieldParams,
  LowPEParams,
  MagicFormulaParams,
  GordonParams,
  AIParams,
  ScreeningParams,
  BarsiParams
} from './types';
import { FundamentalistParams } from './fundamentalist-strategy';

type StrategyType = 'graham' | 'fcd' | 'dividendYield' | 'lowPE' | 'magicFormula' | 'gordon' | 'fundamentalist' | 'ai' | 'screening' | 'barsi';

export class StrategyFactory {
  static createStrategy(type: StrategyType) {
    switch (type) {
      case 'graham':
        return new GrahamStrategy();
      case 'fcd':
        return new FCDStrategy();
      case 'dividendYield':
        return new DividendYieldStrategy();
      case 'lowPE':
        return new LowPEStrategy();
      case 'magicFormula':
        return new MagicFormulaStrategy();
      case 'gordon':
        return new GordonStrategy();
      case 'fundamentalist':
        return new FundamentalistStrategy();
      case 'ai':
        return new AIStrategy();
      case 'screening':
        return new ScreeningStrategy();
      case 'barsi':
        return new BarsiStrategy();
      default:
        throw new Error(`Unknown strategy type: ${type}`);
    }
  }

  static runAnalysis(
    type: StrategyType,
    companyData: CompanyData,
    params: StrategyParams
  ): StrategyAnalysis {
    const strategy = this.createStrategy(type);
    return strategy.runAnalysis(companyData, params as GrahamParams & DividendYieldParams & LowPEParams & MagicFormulaParams & FCDParams & GordonParams & FundamentalistParams & BarsiParams);
  }

  static runRanking(
    type: StrategyType,
    companies: CompanyData[],
    params: StrategyParams
  ): RankBuilderResult[] | Promise<RankBuilderResult[]> {
    const strategy = this.createStrategy(type);
    return strategy.runRanking(companies, params as GrahamParams & DividendYieldParams & LowPEParams & MagicFormulaParams & FCDParams & GordonParams & FundamentalistParams  & BarsiParams);
  }


  // Métodos tipados para cada estratégia
  static runGrahamAnalysis(companyData: CompanyData, params: GrahamParams): StrategyAnalysis {
    return this.runAnalysis('graham', companyData, params);
  }

  static runFCDAnalysis(companyData: CompanyData, params: FCDParams): StrategyAnalysis {
    return this.runAnalysis('fcd', companyData, params);
  }

  static runDividendYieldAnalysis(companyData: CompanyData, params: DividendYieldParams): StrategyAnalysis {
    return this.runAnalysis('dividendYield', companyData, params);
  }

  static runLowPEAnalysis(companyData: CompanyData, params: LowPEParams): StrategyAnalysis {
    return this.runAnalysis('lowPE', companyData, params);
  }

  static runMagicFormulaAnalysis(companyData: CompanyData, params: MagicFormulaParams): StrategyAnalysis {
    return this.runAnalysis('magicFormula', companyData, params);
  }

  static runGordonAnalysis(companyData: CompanyData, params: GordonParams): StrategyAnalysis {
    return this.runAnalysis('gordon', companyData, params);
  }

  static runFundamentalistAnalysis(companyData: CompanyData, params: FundamentalistParams): StrategyAnalysis {
    return this.runAnalysis('fundamentalist', companyData, params);
  }

  static runScreeningAnalysis(companyData: CompanyData, params: ScreeningParams): StrategyAnalysis {
    return this.runAnalysis('screening', companyData, params);
  }

  static runBarsiAnalysis(companyData: CompanyData, params: BarsiParams): StrategyAnalysis {
    return this.runAnalysis('barsi', companyData, params);
  }

  static runGrahamRanking(companies: CompanyData[], params: GrahamParams): RankBuilderResult[] {
    return this.runRanking('graham', companies, params) as RankBuilderResult[];
  }

  static runFCDRanking(companies: CompanyData[], params: FCDParams): RankBuilderResult[] {
    return this.runRanking('fcd', companies, params) as RankBuilderResult[];
  }

  static runDividendYieldRanking(companies: CompanyData[], params: DividendYieldParams): RankBuilderResult[] {
    return this.runRanking('dividendYield', companies, params) as RankBuilderResult[];
  }

  static runLowPERanking(companies: CompanyData[], params: LowPEParams): RankBuilderResult[] {
    return this.runRanking('lowPE', companies, params) as RankBuilderResult[];
  }

  static runMagicFormulaRanking(companies: CompanyData[], params: MagicFormulaParams): RankBuilderResult[] {
    return this.runRanking('magicFormula', companies, params) as RankBuilderResult[];
  }

  static runGordonRanking(companies: CompanyData[], params: GordonParams): RankBuilderResult[] {
    return this.runRanking('gordon', companies, params) as RankBuilderResult[];
  }

  static runFundamentalistRanking(companies: CompanyData[], params: FundamentalistParams): RankBuilderResult[] {
    return this.runRanking('fundamentalist', companies, params) as RankBuilderResult[];
  }

  static runScreeningRanking(companies: CompanyData[], params: ScreeningParams): RankBuilderResult[] {
    return this.runRanking('screening', companies, params) as RankBuilderResult[];
  }

  static runBarsiRanking(companies: CompanyData[], params: BarsiParams): RankBuilderResult[] {
    return this.runRanking('barsi', companies, params) as RankBuilderResult[];
  }

  static async runAIRanking(companies: CompanyData[], params: AIParams): Promise<RankBuilderResult[]> {
    const strategy = new AIStrategy();
    return await strategy.runRanking(companies, params);
  }

  static generateRational(type: StrategyType, params: GrahamParams | DividendYieldParams | LowPEParams | MagicFormulaParams | FCDParams | GordonParams | FundamentalistParams | AIParams | ScreeningParams | BarsiParams): string {
    const strategy = this.createStrategy(type);
    return strategy.generateRational(params as GrahamParams & DividendYieldParams & LowPEParams & MagicFormulaParams & FCDParams & GordonParams & AIParams & ScreeningParams & BarsiParams);
  }
}
