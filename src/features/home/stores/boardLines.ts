import { create } from 'zustand';

interface BoardLinesState {
  /** Liniile bifate în panoul stației (17, 11…); gol = toate. */
  lines: string[];
  setLines: (lines: string[]) => void;
}

/**
 * Filtrul de linii al panoului stației, ca harta să arate doar vehiculele acelor linii care vin spre stație
 * (ca în Google Maps). Nepersistat: la repornire se văd iar toate liniile.
 */
export const useBoardLines = create<BoardLinesState>()((set) => ({
  lines: [],
  setLines: (lines) => set({ lines }),
}));
