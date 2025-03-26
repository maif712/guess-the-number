import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Cookies from "js-cookie";

export const Index = () => {
  const navigate = useNavigate();
  
  // Check if user is already logged in
  useEffect(() => {
    const userData = Cookies.get('user');
    const user = userData ? JSON.parse(userData) : null;
    if (user) {
      navigate("/game");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full py-6 px-4 sm:px-6 lg:px-8 border-b bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="gradient-text bg-gradient-to-r from-primary to-blue-700 bg-clip-text text-transparent font-bold">
              GuessGame
            </span>
          </h1>
          <div className="flex gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/register")}>
              Sign Up
            </Button>
          </div>
        </div>
      </header>
      
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-4xl mx-auto w-full">
          <div className="grid gap-12 md:grid-cols-2 md:gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-center md:text-left"
            >
              <h1 className="text-4xl font-bold tracking-tight mb-4 md:text-5xl lg:text-6xl">
                Test Your <span className="text-gradient">Guessing</span> Skills
              </h1>
              <p className="text-lg text-muted-foreground mb-8 md:pr-8">
                Challenge yourself with our number guessing game. Compete with other players and climb up the leaderboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Button size="lg" onClick={() => navigate("/register")} className="h-12 px-8">
                  Get Started
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate("/login")} className="h-12 px-8">
                  I Already Have an Account
                </Button>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="relative rounded-xl overflow-hidden border shadow-card aspect-[4/3]">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-blue-500/10 glass-effect p-6 flex flex-col justify-center items-center text-center">
                  <h3 className="text-2xl font-bold mb-4">How to Play</h3>
                  <ul className="text-left space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                        <span className="text-sm font-medium text-primary">1</span>
                      </div>
                      <span>Guess a number between 1 and 100</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                        <span className="text-sm font-medium text-primary">2</span>
                      </div>
                      <span>Receive hints after each guess</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                        <span className="text-sm font-medium text-primary">3</span>
                      </div>
                      <span>Earn points based on how quickly you guess correctly</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                        <span className="text-sm font-medium text-primary">4</span>
                      </div>
                      <span>Compare your scores on the leaderboard</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      
      <footer className="w-full py-6 px-4 border-t">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} GuessGame. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
