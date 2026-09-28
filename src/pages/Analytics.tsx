import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { DollarSign, Users, TrendingDown, Clock } from "lucide-react";
import {
  memberStore,
  cckStore,
  parseDollar,
  formatDollar,
  programStore,
} from "@/lib/store";
import { useHub } from "@/hooks/use-hub";

export default function Analytics() {
  const { isCCK } = useHub();
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    if (isCCK) {
      cckStore.getMembers().then(setMembers);
    } else {
      memberStore.getMembers().then(setMembers);
    }
  }, [isCCK]);

  const GOLD = isCCK ? "hsl(330, 80%, 60%)" : "#D4A82C";

  // Compute MRR
  const totalMRR = isCCK
    ? members
        .filter((m) => m.status?.toLowerCase() === "active")
        .reduce(
          (acc, m) =>
            acc +
            (m.plan_amount_display
              ? parseInt(m.plan_amount_display.replace(/[^0-9]/g, "")) || 0
              : 0),
          0,
        )
    : members.reduce((acc, m) => {
        if (
          m.stripe_status?.toLowerCase() === "active" &&
          m.stripe_plan_display
        ) {
          const match = m.stripe_plan_display.match(/\$?([\d,]+(\.\d+)?)/);
          if (match) {
            return acc + parseFloat(match[1].replace(/,/g, ""));
          }
        }
        return acc;
      }, 0);

  // Compute Programs Distribution
  const programData = isCCK
    ? ["$97/month", "$297/month", "$497/month"].map((name) => ({
        name,
        count: members.filter((m) =>
          (m.plan_amount_display || "").includes(name.split("/")[0]),
        ).length,
      }))
    : programStore
        .getPrograms()
        .map((p) => p.name)
        .map((name) => ({
          name,
          count: members.filter((m) =>
            (m.program || "")
              .split(",")
              .map((s: string) => s.trim())
              .includes(name),
          ).length,
        }));

  // CCK-specific data
  const CCK_PINK = "hsl(330, 80%, 60%)";
  const CCK_BLUE = "#60a5fa";
  const CCK_RED = "#f87171";
  const CCK_YELLOW = "#fbbf24";

  // Status breakdown for CCK
  const statusBreakdown = isCCK
    ? [
        {
          name: "Active",
          count: members.filter((m) => m.status?.toLowerCase() === "active")
            .length,
          color: "#4ade80",
        },
        {
          name: "Trialing",
          count: members.filter((m) => m.status?.toLowerCase() === "trialing")
            .length,
          color: CCK_BLUE,
        },
        {
          name: "Past Due",
          count: members.filter((m) => m.status?.toLowerCase() === "past due")
            .length,
          color: CCK_RED,
        },
        {
          name: "Canceled",
          count: members.filter((m) => m.status?.toLowerCase() === "canceled")
            .length,
          color: "#9ca3af",
        },
        {
          name: "Non-Member",
          count: members.filter(
            (m) => !m.status || m.status?.toLowerCase() === "non-member",
          ).length,
          color: "#6b7280",
        },
      ].filter((s) => s.count > 0)
    : [];

  // MRR by Plan Tier for CCK
  const mrrByTier = isCCK
    ? [
        {
          name: "$97/mo",
          mrr:
            members.filter(
              (m) =>
                m.status?.toLowerCase() === "active" &&
                (m.plan_amount_display || "").includes("97"),
            ).length * 97,
        },
        {
          name: "$297/mo",
          mrr:
            members.filter(
              (m) =>
                m.status?.toLowerCase() === "active" &&
                (m.plan_amount_display || "").includes("297"),
            ).length * 297,
        },
        {
          name: "$497/mo",
          mrr:
            members.filter(
              (m) =>
                m.status?.toLowerCase() === "active" &&
                (m.plan_amount_display || "").includes("497"),
            ).length * 497,
        },
      ].filter((t) => t.mrr > 0)
    : [];

  // Trials expiring breakdown for CCK
  const now = new Date();
  const trialBuckets = isCCK
    ? (() => {
        const expiring3 = members.filter((m) => {
          if (m.status?.toLowerCase() !== "trialing" || !m.trial_end)
            return false;
          const days = Math.ceil(
            (new Date(m.trial_end).getTime() - now.getTime()) / 86400000,
          );
          return days >= 0 && days <= 3;
        }).length;
        const expiring7 = members.filter((m) => {
          if (m.status?.toLowerCase() !== "trialing" || !m.trial_end)
            return false;
          const days = Math.ceil(
            (new Date(m.trial_end).getTime() - now.getTime()) / 86400000,
          );
          return days > 3 && days <= 7;
        }).length;
        const expiring14 = members.filter((m) => {
          if (m.status?.toLowerCase() !== "trialing" || !m.trial_end)
            return false;
          const days = Math.ceil(
            (new Date(m.trial_end).getTime() - now.getTime()) / 86400000,
          );
          return days > 7 && days <= 14;
        }).length;
        const safe = members.filter((m) => {
          if (m.status?.toLowerCase() !== "trialing" || !m.trial_end)
            return false;
          const days = Math.ceil(
            (new Date(m.trial_end).getTime() - now.getTime()) / 86400000,
          );
          return days > 14;
        }).length;
        return [
          { name: "≤3 days", count: expiring3, color: CCK_RED },
          { name: "4–7 days", count: expiring7, color: CCK_YELLOW },
          { name: "8–14 days", count: expiring14, color: CCK_BLUE },
          { name: "15+ days", count: safe, color: "#4ade80" },
        ].filter((b) => b.count > 0);
      })()
    : [];

  // Acquisition channels for RFA
  const sourceCounts = !isCCK
    ? members.reduce(
        (acc, m) => {
          const source = m.source || "Unknown";
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      )
    : {};

  const sourceData = Object.entries(sourceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => Number(b.count) - Number(a.count));

  // Closer stats for RFA
  const closerStats = !isCCK
    ? members.reduce(
        (acc, m) => {
          const closer = (m.closer || "Unassigned").trim();
          if (!acc[closer]) {
            acc[closer] = { name: closer, deals: 0, sales: 0 };
          }
          acc[closer].deals += 1;
          acc[closer].sales += parseDollar(
            m.ltv || m.payment?.totalValue || "$0",
          );
          return acc;
        },
        {} as Record<string, { name: string; deals: number; sales: number }>,
      )
    : {};

  const closerDealsData = Object.values(closerStats).sort(
    (a: any, b: any) => b.deals - a.deals,
  );
  const closerSalesData = Object.values(closerStats).sort(
    (a: any, b: any) => b.sales - a.sales,
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-widest uppercase text-foreground">
          Analytics Hub
        </h1>
      </div>

      {/* MRR Card */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="p-8 border-border/50 bg-card">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-status-active/20 flex items-center justify-center text-status-active">
              <DollarSign className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">
                Active Monthly Recurring Revenue (MRR)
              </p>
              <p className="text-4xl font-bold mt-1">
                {formatDollar(totalMRR)}
              </p>
              <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">
                Calculated from active members only (trials excluded)
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* CCK-specific analytics */}
      {isCCK ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Members by Plan */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-6 text-primary">
                Members by Plan
              </h2>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={programData}
                    margin={{ bottom: 20, top: 10, right: 10 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorPlanBar"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={CCK_PINK}
                          stopOpacity={1}
                        />
                        <stop
                          offset="100%"
                          stopColor={CCK_PINK}
                          stopOpacity={0.3}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#aaa"
                      tick={{ fill: "#888", fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#aaa"
                      tick={{ fill: "#888" }}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: "#fff",
                        borderColor: "#e5e7eb",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: CCK_PINK }}
                      formatter={(v) => [v, "Members"]}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      fill="url(#colorPlanBar)"
                      activeBar={{ fillOpacity: 1, filter: "brightness(1.25)" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Subscription Status Breakdown */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-6 text-primary">
                Subscription Status Breakdown
              </h2>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusBreakdown}
                    margin={{ bottom: 0, top: 10, right: 10 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorStatusBar"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={CCK_PINK}
                          stopOpacity={1}
                        />
                        <stop
                          offset="100%"
                          stopColor={CCK_PINK}
                          stopOpacity={0.3}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#aaa"
                      tick={{ fill: "#888", fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#aaa"
                      tick={{ fill: "#888" }}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: "#fff",
                        borderColor: "#e5e7eb",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: CCK_PINK }}
                      formatter={(v) => [v, "Members"]}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      fill="url(#colorStatusBar)"
                      activeBar={{ fillOpacity: 1, filter: "brightness(1.25)" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* MRR by Plan Tier */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-6 text-primary">
                MRR by Plan Tier
              </h2>
              {mrrByTier.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                  No active paid subscribers yet
                </div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={mrrByTier}
                      margin={{ bottom: 0, top: 10, right: 10 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorMRRBar"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={CCK_PINK}
                            stopOpacity={1}
                          />
                          <stop
                            offset="100%"
                            stopColor={CCK_PINK}
                            stopOpacity={0.3}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e5e7eb"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#aaa"
                        tick={{ fill: "#888", fontSize: 12 }}
                      />
                      <YAxis
                        stroke="#aaa"
                        tick={{ fill: "#888" }}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <RechartsTooltip
                        cursor={false}
                        contentStyle={{
                          backgroundColor: "#fff",
                          borderColor: "#e5e7eb",
                          borderRadius: "8px",
                        }}
                        itemStyle={{ color: CCK_PINK }}
                        formatter={(v) => [`$${v}`, "MRR"]}
                      />
                      <Bar
                        dataKey="mrr"
                        radius={[6, 6, 0, 0]}
                        fill="url(#colorMRRBar)"
                        activeBar={{
                          fillOpacity: 1,
                          filter: "brightness(1.25)",
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Trial Expiry Urgency */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-2 text-primary">
                Trial Expiry Urgency
              </h2>
              <p className="text-xs text-muted-foreground mb-6">
                How soon active trials are expiring — follow up with those
                expiring soonest
              </p>
              {trialBuckets.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  No active trials
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {trialBuckets.map((bucket) => {
                    const total = trialBuckets.reduce((a, b) => a + b.count, 0);
                    const pct =
                      total > 0 ? Math.round((bucket.count / total) * 100) : 0;
                    return (
                      <div
                        key={bucket.name}
                        className="flex items-center gap-3"
                      >
                        <div className="w-20 text-xs font-medium text-muted-foreground">
                          {bucket.name}
                        </div>
                        <div className="flex-1 h-7 rounded-lg bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-lg transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: bucket.color,
                            }}
                          />
                        </div>
                        <div
                          className="w-12 text-right text-sm font-bold"
                          style={{ color: bucket.color }}
                        >
                          {bucket.count}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground pt-2">
                    {trialBuckets.reduce((a, b) => a + b.count, 0)} total
                    trialing members
                  </p>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        // RFA-specific analytics
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Members by Program */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-6 text-primary">
                Members by Program
              </h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={programData}
                    margin={{ bottom: 50, top: 10, right: 10 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorGoldBar"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={GOLD} stopOpacity={1} />
                        <stop
                          offset="100%"
                          stopColor={GOLD}
                          stopOpacity={0.25}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#333"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#888"
                      tick={{ fill: "#888", fontSize: 11 }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="#888"
                      tick={{ fill: "#888" }}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: "#0D0D0D",
                        borderColor: "#333",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: GOLD }}
                      formatter={(v) => [v, "Members"]}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      fill="url(#colorGoldBar)"
                      activeBar={{ fillOpacity: 1, filter: "brightness(1.1)" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Acquisition Channels */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-6 text-primary">
                Acquisition Channels
              </h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sourceData}
                    layout="vertical"
                    margin={{ left: 10, right: 10, top: 10 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorGoldHoriz"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor={GOLD} stopOpacity={1} />
                        <stop
                          offset="100%"
                          stopColor={GOLD}
                          stopOpacity={0.3}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#333"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke="#888"
                      tick={{ fill: "#888" }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#888"
                      tick={{ fill: "#888", fontSize: 11 }}
                      width={90}
                    />
                    <RechartsTooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: "#0D0D0D",
                        borderColor: "#333",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: GOLD }}
                      formatter={(v) => [v, "Members"]}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 6, 6, 0]}
                      fill="url(#colorGoldHoriz)"
                      activeBar={{ fillOpacity: 1, filter: "brightness(1.1)" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Member Status Breakdown */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-6 text-primary">
                Member Status Breakdown
              </h2>
              <div className="h-[260px]">
                {(() => {
                  const statusData = [
                    {
                      name: "Active",
                      count: members.filter(
                        (m) => m.status?.toLowerCase() === "active",
                      ).length,
                      color: "#10b981",
                    },
                    {
                      name: "Past Due",
                      count: members.filter(
                        (m) => m.status?.toLowerCase() === "past due",
                      ).length,
                      color: "#ef4444",
                    },
                    {
                      name: "Expired",
                      count: members.filter(
                        (m) => m.status?.toLowerCase() === "expired",
                      ).length,
                      color: "#991b1b",
                    },
                    {
                      name: "Renewed",
                      count: members.filter(
                        (m) => m.status?.toLowerCase() === "renewed",
                      ).length,
                      color: "#3b82f6",
                    },
                    {
                      name: "Canceled",
                      count: members.filter(
                        (m) => m.status?.toLowerCase() === "canceled",
                      ).length,
                      color: "#6b7280",
                    },
                  ].filter((s) => s.count > 0);
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={statusData}
                        margin={{ top: 10, right: 10, bottom: 10 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorStatusGoldBar"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={GOLD}
                              stopOpacity={1}
                            />
                            <stop
                              offset="100%"
                              stopColor={GOLD}
                              stopOpacity={0.25}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#333"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          stroke="#888"
                          tick={{ fill: "#888", fontSize: 12 }}
                        />
                        <YAxis
                          stroke="#888"
                          tick={{ fill: "#888" }}
                          allowDecimals={false}
                        />
                        <RechartsTooltip
                          cursor={false}
                          contentStyle={{
                            backgroundColor: "#0D0D0D",
                            borderColor: "#333",
                            borderRadius: "8px",
                          }}
                          itemStyle={{ color: GOLD }}
                          formatter={(v) => [v, "Members"]}
                        />
                        <Bar
                          dataKey="count"
                          radius={[6, 6, 0, 0]}
                          activeBar={{
                            fillOpacity: 1,
                            filter: "brightness(1.1)",
                          }}
                        >
                          {statusData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.color}
                              fillOpacity={0.85}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </Card>

            {/* Monthly Revenue by Program */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-6 text-primary">
                Monthly Revenue by Program
              </h2>
              <div className="h-[260px]">
                {(() => {
                  const programs = programData
                    .map((p) => ({
                      name: p.name,
                      mrr: members
                        .filter(
                          (m) =>
                            m.stripe_status?.toLowerCase() === "active" &&
                            (m.program || "")
                              .split(",")
                              .map((s: string) => s.trim())
                              .includes(p.name),
                        )
                        .reduce((acc: number, m: any) => {
                          if (m.stripe_plan_display) {
                            const match =
                              m.stripe_plan_display.match(
                                /\$?([\d,]+(\.\d+)?)/,
                              );
                            if (match) {
                              return (
                                acc + parseFloat(match[1].replace(/,/g, ""))
                              );
                            }
                          }
                          return acc;
                        }, 0),
                    }))
                    .filter((p) => p.mrr > 0);
                  if (programs.length === 0)
                    return (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        No monthly revenue data yet
                      </div>
                    );
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={programs}
                        margin={{ bottom: 40, top: 10, right: 10 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorMRRGoldBar"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={GOLD}
                              stopOpacity={1}
                            />
                            <stop
                              offset="100%"
                              stopColor={GOLD}
                              stopOpacity={0.25}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#333"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          stroke="#888"
                          tick={{ fill: "#888", fontSize: 11 }}
                          interval={0}
                          angle={-30}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          stroke="#888"
                          tick={{ fill: "#888" }}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <RechartsTooltip
                          cursor={false}
                          contentStyle={{
                            backgroundColor: "#0D0D0D",
                            borderColor: "#333",
                            borderRadius: "8px",
                          }}
                          itemStyle={{ color: GOLD }}
                          formatter={(v) => [`$${v}`, "MRR"]}
                        />
                        <Bar
                          dataKey="mrr"
                          radius={[6, 6, 0, 0]}
                          fill="url(#colorMRRGoldBar)"
                          activeBar={{
                            fillOpacity: 1,
                            filter: "brightness(1.1)",
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </Card>
          </div>

          {/* Closer Stats Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deals Closed by Closer */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-6 text-primary">
                Deals Closed by Closer
              </h2>
              <div className="h-[260px]">
                {closerDealsData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No closer data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={closerDealsData}
                      margin={{ bottom: 40, top: 10, right: 10 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorDealsGoldBar"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={GOLD} stopOpacity={1} />
                          <stop
                            offset="100%"
                            stopColor={GOLD}
                            stopOpacity={0.25}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#333"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#888"
                        tick={{ fill: "#888", fontSize: 11 }}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        stroke="#888"
                        tick={{ fill: "#888" }}
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        cursor={false}
                        contentStyle={{
                          backgroundColor: "#0D0D0D",
                          borderColor: "#333",
                          borderRadius: "8px",
                        }}
                        itemStyle={{ color: GOLD }}
                        formatter={(v) => [v, "Deals"]}
                      />
                      <Bar
                        dataKey="deals"
                        radius={[6, 6, 0, 0]}
                        fill="url(#colorDealsGoldBar)"
                        activeBar={{
                          fillOpacity: 1,
                          filter: "brightness(1.1)",
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Total Sales by Closer */}
            <Card className="p-6 border-border/50 bg-card">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-6 text-primary">
                Total Sales by Closer
              </h2>
              <div className="h-[260px]">
                {closerSalesData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No sales data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={closerSalesData}
                      margin={{ bottom: 40, top: 10, right: 10 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorSalesGoldBar"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={GOLD} stopOpacity={1} />
                          <stop
                            offset="100%"
                            stopColor={GOLD}
                            stopOpacity={0.25}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#333"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#888"
                        tick={{ fill: "#888", fontSize: 11 }}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        stroke="#888"
                        tick={{ fill: "#888" }}
                        tickFormatter={(v) =>
                          `$${v > 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                        }
                      />
                      <RechartsTooltip
                        cursor={false}
                        contentStyle={{
                          backgroundColor: "#0D0D0D",
                          borderColor: "#333",
                          borderRadius: "8px",
                        }}
                        itemStyle={{ color: GOLD }}
                        formatter={(v: number) => [
                          formatDollar(v),
                          "Total Sales",
                        ]}
                      />
                      <Bar
                        dataKey="sales"
                        radius={[6, 6, 0, 0]}
                        fill="url(#colorSalesGoldBar)"
                        activeBar={{
                          fillOpacity: 1,
                          filter: "brightness(1.1)",
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
