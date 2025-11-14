/**
 * Tipos e enums compartilhados para sistema de tracking
 * Deve corresponder ao enum EventType no schema.prisma
 */

export enum EventType {
  PAGE_VIEW = 'PAGE_VIEW',
  CLICK = 'CLICK',
  SCROLL = 'SCROLL',
  TIME_ON_PAGE = 'TIME_ON_PAGE',
  NAVIGATION = 'NAVIGATION',
  FORM_SUBMIT = 'FORM_SUBMIT',
  FEATURE_USED = 'FEATURE_USED',
  ASSET_VIEWED = 'ASSET_VIEWED',
  RANKING_CREATED = 'RANKING_CREATED',
  BACKTEST_RUN = 'BACKTEST_RUN',
  COMPARISON_STARTED = 'COMPARISON_STARTED',
  SEARCH = 'SEARCH',
  DOWNLOAD = 'DOWNLOAD',
  ERROR = 'ERROR',
}

