import { create } from 'zustand';

export type SettingsKey = 'tripReminders' | 'arrivalAlerts' | 'disruptions' | 'locationSharing' | 'autoCharge';

interface SettingsState {
  tripReminders: boolean;
  arrivalAlerts: boolean;
  disruptions: boolean;
  locationSharing: boolean;
  /** OFF (default) = the passenger is asked at every boarding; ON = charged automatically. Read by wallet, never written there. */
  autoCharge: boolean;
  toggle: (key: SettingsKey) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  tripReminders: false,
  arrivalAlerts: false,
  disruptions: true,
  locationSharing: false,
  autoCharge: false,
  toggle: (key) => set((s) => ({ ...s, [key]: !s[key] })),
}));

export function useSettings(): SettingsState {
  return useSettingsStore();
}
