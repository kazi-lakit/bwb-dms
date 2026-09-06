"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usersApi, type BlocksUser } from "@/lib/blocks/users";
import { blocksClient } from "@/lib/blocks/client";
import { endSession, SESSION_EXPIRED_EVENT } from "@/lib/blocks/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: BlocksUser | null;
  /** Re-validates the cookie-backed IAM session. */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<BlocksUser | null>(null);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    try {
      if (!(await blocksClient.auth.isAuthenticated())) throw new Error("Unauthenticated");
      const me = await usersApi.me();
      setUser(me);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onExpired = () => {
      if (statusRef.current === "authenticated") {
        setUser(null);
        setStatus("unauthenticated");
      }
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const logout = useCallback(async () => {
    await endSession().catch(() => {});
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, refresh: bootstrap, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
