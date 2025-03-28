import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";

const POINTS_PACKAGES = [
  { id: 1, points: 500, price: "$1.00" },
  { id: 2, points: 1200, price: "$2.00" },
  { id: 3, points: 2500, price: "$4.00" },
];

export function PointsPurchase({ onClose, onPurchase }: {
  onClose: () => void;
  onPurchase: (points: number) => void;
}) {
  const { toast } = useToast();

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);

  const handlePurchase = async (points: number, pkgId: number) => {
    setIsPurchasing(true);
    setSelectedPackage(pkgId);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Call our RPC function
      const { data, error } = await supabase.rpc('add_points', {
        user_id: user.id,
        points_to_add: points
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Purchase failed");

      toast({
        title: "Success",
        description: `Added ${points} points to your account! New total: ${data.new_points}`,
      });
      onPurchase(points);
      setIsPurchasing(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to purchase points",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Buy Points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {POINTS_PACKAGES.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">{pkg.points} points</h3>
                  <p className="text-sm text-muted-foreground">{pkg.price}</p>
                </div>
                <Button 
                  onClick={() => handlePurchase(pkg.points, pkg.id)}
                  disabled={isPurchasing}
                >
                  {isPurchasing && selectedPackage === pkg.id ? (
                    <span className="animate-spin">↻</span>
                  ) : (
                    "Get Points"
                  )}
                </Button>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={onClose}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
