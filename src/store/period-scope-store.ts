import { create } from 'zustand';

import {
  getLocalDayStartTimestamp,
  type PeriodScope,
} from '@/lib/period-scope';

type PeriodScopeStore = {
  selectedPeriod: PeriodScope;
  selectedCustomDateStart: number | null;
  setSelectedPeriod: (period: PeriodScope) => void;
  setSelectedCustomDate: (dateStart: number) => void;
};

export const usePeriodScopeStore = create<PeriodScopeStore>((set) => ({
  selectedPeriod: 'today',
  selectedCustomDateStart: null,
  setSelectedPeriod: (selectedPeriod) => set({ selectedPeriod }),
  setSelectedCustomDate: (dateStart) => {
    const selectedCustomDateStart = getLocalDayStartTimestamp(dateStart);

    if (selectedCustomDateStart === null) return;

    set({
      selectedPeriod: 'custom_date',
      selectedCustomDateStart,
    });
  },
}));
