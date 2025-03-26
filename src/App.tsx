import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabase';
import Cookies from 'js-cookie';
// import { AuthWrapper } from "@/components/auth/AuthWrapper";

// Pages
import { Index } from "@/pages/Index";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { Game } from "@/pages/Game";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { NotFound } from "@/pages/NotFound";

// Wrapper component to handle auth state
const AuthRoutes = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const location = useLocation();
  
  // Don't show loading state on auth pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  
  useEffect(() => {
    // Check for user in cookies first for immediate response
    const checkCookieFirst = () => {
      const userData = Cookies.get('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          if (parsedUser && parsedUser.id) {
            setIsAuthenticated(true);
            setIsInitialLoad(false);
            return true;
          }
        } catch (e) {
          console.error("Error parsing user cookie:", e);
        }
      }
      return false;
    };
    
    // If we found a user in cookies, we can skip the session check
    if (checkCookieFirst()) return;
    
    // Check authentication status from Supabase
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error("Auth check error:", error);
        setIsAuthenticated(false);
      } finally {
        setIsInitialLoad(false);
      }
    };
    
    checkAuth();
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setIsAuthenticated(true);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Skip loading state for auth pages
  if (isInitialLoad && !isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading application...</p>
        </div>
      </div>
    );
  }

  // For auth pages, assume not authenticated during initial load
  const effectiveAuth = isInitialLoad && isAuthPage ? false : isAuthenticated;

  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<Index />} />
        <Route 
          path="/login" 
          element={effectiveAuth ? <Navigate to="/game" /> : <Login />} 
        />
        <Route 
          path="/register" 
          element={effectiveAuth ? <Navigate to="/game" /> : <Register />} 
        />
        <Route 
          path="/game" 
          element={effectiveAuth ? <Game /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/leaderboard" 
          element={effectiveAuth ? <LeaderboardPage /> : <Navigate to="/login" />} 
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  // Create a client
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
