export {};

interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramWebApp {
  /** Raw, signed query-string — send this to the backend for HMAC verification. Never trust it client-side. */
  initData: string;
  /** Convenience-parsed, UNSIGNED mirror of initData — display only, never for auth decisions. */
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    /** Present when opened via a t.me/<bot>/<app>?startapp=<value> deep link. */
    start_param?: string;
  };
  ready: () => void;
  expand: () => void;
  colorScheme: "light" | "dark";
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}
