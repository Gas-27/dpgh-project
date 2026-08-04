import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2, Clock, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { ComplaintNotesThread } from "@/components/ComplaintNotesThread";

interface UserComplaint {
  id: string;
  complaint_title: string;
  complaint_details: string;
  complaint_type: string;
  status: "pending" | "in-progress" | "resolved";
  created_at: string;
  orders?: {
    network: string;
    size_gb: number;
    amount: number;
  };
}

interface UserComplaintsViewProps {
  userId: string;
}

export function UserComplaintsView({ userId }: UserComplaintsViewProps) {
  const [complaints, setComplaints] = useState<UserComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!userId) return;
    const fetchComplaints = async () => {
      try {
        // Try to fetch complaints by customer's order IDs
        const { data: orders } = await supabase
          .from("orders")
          .select("id")
          .eq("customer_id", userId);

        const orderIds = (orders ?? []).map((o: any) => o.id);

        let query = supabase
          .from("complaints")
          .select("id, complaint_title, complaint_details, complaint_type, status, created_at, orders(network, size_gb, amount)")
          .order("created_at", { ascending: false });

        if (orderIds.length > 0) {
          query = query.in("order_id", orderIds);
        } else {
          // No orders found — empty result
          setComplaints([]);
          setLoading(false);
          return;
        }

        const { data, error } = await query;
        if (error) throw error;
        setComplaints((data ?? []) as UserComplaint[]);
      } catch (e) {
        console.error("[v0] UserComplaintsView fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, [userId]);

  const getStatusIcon = (status: string) => {
    if (status === "resolved") return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    if (status === "in-progress") return <Clock className="h-4 w-4 text-amber-400" />;
    return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (status: string) => {
    if (status === "resolved")
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Resolved</Badge>;
    if (status === "in-progress")
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">In Progress</Badge>;
    return <Badge className="bg-muted text-muted-foreground text-xs">Pending</Badge>;
  };

  const networkName = (n: string) => {
    const map: Record<string, string> = {
      MTN_EXPRESS: "MTN Express", MTN: "MTN", VODAFONE: "Vodafone",
      AIRTELTIGO: "AirtelTigo", TELECEL: "Telecel",
    };
    return map[n] || n;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">My Complaints</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Track your complaint status and view messages from our support team.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">Loading complaints...</div>
      ) : complaints.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No complaints filed yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              You can file a complaint from the Orders section if your data was not received.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {complaints.map((complaint) => {
            const isOpen = expanded === complaint.id;
            const pendingNotes = pendingCounts[complaint.id] ?? 0;

            return (
              <Card
                key={complaint.id}
                className={`border-border transition-colors ${isOpen ? "border-primary/30" : ""}`}
              >
                <CardContent className="p-0">
                  {/* Header row — click to expand */}
                  <button
                    className="w-full text-left p-4 flex items-start justify-between gap-3"
                    onClick={() => setExpanded(isOpen ? null : complaint.id)}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {getStatusIcon(complaint.status)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {complaint.complaint_title}
                          </p>
                          {getStatusBadge(complaint.status)}
                          {pendingNotes > 0 && (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                              {pendingNotes} question{pendingNotes > 1 ? "s" : ""} from admin
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {complaint.orders && (
                            <span className="text-xs text-muted-foreground">
                              {networkName(complaint.orders.network)} {complaint.orders.size_gb}GB
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Filed {new Date(complaint.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-muted-foreground mt-0.5">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-4">
                      <Separator />
                      {/* Complaint details */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Your Complaint
                        </p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {complaint.complaint_details}
                        </p>
                      </div>
                      <Separator />
                      {/* Notes thread — user (not admin) view */}
                      <ComplaintNotesThread
                        complaintId={complaint.id}
                        isAdmin={false}
                        onPendingCountChange={(count) =>
                          setPendingCounts((prev) => ({ ...prev, [complaint.id]: count }))
                        }
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
