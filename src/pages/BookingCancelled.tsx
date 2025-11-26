import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";

export default function BookingCancelled() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get("bookingId");

  return (
    <div className="min-h-screen gradient-subtle py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="glass-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-yellow-500/10 p-4">
                <XCircle className="h-16 w-16 text-yellow-500" />
              </div>
            </div>
            <CardTitle className="text-3xl">Booking Cancelled</CardTitle>
            <p className="text-muted-foreground mt-2">
              Your payment was cancelled and no charges were made
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <p className="text-muted-foreground">
                The booking time slot has been released and is now available for others.
                You can try booking again if you'd like.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={() => navigate(-1)} className="w-full">
                Try Again
              </Button>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full"
              >
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
