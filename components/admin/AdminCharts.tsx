"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type DataPoint = { date: string; count: number };


function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityAreaChart({
  carousels,
  exports,
  users,
}: {
  carousels: DataPoint[];
  exports: DataPoint[];
  users: DataPoint[];
}) {
  const data = carousels.map((c, i) => ({
    date: formatDate(c.date),
    fullDate: c.date,
    Carousels: carousels[i]?.count ?? 0,
    Exports: exports[i]?.count ?? 0,
    "New users": users[i]?.count ?? 0,
  }));

  return (
    <div className="h-[260px] sm:h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
          <defs>
            <linearGradient id="colorCarousels" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorExports" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate && formatDate(payload[0].payload.fullDate)}
            formatter={(value: unknown, name: unknown) => [Number(value ?? 0), String(name ?? "")]}
          />
          <Area type="monotone" dataKey="Carousels" name="Carousels" stroke="var(--chart-1)" fill="url(#colorCarousels)" strokeWidth={2} />
          <Area type="monotone" dataKey="Exports" name="Exports" stroke="var(--chart-2)" fill="url(#colorExports)" strokeWidth={2} />
          <Area type="monotone" dataKey="New users" name="New users" stroke="var(--chart-3)" fill="url(#colorUsers)" strokeWidth={2} />
          <Legend
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
            iconSize={8}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type AdminStatsChartData = {
  carouselsLast7Days: DataPoint[];
  exportsLast7Days: DataPoint[];
  newUsersLast7Days: DataPoint[];
  carouselsLast30Days: DataPoint[];
  exportsLast30Days: DataPoint[];
  newUsersLast30Days: DataPoint[];
};

export function ActivityChartWithToggle(stats: AdminStatsChartData) {
  const [range, setRange] = useState<"7" | "30">("7");
  const carousels = range === "7" ? stats.carouselsLast7Days : stats.carouselsLast30Days;
  const exports = range === "7" ? stats.exportsLast7Days : stats.exportsLast30Days;
  const users = range === "7" ? stats.newUsersLast7Days : stats.newUsersLast30Days;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="flex rounded-lg border border-border/50 p-0.5">
          <button
            type="button"
            onClick={() => setRange("7")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              range === "7" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            7 days
          </button>
          <button
            type="button"
            onClick={() => setRange("30")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              range === "30" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            30 days
          </button>
        </div>
      </div>
      <ActivityAreaChart carousels={carousels} exports={exports} users={users} />
    </div>
  );
}

export function PlanDonutChart({ proUsers, freeUsers }: { proUsers: number; freeUsers: number }) {
  const data = [
    { name: "Pro", value: proUsers, color: "var(--chart-1)" },
    { name: "Free", value: freeUsers, color: "var(--muted-foreground)" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
        No users yet
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }}
            formatter={(value: unknown, name: unknown) => {
              const v = Number(value ?? 0);
              const total = data.reduce((a, b) => a + b.value, 0);
              const pct = total ? ((v / total) * 100).toFixed(1) : "0";
              return [`${v} (${pct}%)`, String(name ?? "")];
            }}
          />
          <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
