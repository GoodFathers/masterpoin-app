"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TRANSLATE_TARGET } from "./translate-langs";

/**
 * Preferensi tampilan sisi klien (tersimpan di localStorage):
 * - lite            : Mode Hemat — matikan animasi & efek berat via CSS (.lite di <html>)
 * - translateTarget : bahasa tujuan default untuk terjemahan pesan chat
 */
interface DisplayPrefsState {
  lite: boolean;
  translateTarget: string;
  setLite: (v: boolean) => void;
  setTranslateTarget: (v: string) => void;
}

export const useDisplayPrefs = create<DisplayPrefsState>()(
  persist(
    (set) => ({
      lite: false,
      translateTarget: DEFAULT_TRANSLATE_TARGET,
      setLite: (v) => set({ lite: v }),
      setTranslateTarget: (v) => set({ translateTarget: v }),
    }),
    { name: "indigoo-display-prefs" }
  )
);
