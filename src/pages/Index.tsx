import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Cookies from "js-cookie";

export const Index = () => {
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [mousePagePosition, setMousePagePosition] = useState({ x: 0, y: 0 });
  const backgroundRef = useRef<HTMLDivElement>(null);
  const throttleRef = useRef<number | null>(null);
  const [score, setScore] = useState(0);
  const [floatingNumbers, setFloatingNumbers] = useState<Array<{
    id: number;
    value: number;
    x: number;
    y: number;
    size: number;
    opacity: number;
  }>>([]);

  // Check if user is already logged in
  useEffect(() => {
    const userData = Cookies.get('user');
    const user = userData ? JSON.parse(userData) : null;
    if (user) {
      navigate("/game");
    }
  }, [navigate]);

  // Generate initial floating numbers
  useEffect(() => {
    const nums = [];
    const MAX_NUMBERS = 12; // Reduced from 15 to 12

    for (let i = 0; i < MAX_NUMBERS; i++) {
      nums.push({
        id: i,
        value: Math.floor(Math.random() * 100) + 1,
        x: Math.random() * 90 + 5, // Keep away from edges
        y: Math.random() * 90 + 5,
        size: Math.random() * 1.2 + 0.8, // Slightly reduced size range
        opacity: Math.random() * 0.3 + 0.7, // Increased minimum opacity
      });
    }
    setFloatingNumbers(nums);

    // Add new numbers periodically
    const interval = setInterval(() => {
      if (floatingNumbers.length < MAX_NUMBERS) {
        setFloatingNumbers(prev => [
          ...prev,
          {
            id: Date.now(),
            value: Math.floor(Math.random() * 100) + 1,
            x: Math.random() * 90 + 5,
            y: Math.random() * 90 + 5,
            size: Math.random() * 1.2 + 0.8,
            opacity: Math.random() * 0.3 + 0.7,
          }
        ]);
      }
    }, 3000); // Increased interval from 2000ms to 3000ms

    return () => clearInterval(interval);
  }, []);

  // Handle mouse movement
  const handleMouseMove = (e: React.MouseEvent) => {
    // Update mouse page position for number interactions (unthrottled)
    setMousePagePosition({ x: e.clientX, y: e.clientY });

    // Throttled update for background effect
    if (throttleRef.current !== null) return;

    throttleRef.current = window.setTimeout(() => {
      throttleRef.current = null;

      if (backgroundRef.current) {
        const { left, top, width, height } = backgroundRef.current.getBoundingClientRect();
        const x = (e.clientX - left) / width;
        const y = (e.clientY - top) / height;
        setMousePosition({ x, y });
      }
    }, 50);
  };

  // Clean up throttle timer
  useEffect(() => {
    return () => {
      if (throttleRef.current !== null) {
        clearTimeout(throttleRef.current);
      }
    };
  }, []);

  // Simple click handler
  const handleNumberClick = (id: number) => {
    setScore(prevScore => prevScore + 1);
    setFloatingNumbers(prevNumbers =>
      prevNumbers.filter(num => num.id !== id)
    );
  };

  // Calculate positions based on mouse proximity
  const getNumberPosition = (num: typeof floatingNumbers[0]) => {
    // Container dimensions
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    // Calculate number position in pixels
    const numX = (num.x / 100) * containerWidth;
    const numY = (num.y / 100) * containerHeight;

    // Calculate distance between mouse and number
    const dx = mousePagePosition.x - numX;
    const dy = mousePagePosition.y - numY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only move numbers within this radius
    const repelRadius = 250; // Increased from 200 to 250

    if (distance < repelRadius) {
      // Calculate repulsion strength (stronger when closer)
      const repelStrength = (1 - distance / repelRadius) * 8; // Reduced from 10 to 8

      // Calculate repulsion direction (away from mouse)
      const angle = Math.atan2(dy, dx);

      // Calculate new position (move away from mouse)
      const moveX = Math.cos(angle) * repelStrength;
      const moveY = Math.sin(angle) * repelStrength;

      // Convert back to percentage and return, keeping within bounds
      return {
        x: Math.max(5, Math.min(95, num.x - (moveX / containerWidth) * 100)),
        y: Math.max(5, Math.min(95, num.y - (moveY / containerHeight) * 100))
      };
    }

    // Return original position if not in range
    return { x: num.x, y: num.y };
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      onMouseMove={handleMouseMove}
      ref={backgroundRef}
    >
      {/* Interactive background */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute inset-0"
          animate={{
            background: `radial-gradient(circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, rgba(59, 130, 246, 0.2), rgba(147, 197, 253, 0.05), rgba(0, 0, 0, 0))`,
          }}
          transition={{ type: "tween", ease: "easeOut", duration: 0.5 }}
        />

        <motion.div
          className="absolute w-[60vw] h-[60vh] rounded-full blur-3xl opacity-25"
          style={{
            background: "linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)",
            left: "50%",
            top: "50%",
            translateX: "-50%",
            translateY: "-50%",
          }}
          animate={{
            x: (mousePosition.x - 0.5) * 40,
            y: (mousePosition.y - 0.5) * 40,
          }}
          transition={{ type: "tween", ease: "easeOut", duration: 0.7 }}
        />

        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      </div>

      {/* Floating Numbers */}
      <div className="absolute inset-0">
        {floatingNumbers.map((num) => {
          const pos = getNumberPosition(num);

          return (
            <motion.div
              key={num.id}
              className="absolute cursor-pointer"
              style={{
                left: `${num.x}%`,
                top: `${num.y}%`,
                zIndex: 5,
              }}
              animate={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
              transition={{
                type: "spring",
                damping: 10,      // Lower damping for less sluggish movement
                stiffness: 300,   // Higher stiffness for a faster transition
                mass: 0.4,        // Lower mass for a quicker response
              }}
              onClick={() => handleNumberClick(num.id)}
            >
              <motion.div
                className={`rounded-full flex items-center justify-center font-mono font-bold bg-gradient-to-br ${
                  num.value < 33
                    ? "from-green-400 to-blue-500"
                    : num.value < 66
                    ? "from-yellow-400 to-orange-500"
                    : "from-pink-500 to-red-500"
                }`}
                style={{
                  width: `${num.size * 3}rem`,
                  height: `${num.size * 3}rem`,
                  opacity: num.opacity,
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-white" style={{ fontSize: `${num.size}rem` }}>
                  {num.value}
                </span>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Score display */}
      {score > 0 && (
        <div className="fixed top-20 right-6 z-20">
          <motion.div
            className="bg-background/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-primary/20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring" }}
          >
            <div className="text-lg font-bold text-primary">
              {score} <span className="text-sm font-normal">clicked</span>
            </div>
          </motion.div>
        </div>
      )}

      <header className="w-full py-6 px-4 sm:px-6 lg:px-8 border-b bg-background/90 backdrop-blur-md relative z-10">
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

      <main className="flex-grow flex items-center justify-center p-4 relative z-10">
        <div className="max-w-4xl mx-auto w-full">
          <div className="grid gap-12 md:grid-cols-2 md:gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-center md:text-left"
            >
              <h1 className="text-4xl font-bold tracking-tight mb-4 md:text-5xl lg:text-6xl">
                Test Your Guessing Skills
              </h1>
              <p className="text-lg text-muted-foreground mb-8 md:pr-8">
                Challenge yourself with our number guessing game. Compete with other players and climb up the leaderboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Button
                  size="lg"
                  onClick={() => navigate("/login")}
                  className="relative group h-12 overflow-hidden px-8 rounded-lg bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-bold uppercase tracking-wide shadow-lg transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
                >
                  {/* Animated overlay */}
                  <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-lg" />
                  <span className="relative z-10">Get Started</span>
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

      <footer className="w-full py-6 px-4 border-t relative z-10">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} GuessGame. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
