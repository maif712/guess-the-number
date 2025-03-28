import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PointsPurchase } from "./PointsPurchase";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { GameLayout } from "@/components/game/GameLayout";
import { supabase } from "@/lib/supabase";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Coins } from "lucide-react";

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
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [highestStreak, setHighestStreak] = useState<number>(0);
  const [streakMultiplier, setStreakMultiplier] = useState<number>(1.0);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchasedPoints, setPurchasedPoints] = useState(0);
  const HINT_COST = 100;

  const { toast } = useToast();

  // Get a random hint
  const getRandomHint = useCallback(() => {
    if (targetNumber <= 0) return null;

    const hints = [];
    hints.push(`The number is ${targetNumber % 2 === 0 ? 'even' : 'odd'}`);
    hints.push(`The number is ${targetNumber > 50 ? 'greater' : 'less'} than 50`);

    if (targetNumber % 5 === 0) hints.push('The number is a multiple of 5');
    if ([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37,
      41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97].includes(targetNumber)) {
      hints.push('The number is prime');
    }

    const rangeSize = 25;
    const minRange = Math.floor((targetNumber - 1) / rangeSize) * rangeSize + 1;
    hints.push(`The number is between ${minRange} and ${minRange + rangeSize - 1}`);

    return hints[Math.floor(Math.random() * hints.length)];
  }, [targetNumber]);

  // Handle hint purchase
  const handleHint = useCallback(async () => {
    if (purchasedPoints < HINT_COST) {
      toast({
        title: "Not Enough Points",
        description: `You need ${HINT_COST} hint points to get a hint`,
        variant: "destructive",
      });
      return;
    }

    const hint = getRandomHint();
    if (hint) {
      const newPoints = purchasedPoints - HINT_COST;
      setPurchasedPoints(newPoints);

      // Update points in Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ purchased_points: newPoints })
            .eq('id', user.id);
        }
      } catch (error) {
        console.error('Error updating points:', error);
      }

      toast({ title: "Hint", description: hint });
    }
  }, [purchasedPoints, getRandomHint, toast]);



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
    setHasStarted(false);
    setElapsedTime(0);
    // Don't reset streak here - persists between games
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
          setScore(0);
          setHighScore(0);
          setPurchasedPoints(0);
          setIsLoadingScores(false);
          setInitializationComplete(true);
          return;
        }

        // Get both profile and top score in parallel
        const [profileResult, topScoreResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('score, current_streak, highest_streak, last_win_date, purchased_points')
            .eq('id', session.user.id)
            .single(),
          supabase
            .from('profiles')
            .select('score')
            .order('score', { ascending: false })
            .limit(1)
            .single()
        ]);

        // Initialize streak state
        if (profileResult.data) {
          // Check if streak should be reset (more than 24h since last win)
          const shouldResetStreak = profileResult.data.last_win_date
            ? (Date.now() - new Date(profileResult.data.last_win_date).getTime()) > 86400000
            : true;

          const initialStreak = shouldResetStreak ? 0 : profileResult.data.current_streak;
          setCurrentStreak(initialStreak);
          setHighestStreak(profileResult.data.highest_streak);
          setStreakMultiplier(calculateMultiplier(initialStreak));
        }

        if (!profileResult.data) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              username: session.user.user_metadata.name ||
                session.user.user_metadata.full_name ||
                session.user.email?.split('@')[0] ||
                'player',
              score: 0,
              purchased_points: 0
            });

          if (insertError) throw insertError;

          setScore(0);
          setHighScore(0);
          setPurchasedPoints(0);
        } else {
          setScore(profileResult.data.score);
          setHighScore(profileResult.data.score);
          setPurchasedPoints(profileResult.data.purchased_points || 0);
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

    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Reset all game state on logout
        setScore(0);
        setHighScore(0);
        setPurchasedPoints(0);
        setCurrentStreak(0);
        setGlobalHighScore(0);
        initializeGame();
      } else if (event === 'SIGNED_IN') {
        loadScores();
      }
    });

    return () => {
      // subscription.data.subscription.unsubscribe();

      if (subscription?.data?.subscription) {
        subscription.data.subscription.unsubscribe();
      }
    };
  }, [toast, initializeGame]);

  // Calculate streak multiplier
  const calculateMultiplier = (streak: number): number => {
    if (streak >= 4) return 1.5;
    if (streak === 3) return 1.25;
    if (streak === 2) return 1.1;
    return 1.0;
  };

  // Update score and streaks in Supabase
  const updateUserScore = async (newScore: number, wonGame: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updateData: any = { score: newScore };

      if (wonGame) {
        const newStreak = currentStreak + 1;
        updateData.current_streak = newStreak;
        updateData.last_win_date = new Date().toISOString();

        if (newStreak > highestStreak) {
          updateData.highest_streak = newStreak;
        }
      } else {
        updateData.current_streak = 0;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating score:', error);
      toast({
        title: "Error",
        description: "Failed to update score and streaks",
        variant: "destructive",
      });
    }
  };

  // Update high score if needed
  useEffect(() => {
    if (score > highScore && score > 0) {
      setHighScore(score);
      updateUserScore(score, false);
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
      let newScore = (BASE_POINTS - (attempts * POINTS_DEDUCTION_PER_ATTEMPT)) * streakMultiplier;

      // Add bonus for quick attempts
      if (attempts <= 3) {
        newScore += BONUS_POINTS_QUICK_WIN * streakMultiplier;
      }

      // Add time bonus
      if (timeTaken < TIME_BONUS_THRESHOLD) {
        newScore += TIME_BONUS_POINTS * streakMultiplier;
      }

      // Update streak
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      if (newStreak > highestStreak) {
        setHighestStreak(newStreak);
      }
      const newMultiplier = calculateMultiplier(newStreak);
      setStreakMultiplier(newMultiplier);

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
           Streak Multiplier: ${streakMultiplier}x
           Total Points: ${newScore}`,
      });

      // Update score and streaks in Supabase
      await updateUserScore(updatedTotalScore, true);

      toast({
        title: "Congratulations!",
        description: `You guessed the number in ${newAttempts} attempts! You earned ${newScore} points.`,
      });
    } else if (newAttempts >= MAX_ATTEMPTS) {
      feedback = `Too many attempts. The number was ${targetNumber}.`;
      setGameStatus("lost");

      // Reset streak
      setCurrentStreak(0);
      setStreakMultiplier(1.0);
      await updateUserScore(score, false);

      toast({
        title: "Game Over",
        description: `You've used all ${MAX_ATTEMPTS} attempts. The number was ${targetNumber}. Your streak has been reset.`,
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

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Streak</p>
                      <div className="text-2xl font-semibold">
                        {currentStreak}
                        {streakMultiplier > 1 && (
                          <span className="text-xs text-green-500 ml-1">({streakMultiplier}x)</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Game Score</p>
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
                      <p className="text-sm text-muted-foreground">Hint Points</p>
                      <div className="text-2xl font-semibold">
                        {isLoadingScores ? (
                          <motion.div
                            animate={{ opacity: [0.5, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                            className="h-8 w-16 bg-muted rounded"
                          />
                        ) : (
                          purchasedPoints
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
                      <div className="flex gap-2">
                        <Button
                          onClick={handleGuess}
                          disabled={gameStatus !== "playing" || !currentGuess}
                          className="h-12 px-6 font-medium"
                        >
                          Guess
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              onClick={handleHint}
                              disabled={gameStatus !== "playing"}
                              className="h-12 px-4 font-medium relative bg-gradient-to-br from-blue-500 to-purple-600 text-white border-2 border-white/50 hover:border-white/80 hover:from-blue-400 hover:to-purple-500 transition-all duration-300 shadow-lg hover:shadow-blue-500/30"
                            >
                              <div className="flex items-center gap-2">
                                <Coins className="w-5 h-5 text-yellow-300" />
                                <span>Hint</span>
                                <span className="absolute -top-2 -right-2 bg-yellow-500 text-white text-sm font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-yellow-600 shadow-md">
                                  {HINT_COST}
                                </span>
                              </div>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-blue-600 text-white border-blue-700">
                            {purchasedPoints >= HINT_COST 
                              ? "Get a helpful hint for 100 points" 
                              : "Not enough points for a hint"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
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

                  <div className="flex gap-2">
                    <Button
                      onClick={handleNewGame}
                      className={`h-12 font-medium flex-1 ${gameStatus !== "playing" ? "animate-pulse-soft" : ""}`}
                      variant={gameStatus !== "playing" ? "default" : "outline"}
                    >
                      {gameStatus !== "playing" ? "Play Again" : "New Game"}
                    </Button>
                    <Button
                      onClick={() => setShowPurchaseModal(true)}
                      variant="secondary"
                      className="h-12 font-medium"
                    >
                      Buy Points
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {showPurchaseModal && (
              <PointsPurchase
                onClose={() => setShowPurchaseModal(false)}
                onPurchase={(points) => {
                  setPurchasedPoints(prev => prev + points);
                  toast({
                    title: "Points Added",
                    description: `${points} points have been added to your account!`,
                  });
                }}
              />
            )}

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
