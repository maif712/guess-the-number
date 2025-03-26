import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { GameLayout } from "@/components/game/GameLayout";
import { supabase } from "@/lib/supabase";

const MIN_NUMBER = 1;
const MAX_NUMBER = 100;
const MAX_ATTEMPTS = 10;

const BASE_POINTS = 1000; // Starting points
const POINTS_DEDUCTION_PER_ATTEMPT = 50; // Points deducted per attempt
const BONUS_POINTS_QUICK_WIN = 500; // Bonus for winning in 3 or fewer attempts
const TIME_BONUS_THRESHOLD = 30; // Seconds threshold for time bonus
const TIME_BONUS_POINTS = 300; // Bonus points for quick completion

interface GuessHistoryItem {
  guess: number;
  feedback: string;
}

export function NumberGuessGame() {
  const [targetNumber, setTargetNumber] = useState<number>(0);
  const [currentGuess, setCurrentGuess] = useState<string>("");
  const [attempts, setAttempts] = useState<number>(0);
  const [guessHistory, setGuessHistory] = useState<GuessHistoryItem[]>([]);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [bestAttempts, setBestAttempts] = useState<number>(Infinity);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [isLoadingScores, setIsLoadingScores] = useState<boolean>(true);
  const [globalHighScore, setGlobalHighScore] = useState<number>(0);
  const [initializationComplete, setInitializationComplete] = useState(false);
  
  const { toast } = useToast();

  // Generate a random number between min and max
  const generateRandomNumber = useCallback(() => {
    return Math.floor(Math.random() * (MAX_NUMBER - MIN_NUMBER + 1)) + MIN_NUMBER;
  }, []);

  // Initialize the game
  const initializeGame = useCallback(() => {
    setTargetNumber(generateRandomNumber());
    setCurrentGuess("");
    setAttempts(0);
    setGuessHistory([]);
    setGameStatus("playing");
    setHasStarted(false); // Reset hasStarted
    setElapsedTime(0); // Reset elapsed time
  }, [generateRandomNumber]);

  // Modify the loadScores function in useEffect
  useEffect(() => {
    const loadScores = async () => {
      try {
        setIsLoadingScores(true);
        
        // Initialize the game regardless of score loading
        initializeGame();
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          console.error('Session error or no user:', sessionError);
          setIsLoadingScores(false);
          setInitializationComplete(true);
          return;
        }
        
        // Get both profile and top score in parallel
        const [profileResult, topScoreResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('score')
            .eq('id', session.user.id)
            .single(),
          supabase
            .from('profiles')
            .select('score')
            .order('score', { ascending: false })
            .limit(1)
            .single()
        ]);

        if (!profileResult.data) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              username: session.user.user_metadata.name || 
                       session.user.user_metadata.full_name || 
                       session.user.email?.split('@')[0] || 
                       'player',
              score: 0
            });

          if (insertError) throw insertError;
          
          setScore(0);
          setHighScore(0);
        } else {
          setScore(profileResult.data.score);
          setHighScore(profileResult.data.score);
        }

        setGlobalHighScore(topScoreResult.data?.score || 0);

      } catch (error: any) {
        console.error('Error loading scores:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to load scores",
          variant: "destructive",
        });
      } finally {
        setIsLoadingScores(false);
        setInitializationComplete(true);
      }
    };

    loadScores();

    const subscription = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadScores();
      }
    });

    return () => {
      subscription.data.subscription.unsubscribe();
    };
  }, [toast, initializeGame]);

  // Update score in Supabase
  const updateUserScore = async (newScore: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ score: newScore })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating score:', error);
      toast({
        title: "Error",
        description: "Failed to update score",
        variant: "destructive",
      });
    }
  };

  // Update high score if needed
  useEffect(() => {
    if (score > highScore && score > 0) {
      setHighScore(score);
      updateUserScore(score);
    }
  }, [score, highScore]);

  // Add this effect for real-time time updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (gameStatus === "playing" && hasStarted) {
      intervalId = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }

    // Cleanup interval on game end or component unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [gameStatus, hasStarted]);

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (isLoadingScores) {
        console.log('Loading timeout reached, forcing state update');
        setIsLoadingScores(false);
        setScore(0);
        setHighScore(0);
        setGlobalHighScore(0);
      }
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(loadingTimeout);
  }, [isLoadingScores]);

  // Handle guess submission
  const handleGuess = async () => {
    const guessNumber = parseInt(currentGuess, 10);
    
    // Validate input
    if (isNaN(guessNumber) || guessNumber < MIN_NUMBER || guessNumber > MAX_NUMBER) {
      toast({
        title: "Invalid Input",
        description: `Please enter a number between ${MIN_NUMBER} and ${MAX_NUMBER}.`,
        variant: "destructive",
      });
      return;
    }
    
    // Start the timer on first guess
    if (!hasStarted) {
      setHasStarted(true);
      setStartTime(Date.now());
    }
    
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    
    let feedback = "";
    
    // Check if guess is correct
    if (guessNumber === targetNumber) {
      feedback = "Correct!";
      setGameStatus("won");
      
      const timeTaken = (Date.now() - startTime) / 1000; // Convert to seconds
    
      // Calculate base score
      let newScore = BASE_POINTS - (attempts * POINTS_DEDUCTION_PER_ATTEMPT);
      
      // Add bonus for quick attempts
      if (attempts <= 3) {
        newScore += BONUS_POINTS_QUICK_WIN;
      }
      
      // Add time bonus
      if (timeTaken < TIME_BONUS_THRESHOLD) {
        newScore += TIME_BONUS_POINTS;
      }
      
      // Update best attempts if current attempt is better
      if (attempts < bestAttempts) {
        setBestAttempts(attempts);
      }
      
      const updatedTotalScore = score + newScore;
      setScore(updatedTotalScore);
      
      // Show detailed score breakdown
      toast({
        title: "Congratulations!",
        description: 
          `Base Score: ${BASE_POINTS}
           Attempts Penalty: -${attempts * POINTS_DEDUCTION_PER_ATTEMPT}
           ${attempts <= 3 ? `Quick Win Bonus: +${BONUS_POINTS_QUICK_WIN}` : ''}
           ${timeTaken < TIME_BONUS_THRESHOLD ? `Time Bonus: +${TIME_BONUS_POINTS}` : ''}
           Total Points: ${newScore}`,
      });
      
      // Update score in Supabase
      await updateUserScore(updatedTotalScore);
      
      toast({
        title: "Congratulations!",
        description: `You guessed the number in ${newAttempts} attempts! You earned ${newScore} points.`,
      });
    } else if (newAttempts >= MAX_ATTEMPTS) {
      feedback = `Too many attempts. The number was ${targetNumber}.`;
      setGameStatus("lost");
      
      toast({
        title: "Game Over",
        description: `You've used all ${MAX_ATTEMPTS} attempts. The number was ${targetNumber}.`,
        variant: "destructive",
      });
    } else if (guessNumber < targetNumber) {
      feedback = "Too low";
      
      toast({
        title: "Hint",
        description: "Your guess is too low. Try a higher number.",
      });
    } else {
      feedback = "Too high";
      
      toast({
        title: "Hint",
        description: "Your guess is too high. Try a lower number.",
      });
    }
    
    // Add to history
    setGuessHistory(prev => [...prev, { guess: guessNumber, feedback }]);
    
    // Clear input
    setCurrentGuess("");
  };

  // Start a new game
  const handleNewGame = () => {
    initializeGame();
    toast({
      title: "New Game",
      description: "A new number has been generated. Good luck!",
    });
  };

  return (
    <GameLayout>
      {!initializationComplete ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading game...</p>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10 text-center"
          >
            <h1 className="text-3xl font-bold mb-2 md:text-4xl">Number Guessing Game</h1>
            <p className="text-muted-foreground text-lg">
              Guess a number between {MIN_NUMBER} and {MAX_NUMBER}
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-5">
            {/* Game info and controls */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="md:col-span-3"
            >
              <Card className="shadow-card hover:shadow-card-hover transition-shadow duration-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Attempts</p>
                      <p className="text-2xl font-semibold">
                        {attempts} / {MAX_ATTEMPTS}
                      </p>
                    </div>
                    {/* <div>
                      <p className="text-sm text-muted-foreground">Score</p>
                      <p className="text-2xl font-semibold">{score}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">High Score</p>
                      <p className="text-2xl font-semibold">{highScore}</p>
                    </div> */}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Score</p>
                      <div className="text-2xl font-semibold">
                        {isLoadingScores ? (
                          <motion.div
                            animate={{ opacity: [0.5, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                            className="h-8 w-16 bg-muted rounded"
                          />
                        ) : (
                          score
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Personal Best</p>
                      <div className="text-2xl font-semibold">
                        {isLoadingScores ? (
                          <motion.div
                            animate={{ opacity: [0.5, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                            className="h-8 w-16 bg-muted rounded"
                          />
                        ) : highScore}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Global High Score</p>
                      <div className="text-2xl font-semibold">
                        {isLoadingScores ? (
                          <motion.div
                            animate={{ opacity: [0.5, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                            className="h-8 w-16 bg-muted rounded"
                          />
                        ) : globalHighScore}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="text-2xl font-semibold">
                        {gameStatus === "playing" 
                          ? hasStarted 
                            ? `${elapsedTime}s` 
                            : "0s"
                          : `${elapsedTime}s`}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <Label 
                      htmlFor="guess" 
                      className="text-base font-medium mb-2 block"
                    >
                      Enter your guess
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="guess"
                        type="number"
                        min={MIN_NUMBER}
                        max={MAX_NUMBER}
                        value={currentGuess}
                        onChange={(e) => setCurrentGuess(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && gameStatus === "playing" && handleGuess()}
                        placeholder="Enter a number"
                        className="h-12 text-lg"
                        disabled={gameStatus !== "playing"}
                      />
                      <Button 
                        onClick={handleGuess} 
                        disabled={gameStatus !== "playing" || !currentGuess}
                        className="h-12 px-6 font-medium"
                      >
                        Guess
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {gameStatus !== "playing" && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="mb-6"
                      >
                        <Card className={`${gameStatus === "won" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} p-4 text-center`}>
                          <h3 className="text-lg font-semibold mb-2">
                            {gameStatus === "won" ? "You won!" : "Game Over"}
                          </h3>
                          <p className={gameStatus === "won" ? "text-green-700" : "text-red-700"}>
                            {gameStatus === "won" 
                              ? `You guessed the number ${targetNumber} in ${attempts} attempts!` 
                              : `The number was ${targetNumber}. Better luck next time!`}
                          </p>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button 
                    onClick={handleNewGame} 
                    className={`w-full h-12 font-medium ${gameStatus !== "playing" ? "animate-pulse-soft" : ""}`}
                    variant={gameStatus !== "playing" ? "default" : "outline"}
                  >
                    {gameStatus !== "playing" ? "Play Again" : "Start New Game"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Guess history */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="md:col-span-2"
            >
              <Card className="shadow-card hover:shadow-card-hover transition-shadow duration-500 h-full">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Guess History</h2>
                  
                  {guessHistory.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No guesses yet. Start playing!
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {guessHistory.map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center font-medium">
                              {guessHistory.length - index}
                            </div>
                            <span className="font-medium">{item.guess}</span>
                          </div>
                          <span className={
                            item.feedback === "Correct!" 
                              ? "text-green-600 font-medium" 
                              : item.feedback === "Too low" 
                                ? "text-amber-600" 
                                : item.feedback === "Too high" 
                                  ? "text-blue-600" 
                                  : "text-red-600"
                          }>
                            {item.feedback}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      )}
    </GameLayout>
  );
}
