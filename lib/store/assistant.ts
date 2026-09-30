"use client";

import { create } from "zustand";

export type AssistantContext = { productSlug?: string; searchQuery?: string };

type AssistantState = {
  open: boolean;
  context: AssistantContext;
  openWith: (ctx?: AssistantContext) => void;
  close: () => void;
  toggle: () => void;
  setContext: (ctx: AssistantContext) => void;
};

/** Drawer state: closed by default, context follows product/search pages. */
export const useAssistant = create<AssistantState>()((set) => ({
  open: false,
  context: {},
  openWith: (ctx) => set((s) => ({ open: true, context: ctx ? { ...s.context, ...ctx } : s.context })),
  close: () => set({ open: false }),
  toggle: () => set((s) => ({ open: !s.open })),
  setContext: (ctx) => set((s) => ({ context: { ...s.context, ...ctx } })),
}));
