import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Star, Loader2, CheckCircle } from "lucide-react";

const ReviewPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (bookingId) fetchBooking();
  }, [bookingId]);

  const fetchBooking = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          services (title),
          profiles:creator_id (full_name, business_name)
        `)
        .eq("id", bookingId)
        .single();

      if (error) throw error;

      // Check if review already exists
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", bookingId)
        .maybeSingle();

      if (existingReview) {
        setSubmitted(true);
      }

      setBooking(data);
    } catch (error: any) {
      console.error("Error fetching booking:", error);
      toast.error("Booking not found");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setSubmitting(true);

    try {
      const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
      const profile = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;

      const { data: review, error } = await supabase.from("reviews").insert({
        booking_id: bookingId!,
        creator_id: booking.creator_id,
        rating,
        comment: comment.trim() || null,
        client_name: booking.client_name,
        is_public: true,
      }).select().single();

      if (error) throw error;

      // Notify business owner about the review
      try {
        await supabase.functions.invoke("notify-review-submission", {
          body: {
            reviewId: review.id,
            bookingId: bookingId,
            rating,
            creatorId: booking.creator_id,
          },
        });
      } catch (notifyError) {
        console.error("Error sending review notification:", notifyError);
        // Don't fail the review submission if notification fails
      }

      setSubmitted(true);
      toast.success("Thank you for your feedback!");
    } catch (error: any) {
      console.error("Error submitting review:", error);
      if (error.code === "23505") {
        toast.error("You've already submitted a review for this booking");
        setSubmitted(true);
      } else {
        toast.error("Failed to submit review");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Booking not found</p>
            <Button onClick={() => navigate("/")} className="w-full mt-4">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
  const profile = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;
  const creatorName = profile.business_name || profile.full_name;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 gradient-subtle">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-500/10 p-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-2xl">Thank You!</CardTitle>
            <CardDescription className="mt-2">
              Your review has been submitted successfully
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-subtle py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Leave a Review</CardTitle>
            <CardDescription>
              Share your experience with {creatorName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Booking Info */}
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{service.title}</p>
                <p className="text-sm text-muted-foreground">
                  with {creatorName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(booking.booking_date).toLocaleDateString()}
                </p>
              </div>

              {/* Rating */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label>Rating *</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-10 w-10 ${
                            star <= (hoveredRating || rating)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {rating === 5 && "Excellent!"}
                      {rating === 4 && "Very Good!"}
                      {rating === 3 && "Good"}
                      {rating === 2 && "Fair"}
                      {rating === 1 && "Needs Improvement"}
                    </p>
                  )}
                </div>

                {/* Comment */}
                <div className="space-y-2">
                  <Label htmlFor="comment">Comment (Optional)</Label>
                  <Textarea
                    id="comment"
                    placeholder="Share more about your experience..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={5}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting || rating === 0}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Review
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReviewPage;
