import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Trophy, GamepadIcon, Menu, X } from "lucide-react";
import Cookies from "js-cookie";
import { supabase } from "@/lib/supabase";

export function Navbar() {
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check for user in cookies first to prevent flashing
    const checkCookieFirst = () => {
      const userData = Cookies.get('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          if (parsedUser && parsedUser.username) {
            setUser({ username: parsedUser.username });
            setIsLoading(false);
          }
        } catch (e) {
          console.error("Error parsing user cookie:", e);
        }
      }
    };
    
    // Initial check from cookies (immediate)
    checkCookieFirst();
    
    // Then check session (async)
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Get user profile from database
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .single();
          
          const username = profile?.username || 
                          session.user.user_metadata.name || 
                          session.user.user_metadata.full_name || 
                          session.user.email?.split('@')[0] || 
                          'player';
          
          setUser({ username });
          
          // Update cookie with latest data
          const userData = {
            id: session.user.id,
            email: session.user.email,
            username
          };
          
          Cookies.set('user', JSON.stringify(userData), { 
            expires: 7,
            secure: true,
            sameSite: 'strict'
          });
        } else {
          // Only set user to null if we didn't find a session
          // AND we don't have a user from cookies
          if (!user) {
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Error checking auth:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setIsLoading(true);
          // Get user profile from database
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .single();
          
          const username = profile?.username || 
                          session.user.user_metadata.name || 
                          session.user.user_metadata.full_name || 
                          session.user.email?.split('@')[0] || 
                          'player';
          
          setUser({ username });
          
          // Update cookie
          const userData = {
            id: session.user.id,
            email: session.user.email,
            username
          };
          
          Cookies.set('user', JSON.stringify(userData), { 
            expires: 7,
            secure: true,
            sameSite: 'strict'
          });
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          Cookies.remove('user');
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear all cookies
      Cookies.remove('user');
      
      // Clear any other auth-related cookies if they exist
      Cookies.remove('sb-access-token');
      Cookies.remove('sb-refresh-token');
      
      // Update local state
      setUser(null);
      setMobileMenuOpen(false);
      
      // Navigate to login
      navigate("/login");
      
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Close mobile menu when changing routes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);
  
  // Render a persistent UI regardless of loading state
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 w-full border-b bg-background/95 backdrop-blur-sm z-50"
    >
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
            <span className="gradient-text bg-gradient-to-r from-primary to-blue-700 bg-clip-text text-transparent font-bold">
              GuessGame
            </span>
          </Link>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-4">
          {isLoading ? (
            // Show skeleton loader while checking auth
            <div className="flex items-center gap-4">
              <div className="h-8 w-24 bg-muted rounded animate-pulse"></div>
              <div className="h-8 w-24 bg-muted rounded animate-pulse"></div>
            </div>
          ) : user ? (
            <>
              <Link 
                to="/game"
                className={`flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                  location.pathname === "/game" 
                    ? "bg-muted text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <GamepadIcon className="h-4 w-4" />
                <span>Play Game</span>
              </Link>
              
              <Link 
                to="/leaderboard"
                className={`flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                  location.pathname === "/leaderboard" 
                    ? "bg-muted text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Trophy className="h-4 w-4" />
                <span>Leaderboard</span>
              </Link>
              
              <div className="text-sm font-medium ml-2">
                Hi, {user.username}
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/login")}
              >
                Sign In
              </Button>
              <Button 
                size="sm"
                onClick={() => navigate("/register")}
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
        
        {/* Mobile Navigation Button */}
        <div className="md:hidden flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="md:hidden border-t"
        >
          <div className="px-4 py-3 space-y-3">
            {isLoading ? (
              // Show skeleton loader while checking auth
              <div className="space-y-3">
                <div className="h-8 w-full bg-muted rounded animate-pulse"></div>
                <div className="h-8 w-full bg-muted rounded animate-pulse"></div>
              </div>
            ) : user ? (
              <>
                <div className="text-sm font-medium py-2 border-b mb-2">
                  Hi, {user.username}
                </div>
                
                <Link 
                  to="/game"
                  className={`flex items-center gap-2 p-2 rounded-md w-full ${
                    location.pathname === "/game" 
                      ? "bg-muted text-foreground" 
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <GamepadIcon className="h-4 w-4" />
                  <span>Play Game</span>
                </Link>
                
                <Link 
                  to="/leaderboard"
                  className={`flex items-center gap-2 p-2 rounded-md w-full ${
                    location.pathname === "/leaderboard" 
                      ? "bg-muted text-foreground" 
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Trophy className="h-4 w-4" />
                  <span>Leaderboard</span>
                </Link>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleLogout}
                  className="w-full mt-2"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/login")}
                  className="justify-start"
                >
                  Sign In
                </Button>
                <Button 
                  size="sm"
                  onClick={() => navigate("/register")}
                  className="justify-start"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
