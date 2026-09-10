import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Role, User } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";

const SESSION_STORAGE_KEY = "ttrpg_session_token";

interface AuthState {
  loading: boolean;
  idToken: string | null;
  isAdmin: boolean;
  userId: string | null;
  roles: Role[];
}

interface DevLoginPayload {
  secret: string;
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

interface AuthContextValue extends AuthState {
  /** Called with the object Telegram's Login Widget passes to its onauth callback. */
  loginWithTelegram: (widgetPayload: Record<string, unknown>) => Promise<void>;
  /** Dev-only escape hatch — the Login Widget can't authenticate on localhost. See /auth/dev-login on the backend. */
  loginDev: (payload: DevLoginPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_STATE: AuthState = {
  loading: false,
  idToken: null,
  isAdmin: false,
  userId: null,
  roles: [],
};

interface LoginResponse {
  token: string;
  user: User;
  isAdmin: boolean;
}

function applyLoginResponse(data: LoginResponse): AuthState {
  localStorage.setItem(SESSION_STORAGE_KEY, data.token);
  return {
    loading: false,
    idToken: data.token,
    isAdmin: data.isAdmin,
    userId: data.user.userId,
    roles: data.user.roles ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...EMPTY_STATE, loading: true });

  useEffect(() => {
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!token) {
      setState({ ...EMPTY_STATE, loading: false });
      return;
    }
    apiFetch<{ user: User; isAdmin: boolean }>("/me", { token })
      .then((data) => {
        setState({
          loading: false,
          idToken: token,
          isAdmin: data.isAdmin,
          userId: data.user.userId,
          roles: data.user.roles ?? [],
        });
      })
      .catch(() => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setState({ ...EMPTY_STATE, loading: false });
      });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      loginWithTelegram: async (widgetPayload) => {
        const data = await apiFetch<LoginResponse>("/auth/telegram", {
          method: "POST",
          body: widgetPayload,
        });
        setState(applyLoginResponse(data));
      },
      loginDev: async (payload) => {
        const data = await apiFetch<LoginResponse>("/auth/dev-login", {
          method: "POST",
          body: payload,
        });
        setState(applyLoginResponse(data));
      },
      logout: () => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setState({ ...EMPTY_STATE, loading: false });
      },
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
