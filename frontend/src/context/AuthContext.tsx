import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured, ADMIN_EMAIL } from "../lib/supabase";

export { ADMIN_EMAIL };

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
  shouldLaunchTour: boolean;
  resetTourLaunch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [shouldLaunchTour, setShouldLaunchTour] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            user_metadata: session.user.user_metadata,
          });
        } else {
          setUser(null);
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
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const isAdmin = Boolean(
    user?.email && ADMIN_EMAIL && user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()
  );

  const signInWithEmail = async (email: string, password: string): Promise<{ error?: string }> => {
    const normEmail = email.toLowerCase().trim();

    if (!isSupabaseConfigured || !supabase) {
      return { error: "Supabase authentication is not configured. Please check environment variables." };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: normEmail, password });
    if (error) return { error: error.message };
    if (data?.user) {
      setUser({
        id: data.user.id,
        email: data.user.email || normEmail,
        user_metadata: data.user.user_metadata,
      });
    }
    setIsAuthModalOpen(false);
    return {};
  };

  const signUpWithEmail = async (email: string, password: string): Promise<{ error?: string }> => {
    const normEmail = email.toLowerCase().trim();

    if (!isSupabaseConfigured || !supabase) {
      return { error: "Supabase authentication is not configured. Please check environment variables." };
    }

    const { data, error } = await supabase.auth.signUp({ email: normEmail, password });
    if (error) return { error: error.message };
    if (data?.user) {
      setUser({
        id: data.user.id,
        email: data.user.email || normEmail,
        user_metadata: data.user.user_metadata,
      });
    }
    setIsAuthModalOpen(false);
    const seenKey = `logpose_tour_seen_${normEmail}`;
    if (!localStorage.getItem(seenKey)) {
      localStorage.setItem(seenKey, "true");
      setShouldLaunchTour(true);
    }
    return {};
  };

  const signInWithOAuth = async (provider: "google" | "github"): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: "Supabase OAuth credentials not configured on backend yet." };
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
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    setUser(null);
    localStorage.removeItem("logpose_session_user");
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
        shouldLaunchTour,
        resetTourLaunch: () => setShouldLaunchTour(false),
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
