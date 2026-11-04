import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured, ADMIN_EMAIL } from "../lib/supabase";

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithOAuth: (provider: "google" | "github") => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  loginAsDemoAdmin: () => void;
  loginAsDemoUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_ADMIN_USER: AuthUser = {
  id: "admin-arnav-001",
  email: ADMIN_EMAIL,
  user_metadata: {
    full_name: "Arnav Raut (Admin)",
  },
};

const DEMO_STANDARD_USER: AuthUser = {
  id: "user-trader-002",
  email: "trader.user@gmail.com",
  user_metadata: {
    full_name: "Sample Market Trader",
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    // 1. If real Supabase credentials are present
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            user_metadata: session.user.user_metadata,
          });
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            user_metadata: session.user.user_metadata,
          });
        } else {
          setUser(null);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      // 2. Check localStorage for local simulated session
      const savedMock = localStorage.getItem("logpose_mock_user");
      if (savedMock) {
        try {
          setUser(JSON.parse(savedMock));
        } catch {}
      }
      setIsLoading(false);
    }
  }, []);

  const isAdmin = Boolean(
    user?.email && user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()
  );

  const signInWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      // Local fallback simulation
      const mockUser: AuthUser = {
        id: `mock-${Date.now()}`,
        email: email.trim(),
        user_metadata: { full_name: email.split("@")[0] },
      };
      setUser(mockUser);
      localStorage.setItem("logpose_mock_user", JSON.stringify(mockUser));
      setIsAuthModalOpen(false);
      return {};
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    setIsAuthModalOpen(false);
    return {};
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      const mockUser: AuthUser = {
        id: `mock-${Date.now()}`,
        email: email.trim(),
        user_metadata: { full_name: email.split("@")[0] },
      };
      setUser(mockUser);
      localStorage.setItem("logpose_mock_user", JSON.stringify(mockUser));
      setIsAuthModalOpen(false);
      return {};
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    setIsAuthModalOpen(false);
    return {};
  };

  const signInWithOAuth = async (provider: "google" | "github") => {
    if (!isSupabaseConfigured || !supabase) {
      alert(`Supabase credentials not configured in .env. Use 1-Click Demo Profile below to test!`);
      return { error: "Supabase credentials missing." };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) return { error: error.message };
    return {};
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem("logpose_mock_user");
  };

  const loginAsDemoAdmin = () => {
    setUser(DEMO_ADMIN_USER);
    localStorage.setItem("logpose_mock_user", JSON.stringify(DEMO_ADMIN_USER));
    setIsAuthModalOpen(false);
  };

  const loginAsDemoUser = () => {
    setUser(DEMO_STANDARD_USER);
    localStorage.setItem("logpose_mock_user", JSON.stringify(DEMO_STANDARD_USER));
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        signInWithEmail,
        signUpWithEmail,
        signInWithOAuth,
        signOut,
        loginAsDemoAdmin,
        loginAsDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
