import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

// Not yet configured (e.g. local dev before infra is deployed) — public pages should
// still render; auth-dependent actions fail with a clear error instead of a blank page.
const userPool =
  userPoolId && clientId
    ? new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId })
    : null;

function requirePool(): CognitoUserPool {
  if (!userPool) {
    throw new Error(
      "Authentication isn't configured yet (missing VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_CLIENT_ID)."
    );
  }
  return userPool;
}

interface AuthState {
  loading: boolean;
  idToken: string | null;
  isAdmin: boolean;
  userId: string | null;
  email: string | null;
}

interface NewPasswordChallenge {
  cognitoUser: CognitoUser;
}

interface AuthContextValue extends AuthState {
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: true } | { ok: false; challenge: NewPasswordChallenge }>;
  completeNewPassword: (
    challenge: NewPasswordChallenge,
    newPassword: string
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionToState(session: CognitoUserSession): AuthState {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload() as Record<string, unknown>;
  const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
  return {
    loading: false,
    idToken: idToken.getJwtToken(),
    isAdmin: groups.includes("admin"),
    userId: (payload.sub as string) ?? null,
    email: (payload.email as string) ?? null,
  };
}

const EMPTY_STATE: AuthState = {
  loading: false,
  idToken: null,
  isAdmin: false,
  userId: null,
  email: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...EMPTY_STATE, loading: true });

  useEffect(() => {
    const currentUser = userPool?.getCurrentUser();
    if (!currentUser) {
      setState({ ...EMPTY_STATE, loading: false });
      return;
    }
    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        setState({ ...EMPTY_STATE, loading: false });
        return;
      }
      setState(sessionToState(session));
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: (email, password) =>
        new Promise((resolve, reject) => {
          const cognitoUser = new CognitoUser({ Username: email, Pool: requirePool() });
          cognitoUser.authenticateUser(
            new AuthenticationDetails({ Username: email, Password: password }),
            {
              onSuccess: (session) => {
                setState(sessionToState(session));
                resolve({ ok: true });
              },
              onFailure: reject,
              newPasswordRequired: () => {
                resolve({ ok: false, challenge: { cognitoUser } });
              },
            }
          );
        }),
      completeNewPassword: (challenge, newPassword) =>
        new Promise((resolve, reject) => {
          challenge.cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
            onSuccess: (session) => {
              setState(sessionToState(session));
              resolve();
            },
            onFailure: reject,
          });
        }),
      logout: () => {
        userPool?.getCurrentUser()?.signOut();
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
