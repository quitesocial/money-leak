import { create } from 'zustand';

import { type PeriodScope } from '@/lib/period-scope';

type PeriodScopeStore = {
  selectedPeriod: PeriodScope;
  setSelectedPeriod: (period: PeriodScope) => void;
};

export const usePeriodScopeStore = create<PeriodScopeStore>((set) => ({
  selectedPeriod: 'this_month',
  setSelectedPeriod: (selectedPeriod) => set({ selectedPeriod }),
}));
