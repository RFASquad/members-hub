import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  memberStore,
  Member,
  parseDollar,
  formatDollar,
  isStaff,
} from "@/lib/store";
import { differenceInDays, format } from "date-fns";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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

export default function Index() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[] | null>(null);

  useEffect(() => {
    memberStore.getMembers().then((data) => setMembers(data));
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
    (m) => m.status === "Active" || m.status === "Renewed",
  );
  const recentlyExpiredMembers = members
    .filter((m) => {
      if (m.status === "Renewed") return false;
      if (!m.expires) return false;
      try {
        const expiry = new Date(m.expires);
        const diff = differenceInDays(new Date(), expiry);
        return diff > 0 && diff <= 30;
      } catch {
        return false;
      }
    })
    .sort(
      (a, b) => new Date(b.expires).getTime() - new Date(a.expires).getTime(),
    );

  const expiringMembers = members
    .filter((m) => {
      if (!["Active", "Renewed", "On Extension"].includes(m.status))
        return false;
      if (!m.expires) return false;
      try {
        const expiry = new Date(m.expires);
        const diff = differenceInDays(expiry, new Date());
        return diff >= 0 && diff <= 30;
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      const diffA = differenceInDays(new Date(a.expires), new Date());
      const diffB = differenceInDays(new Date(b.expires), new Date());
      return diffA - diffB;
    });

  const newMembersList = members
    .filter((m) => {
      if (!m.joined) return false;
      if (m.status === "Pending") return false;
      if (m.status !== "Active") return false;
      try {
        const joined = new Date(m.joined);
        if (isNaN(joined.getTime())) return false;
        const diff = differenceInDays(new Date(), joined);
        return diff >= 0 && diff <= 30;
      } catch {
        return false;
      }
    })
    .sort(
      (a, b) => new Date(b.joined).getTime() - new Date(a.joined).getTime(),
    );

  const totalMRR = members.reduce((acc, m) => {
    if (m.stripe_status?.toLowerCase() === "active" && m.stripe_plan_display) {
      const match = m.stripe_plan_display.match(/\$?([\d,]+(\.\d+)?)/);
      if (match) {
        return acc + parseFloat(match[1].replace(/,/g, ""));
      }
    }
    return acc;
  }, 0);

  const allStatCards = [
    {
      label: "Active",
      value: activeMembers.length,
      dot: "#10B981",
      onClick: () =>
        navigate("/members", { state: { statusFilter: "active" } }),
      clickable: true,
    },
    {
      label: "Expiring Soon",
      value: expiringMembers.length,
      dot: "#F59E0B",
    },
    {
      label: "MRR",
      value: formatDollar(totalMRR),
      dot: "#D4A82C",
      isMRR: true,
    },
    {
      label: "Recently Expired",
      value: recentlyExpiredMembers.length,
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
            Stripe Past Due
          </h3>
          {(() => {
            const stripePastDue = members.filter(
              (m) => m.stripe_status?.toLowerCase() === "past due",
            );
            if (stripePastDue.length === 0) {
              return (
                <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm">No past due payments</span>
                </div>
              );
            }
            return (
              <>
                <div
                  className="grid px-2 mb-2"
                  style={{ gridTemplateColumns: "1fr auto" }}
                >
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                    Member
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right">
                    Plan
                  </span>
                </div>
                <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
                  {stripePastDue.map((member) => (
                    <div
                      key={member.id}
                      className="grid items-center px-2 py-2 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors"
                      style={{ gridTemplateColumns: "1fr auto" }}
                      onClick={() => navigate(`/members/${member.id}`)}
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-medium truncate text-foreground">
                          {member.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-red-500">
                          {member.stripe_plan_display || "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4">
            Expiring Soon
          </h3>
          {expiringMembers.length === 0 ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm">No members expiring this month</span>
            </div>
          ) : (
            <>
              <div
                className="grid px-2 mb-2"
                style={{ gridTemplateColumns: "1fr auto auto" }}
              >
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                  Member
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right pr-4">
                  Expires
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right">
                  Left
                </span>
              </div>
              <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
                {expiringMembers.map((member) => {
                  const daysLeft = getDaysLeft(member.expires) ?? 0;
                  const badgeColor =
                    daysLeft <= 7
                      ? "#EF4444"
                      : daysLeft <= 14
                        ? "#F59E0B"
                        : "#3B82F6";
                  return (
                    <div
                      key={member.id}
                      className="grid items-center px-2 py-2 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors"
                      style={{ gridTemplateColumns: "1fr auto auto" }}
                      onClick={() => navigate(`/members/${member.id}`)}
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-medium truncate text-foreground">
                          {member.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.program}
                        </p>
                      </div>
                      <div className="pr-4">
                        <span className="text-xs text-muted-foreground">
                          {formatDateStr(member.expires)}
                        </span>
                      </div>
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
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium mb-4">
            Recently Expired (Last 30 Days)
          </h3>
          {recentlyExpiredMembers.length === 0 ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm">No recent expirations</span>
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
                    LTV
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right">
                  Days
                </span>
              </div>
              <div className="space-y-0.5 max-h-[260px] overflow-y-auto">
                {recentlyExpiredMembers.map((member) => {
                  const daysExpired = differenceInDays(
                    new Date(),
                    new Date(member.expires),
                  );
                  const badgeColor = daysExpired > 30 ? "#EF4444" : "#F59E0B";
                  return (
                    <div
                      key={member.id}
                      className="grid items-center px-2 py-2 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors"
                      style={{
                        gridTemplateColumns: staff
                          ? "1fr auto"
                          : "1fr auto auto",
                      }}
                      onClick={() => navigate(`/members/${member.id}`)}
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-medium truncate text-foreground">
                          {member.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.program}
                        </p>
                      </div>
                      {!staff && (
                        <div className="pr-4">
                          <span className="text-xs font-medium text-primary">
                            {member.ltv || "—"}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span
                          style={{
                            color: badgeColor,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {daysExpired}d
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
            New Members — Last 30 Days
          </h3>
          {newMembersList.length === 0 ? (
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
                    LTV
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium text-right">
                  Joined
                </span>
              </div>
              <div className="space-y-0.5 max-h-[260px] overflow-y-auto">
                {newMembersList.map((member) => (
                  <div
                    key={member.id}
                    className="grid items-center px-2 py-2 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors"
                    style={{
                      gridTemplateColumns: staff ? "1fr auto" : "1fr auto auto",
                    }}
                    onClick={() => navigate(`/members/${member.id}`)}
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium truncate text-foreground">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.program}
                      </p>
                    </div>
                    {!staff && (
                      <span className="text-xs font-medium text-primary pr-4">
                        {member.ltv || "—"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateStr(member.joined)}
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
