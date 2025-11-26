import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Star, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  client_name: string;
  is_public: boolean;
  created_at: string;
  booking_id: string;
}

interface ReviewsTabProps {
  userId: string;
}

const ReviewsTab = ({ userId }: ReviewsTabProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, [userId]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("creator_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReviews(data || []);
      
      // Calculate average rating
      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  const togglePublic = async (reviewId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("reviews")
        .update({ is_public: !currentStatus })
        .eq("id", reviewId);

      if (error) throw error;

      setReviews(reviews.map(r => 
        r.id === reviewId ? { ...r, is_public: !currentStatus } : r
      ));

      toast.success(currentStatus ? "Review hidden from public" : "Review made public");
    } catch (error: any) {
      console.error("Error updating review:", error);
      toast.error("Failed to update review");
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const publicReviews = reviews.filter(r => r.is_public);
  const hiddenReviews = reviews.filter(r => !r.is_public);

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle>Reviews Overview</CardTitle>
          <CardDescription>Manage client feedback and ratings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{averageRating || "N/A"}</div>
              <div className="flex justify-center my-2">
                {averageRating > 0 && renderStars(Math.round(averageRating))}
              </div>
              <p className="text-sm text-muted-foreground">Average Rating</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{reviews.length}</div>
              <p className="text-sm text-muted-foreground">Total Reviews</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{publicReviews.length}</div>
              <p className="text-sm text-muted-foreground">Public Reviews</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No reviews yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Reviews will appear here after clients complete their bookings
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {publicReviews.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Public Reviews ({publicReviews.length})
              </h3>
              {publicReviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="font-medium">{review.client_name}</div>
                          <Badge variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            Public
                          </Badge>
                          {renderStars(review.rating)}
                        </div>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`public-${review.id}`} className="sr-only">
                          Public visibility
                        </Label>
                        <Switch
                          id={`public-${review.id}`}
                          checked={review.is_public}
                          onCheckedChange={() => togglePublic(review.id, review.is_public)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {hiddenReviews.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <EyeOff className="h-5 w-5" />
                Hidden Reviews ({hiddenReviews.length})
              </h3>
              {hiddenReviews.map((review) => (
                <Card key={review.id} className="opacity-60">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="font-medium">{review.client_name}</div>
                          <Badge variant="secondary">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Hidden
                          </Badge>
                          {renderStars(review.rating)}
                        </div>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`hidden-${review.id}`} className="sr-only">
                          Public visibility
                        </Label>
                        <Switch
                          id={`hidden-${review.id}`}
                          checked={review.is_public}
                          onCheckedChange={() => togglePublic(review.id, review.is_public)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewsTab;
