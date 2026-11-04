import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export const ADMIN_EMAIL = "arnavraut4567@gmail.com";
export const ADMIN_PASSWORD = "28logpose19";

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
    // 1. If real Supabase credentials are present
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            user_metadata: session.user.user_metadata,
          });
        } else {
          // Check local stored session
          const savedSession = localStorage.getItem("logpose_session_user");
          if (savedSession) {
            try {
              setUser(JSON.parse(savedSession));
            } catch {}
          }
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
          const savedSession = localStorage.getItem("logpose_session_user");
          if (savedSession) {
            try {
              setUser(JSON.parse(savedSession));
              return;
            } catch {}
          }
          setUser(null);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      // 2. Check localStorage for session
      const savedSession = localStorage.getItem("logpose_session_user");
      if (savedSession) {
        try {
          setUser(JSON.parse(savedSession));
        } catch {}
      }
      setIsLoading(false);
    }
  }, []);

  const isAdmin = Boolean(
    user?.email && user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()
  );

  const signInWithEmail = async (email: string, password: string): Promise<{ error?: string }> => {
    const normEmail = email.toLowerCase().trim();

    // 1. Check for Admin credentials
    if (normEmail === ADMIN_EMAIL.toLowerCase().trim()) {
      if (password === ADMIN_PASSWORD) {
        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.auth.signInWithPassword({ email: normEmail, password });
          } catch {}
        }
        const adminUser: AuthUser = {
          id: "admin-arnavraut",
          email: ADMIN_EMAIL,
          user_metadata: { full_name: "Arnav Raut (Admin)" },
        };
        setUser(adminUser);
        localStorage.setItem("logpose_session_user", JSON.stringify(adminUser));
        setIsAuthModalOpen(false);
        return {};
      } else {
        return { error: "Invalid password for administrator account." };
      }
    }

    // 2. Standard user sign in
    if (isSupabaseConfigured && supabase) {
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
    } else {
      // Offline / local fallback
      const standardUser: AuthUser = {
        id: `user-${Date.now()}`,
        email: normEmail,
        user_metadata: { full_name: normEmail.split("@")[0] },
      };
      setUser(standardUser);
      localStorage.setItem("logpose_session_user", JSON.stringify(standardUser));
      setIsAuthModalOpen(false);
      return {};
    }
  };

  const signUpWithEmail = async (email: string, password: string): Promise<{ error?: string }> => {
    const normEmail = email.toLowerCase().trim();

    // 1. Check for Admin credentials
    if (normEmail === ADMIN_EMAIL.toLowerCase().trim()) {
      if (password === ADMIN_PASSWORD) {
        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.auth.signUp({ email: normEmail, password });
          } catch {}
        }
        const adminUser: AuthUser = {
          id: "admin-arnavraut",
          email: ADMIN_EMAIL,
          user_metadata: { full_name: "Arnav Raut (Admin)" },
        };
        setUser(adminUser);
        localStorage.setItem("logpose_session_user", JSON.stringify(adminUser));
        setIsAuthModalOpen(false);
        const seenKey = `logpose_tour_seen_${ADMIN_EMAIL.toLowerCase().trim()}`;
        if (!localStorage.getItem(seenKey)) {
          localStorage.setItem(seenKey, "true");
          setShouldLaunchTour(true);
        }
        return {};
      } else {
        return { error: "Invalid password for administrator account." };
      }
    }

    // 2. Standard user sign up
    if (isSupabaseConfigured && supabase) {
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
    } else {
      const standardUser: AuthUser = {
        id: `user-${Date.now()}`,
        email: normEmail,
        user_metadata: { full_name: normEmail.split("@")[0] },
      };
      setUser(standardUser);
      localStorage.setItem("logpose_session_user", JSON.stringify(standardUser));
      setIsAuthModalOpen(false);
      const seenKey = `logpose_tour_seen_${normEmail}`;
      if (!localStorage.getItem(seenKey)) {
        localStorage.setItem(seenKey, "true");
        setShouldLaunchTour(true);
      }
      return {};
    }
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
