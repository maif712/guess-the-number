import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameLayout } from "@/components/game/GameLayout";
import { motion } from "framer-motion";
import { Trophy, ArrowUp, ArrowDown, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface LeaderboardEntry {
  username: string;
  score: number;
  rank?: number; // Added for display purposes
}

export function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        setIsLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
            
          if (userProfile) {
            setCurrentUserName(userProfile.username);
          }
        }

        // Get all scores
        const { data: scores, error } = await supabase
          .from('profiles')
          .select('username, score')
          .order('score', { ascending: sortOrder === 'asc' });

        if (error) throw error;

        // Add rank to the scores
        const rankedData = scores.map((entry, index) => ({
          ...entry,
          rank: index + 1
        }));

        setLeaderboardData(rankedData);
      } catch (error: any) {
        console.error('Error fetching leaderboard:', error);
        toast({
          title: "Error",
          description: "Failed to load leaderboard data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboardData();
  }, [sortOrder]);

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
  };

  return (
    <GameLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 text-center"
        >
          <h1 className="text-3xl font-bold mb-2 md:text-4xl">Leaderboard</h1>
          <p className="text-muted-foreground text-lg">
            See who's leading the number guessing game
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="shadow-card hover:shadow-card-hover transition-shadow duration-500">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Top Players</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleSortOrder}
                  className="flex items-center gap-2"
                >
                  {sortOrder === "desc" ? (
                    <>
                      <span>Highest First</span>
                      <ArrowDown className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <span>Lowest First</span>
                      <ArrowUp className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading leaderboard...</p>
                </div>
              ) : leaderboardData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No scores available yet.</p>
                  <Button asChild>
                    <a href="/game">Play the Game</a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-12 py-3 px-4 font-medium text-sm text-muted-foreground">
                    <div className="col-span-2 text-center">Rank</div>
                    <div className="col-span-6">Player</div>
                    <div className="col-span-4 text-right">Score</div>
                  </div>
                  
                  {leaderboardData.map((entry, index) => {
                    const isCurrentUser = entry.username === currentUserName;
                    return (
                      <motion.div
                        key={entry.username}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                          duration: 0.4, 
                          delay: 0.1 + index * 0.05, 
                          ease: [0.16, 1, 0.3, 1] 
                        }}
                        className={`grid grid-cols-12 py-4 px-4 rounded-lg ${
                          isCurrentUser ? "bg-primary/5 border border-primary/20" : 
                          index % 2 === 0 ? "bg-muted/30" : "bg-background"
                        } ${entry.rank === 1 ? "animate-pulse-soft" : ""}`}
                      >
                        <div className="col-span-2 flex justify-center">
                          {entry.rank === 1 ? (
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                              <Trophy className="h-4 w-4 text-amber-600" />
                            </div>
                          ) : (
                            <div className={`w-8 h-8 rounded-full ${
                              entry.rank === 2 ? "bg-slate-100" : 
                              entry.rank === 3 ? "bg-orange-100" : "bg-muted/50"
                            } flex items-center justify-center font-medium ${
                              entry.rank === 2 ? "text-slate-600" : 
                              entry.rank === 3 ? "text-orange-600" : ""
                            }`}>
                              {entry.rank}
                            </div>
                          )}
                        </div>
                        <div className="col-span-6 flex items-center font-medium">
                          <div className="w-8 h-8 rounded-full bg-primary/10 mr-3 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary/80" />
                          </div>
                          <span className={isCurrentUser ? "font-semibold" : ""}>
                            {entry.username} {isCurrentUser && <span className="text-xs font-normal text-muted-foreground">(You)</span>}
                          </span>
                        </div>
                        <div className="col-span-4 text-right font-semibold text-lg flex items-center justify-end">
                          {entry.score.toLocaleString()}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </GameLayout>
  );
}
