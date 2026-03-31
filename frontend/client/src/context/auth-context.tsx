import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useLocation } from "wouter";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
// const allowDemoAuth = import.meta.env.DEV && import.meta.env.VITE_ALLOW_DEMO_AUTH !== "false";

// const demoUser = {
//   id: "demo-user",
//   email: "demo@smartlocate.local",
//   app_metadata: { provider: "demo", providers: ["demo"] },
//   user_metadata: { mode: "demo" },
//   aud: "authenticated",
//   created_at: new Date().toISOString(),
// } as User;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // const [user, setUser] = useState<User | null>(
  //   isSupabaseConfigured && !allowDemoAuth ? null : demoUser,
  // );
  // const [loading, setLoading] = useState(isSupabaseConfigured && !allowDemoAuth);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);  
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // setSession(null);
      // setUser(demoUser);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }: any) => {
      const nextSession = data.session ?? null;
      setSession(nextSession);
      // setUser(nextSession?.user ?? (allowDemoAuth ? demoUser : null));
      setUser(nextSession?.user ?? null);
      setLoading(false);

      // redirect if not authenticated
      if (!nextSession) {
        setLocation("/");
      }
    });

    // const { data: listener } = supabase.auth.onAuthStateChange((_event: any, newSession: any) => {
    //   setSession(newSession);
    //   setUser(newSession?.user ?? (allowDemoAuth ? demoUser : null));
    // });

    // return () => listener.subscription.unsubscribe();


    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: any, newSession: any) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (!newSession) {
          setLocation("/");
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // if (!isSupabaseConfigured) {
    //   setLocation("/");
    //   return;
    // }

    if (session) {
      await supabase.auth.signOut();
      setLocation("/");
      return;
    }

    // if (allowDemoAuth) {
    //   setSession(null);
    //   setUser(demoUser);
    //   setLocation("/");
    //   return;
    // }

    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
