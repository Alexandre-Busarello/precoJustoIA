'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useWizardState } from './use-wizard-state'
import { WizardStepper } from './wizard-stepper'
import { StepDestination } from './steps/step-destination'
import { StepHistory } from './steps/step-history'
import { StepAssetType } from './steps/step-asset-type'
import { StepConfigure } from './steps/step-configure'

interface RankingWizardProps {
  isLoggedIn: boolean
}

const slideVariants = {
  enterForward: { x: '100%', opacity: 0 },
  enterBackward: { x: '-100%', opacity: 0 },
  center: { x: 0, opacity: 1 },
  exitForward: { x: '-100%', opacity: 0 },
  exitBackward: { x: '100%', opacity: 0 },
}

const fadeVariants = {
  enterForward: { opacity: 0 },
  enterBackward: { opacity: 0 },
  center: { opacity: 1 },
  exitForward: { opacity: 0 },
  exitBackward: { opacity: 0 },
}

function useReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function RankingWizard({ isLoggedIn }: RankingWizardProps) {
  const { state, navigate } = useWizardState()
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)
  const reducedMotion = useReducedMotion()

  const variants = reducedMotion ? fadeVariants : slideVariants
  const transitionDuration = reducedMotion ? 0.2 : 0.28

  const enterVariant = state.direction === 'forward' ? 'enterForward' : 'enterBackward'
  const exitVariant = state.direction === 'forward' ? 'exitForward' : 'exitBackward'

  return (
    <div className="w-full">
      {/* Stepper */}
      <WizardStepper flow={state.flow} currentStep={state.step} />

      {/* Step content with animation */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={state.step}
            initial={enterVariant}
            animate="center"
            exit={exitVariant}
            variants={variants}
            transition={{ duration: transitionDuration }}
            style={{ willChange: 'transform, opacity' }}
          >
            {state.step === 'destination' && (
              <StepDestination
                isLoggedIn={isLoggedIn}
                onSelect={navigate.selectFlow}
              />
            )}

            {state.step === 'history' && (
              <StepHistory
                onLoadRanking={navigate.loadRanking}
                onBack={navigate.back}
                onCreateNew={() => navigate.selectFlow('new')}
                refreshTrigger={historyRefreshTrigger}
              />
            )}

            {state.step === 'asset-type' && (
              <StepAssetType
                onSelect={navigate.selectAssetType}
                onBack={navigate.back}
              />
            )}

            {state.step === 'configure' && (
              <StepConfigure
                assetType={state.assetType}
                rankingId={state.rankingId}
                onBack={navigate.back}
                onRankingGenerated={() => setHistoryRefreshTrigger((t) => t + 1)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
