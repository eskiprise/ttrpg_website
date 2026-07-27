import { createContext, useContext } from "react";

interface TelegramAppContextValue {
  /** Raw signed initData string — pass this to every /telegram/* backend call for auth. */
  initData: string;
}

export const TelegramAppContext = createContext<TelegramAppContextValue | null>(null);

export function useTelegramApp(): TelegramAppContextValue {
  const ctx = useContext(TelegramAppContext);
  if (!ctx) throw new Error("useTelegramApp must be used within TelegramMiniAppRoot");
  return ctx;
}
