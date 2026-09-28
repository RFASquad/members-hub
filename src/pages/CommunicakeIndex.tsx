import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cckStore, CckMember, isStaff } from "@/lib/store";
import { differenceInDays, format } from "date-fns";
import { CheckCircle2 } from "lucide-react";

function StatSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-muted" />
      </div>
      <div className="h-8 w-16 bg-muted rounded mb-2" />
      <div className="h-3 w-20 bg-muted rounded" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center px-2 py-2 rounded-md">
      <div className="h-4 w-32 bg-muted rounded" />
      <div className="ml-auto h-4 w-12 bg-muted rounded" />
      <div className="ml-4 h-4 w-8 bg-muted rounded" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="h-3 w-40 bg-muted rounded mb-4" />
      <div className="space-y-2">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </div>
  );
}

const formatDateStr = (dateStr: string) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, "MM/dd/yyyy");
  } catch {
    return dateStr;
  }
};

const getDaysLeft = (dateStr: string) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return differenceInDays(d, new Date());
  } catch {
    return null;
  }
};

export default function CommunicakeIndex() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<CckMember[] | null>(null);

  useEffect(() => {
    cckStore.getMembers().then((data) => setMembers(data));
  }, []);

  const staff = isStaff();

  if (members === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-[34px] font-bold text-foreground tracking-tight">
          Command Center
        </h1>
        <div className="grid grid-cols-4 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const activeMembers = members.filter(
    (m) => m.status?.toLowerCase() === "active",
  );
  const pastDueMembers = members.filter(
    (m) => m.status?.toLowerCase() === "past due",
  );
  const trialingMembers = members.filter(
    (m) => m.status?.toLowerCase() === "trialing",
  );

  const trialsExpiringSoon = members
    .filter((m) => {
      if (m.status?.toLowerCase() !== "trialing" || !m.trial_end) return false;
      try {
        const trialEnd = new Date(m.trial_end);
        if (isNaN(trialEnd.getTime())) return false;
        const diff = differenceInDays(trialEnd, new Date());
        return diff >= 0 && diff <= 7;
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      const dA = getDaysLeft(a.trial_end) ?? 99;
      const dB = getDaysLeft(b.trial_end) ?? 99;
      return dA - dB;
    });

  const recentlyCanceled = members.filter((m) => {
    if (m.status?.toLowerCase() !== "canceled") return false;
    try {
      if (!m.updated_at) return true;
      const canceledDate = new Date(m.updated_at);
      if (isNaN(canceledDate.getTime())) return true;
      return differenceInDays(new Date(), canceledDate) <= 30;
    } catch {
      return true;
    }
  });

  const newMembers = members
    .filter((m) => {
      if (!m.subscription_start) return false;
      try {
        const joined = new Date(m.subscription_start);
        if (isNaN(joined.getTime())) return false;
        return differenceInDays(new Date(), joined) <= 30;
      } catch {
        return false;
      }
    })
    .sort(
      (a, b) =>
        new Date(b.subscription_start).getTime() -
        new Date(a.subscription_start).getTime(),
    );

  const totalMRR = activeMembers.reduce((acc, m) => {
    const amount = m.plan_amount_display
      ? parseInt(m.plan_amount_display.replace(/[^0-9]/g, "")) || 0
      : 0;
    return acc + amount;
  }, 0);

  const allStatCards = [
    {
      label: "Active",
      value: activeMembers.length,
      dot: "#10B981",
      onClick: () =>
        navigate("/communicake/members", { state: { statusFilter: "active" } }),
      clickable: true,
    },
    {
      label: "Trialing",
      value: trialingMembers.length,
      dot: "#3B82F6",
    },
    {
      label: "MRR",
      value: "$" + totalMRR.toLocaleString(),
      dot: "#D4A82C",
      isMRR: true,
    },
    {
      label: "Past Due",
      value: pastDueMembers.length,
      dot: "#EF4444",
    },
  ];

  // Staff can't see financial data — hide MRR tile entirely
  const statCards = staff ? allStatCards.filter((c) => !c.isMRR) : allStatCards;

  return (
    <div className="space-y-6">
      <h1 className="text-[34px] font-bold text-foreground tracking-tight">
        Command Center
      </h1>

      <div
        className={staff ? "grid grid-cols-3 gap-4" : "grid grid-cols-4 gap-4"}
      >
        {statCards.map((stat, i) => (
          <div
            key={i}
            onClick={stat.onClick}
            className={
              stat.clickable
                ? "cursor-pointer hover:border-primary/30 transition-colors"
                : ""
            }
          >
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: stat.dot,
                  }}
                />
              </div>
              <div className="text-3xl font-bold text-foreground tracking-tight">
                {stat.value}
              </div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mt-1">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4">
            Trials Expiring Soon
          </h3>
          {trialsExpiringSoon.length === 0 ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm">No trials expiring this week</span>
            </div>
          ) : (
            <>
              <div
                className="grid px-2 mb-2"
                style={{
                  gridTemplateColumns: staff ? "1fr auto" : "1fr auto auto",
                }}
              >
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                  Member
                </span>
                {!staff && (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right pr-4">
                    Plan
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right">
                  Ends
                </span>
              </div>
              <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
                {trialsExpiringSoon.map((member) => {
                  const daysLeft = getDaysLeft(member.trial_end) ?? 0;
                  const badgeColor = daysLeft <= 3 ? "#EF4444" : "#F59E0B";
                  return (
                    <div
                      key={member.id}
                      className="grid items-center px-2 py-2 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors"
                      style={{
                        gridTemplateColumns: staff
                          ? "1fr auto"
                          : "1fr auto auto",
                      }}
                      onClick={() =>
                        navigate(`/communicake/members/${member.id}`)
                      }
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-medium truncate text-foreground">
                          {member.name}
                        </p>
                      </div>
                      {!staff && (
                        <div className="pr-4">
                          <span className="text-xs text-muted-foreground">
                            {member.plan_amount_display || "—"}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDateStr(member.trial_end)}
                        </span>
                        <span
                          style={{
                            color: badgeColor,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {daysLeft}d
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4">
            Recently Canceled
          </h3>
          {recentlyCanceled.length === 0 ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm">No cancellations this month</span>
            </div>
          ) : (
            <>
              <div
                className="grid px-2 mb-2"
                style={{
                  gridTemplateColumns: staff ? "1fr auto" : "1fr auto auto",
                }}
              >
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                  Member
                </span>
                {!staff && (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right pr-4">
                    Plan
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right">
                  Canceled
                </span>
              </div>
              <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
                {recentlyCanceled.map((member) => (
                  <div
                    key={member.id}
                    className="grid items-center px-2 py-2 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors"
                    style={{
                      gridTemplateColumns: staff ? "1fr auto" : "1fr auto auto",
                    }}
                    onClick={() =>
                      navigate(`/communicake/members/${member.id}`)
                    }
                  >
                    <p className="text-sm font-medium truncate text-foreground pr-3">
                      {member.name}
                    </p>
                    {!staff && (
                      <span className="text-xs font-medium text-muted-foreground pr-4">
                        {member.plan_amount_display || "—"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateStr(member.updated_at)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4">
            Past Due
          </h3>
          {pastDueMembers.length === 0 ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm">All clear — no past due members</span>
            </div>
          ) : (
            <>
              <div
                className="grid px-2 mb-2"
                style={{
                  gridTemplateColumns: staff ? "1fr auto" : "1fr auto auto",
                }}
              >
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                  Member
                </span>
                {!staff && (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right pr-4">
                    Plan
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right">
                  Since
                </span>
              </div>
              <div className="space-y-0.5 max-h-[260px] overflow-y-auto">
                {pastDueMembers.map((member) => (
                  <div
                    key={member.id}
                    className="grid items-center px-2 py-2 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors"
                    style={{
                      gridTemplateColumns: staff ? "1fr auto" : "1fr auto auto",
                    }}
                    onClick={() =>
                      navigate(`/communicake/members/${member.id}`)
                    }
                  >
                    <p className="text-sm font-medium truncate text-foreground pr-3">
                      {member.name}
                    </p>
                    {!staff && (
                      <span className="text-xs font-medium text-muted-foreground pr-4">
                        {member.plan_amount_display || "—"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateStr(member.subscription_start)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4">
            New Members — Last 30 Days
          </h3>
          {newMembers.length === 0 ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <span className="text-sm">No new members this month</span>
            </div>
          ) : (
            <>
              <div
                className="grid px-2 mb-2"
                style={{
                  gridTemplateColumns: staff ? "1fr auto" : "1fr auto auto",
                }}
              >
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                  Member
                </span>
                {!staff && (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right pr-4">
                    Plan
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right">
                  Joined
                </span>
              </div>
              <div className="space-y-0.5 max-h-[260px] overflow-y-auto">
                {newMembers.map((member) => (
                  <div
                    key={member.id}
                    className="grid items-center px-2 py-2 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors"
                    style={{
                      gridTemplateColumns: staff ? "1fr auto" : "1fr auto auto",
                    }}
                    onClick={() =>
                      navigate(`/communicake/members/${member.id}`)
                    }
                  >
                    <p className="text-sm font-medium truncate text-foreground pr-3">
                      {member.name}
                    </p>
                    {!staff && (
                      <span className="text-xs font-medium text-muted-foreground pr-4">
                        {member.plan_amount_display || "—"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateStr(member.subscription_start)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
