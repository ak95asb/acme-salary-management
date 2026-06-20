"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, Download, TrendingUp, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Distribution {
  count: number;
  median: number;
  mean: number;
  min: number;
  max: number;
  currencyCode: string;
}

interface DeptBreakdown {
  department: string;
  count: number;
  median: number;
  mean: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  currency,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  currency?: string;
}) {
  const formatted =
    value !== undefined
      ? value.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : "—";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-bold mt-1">{formatted}</p>
            {currency && value !== undefined && (
              <p className="text-xs text-muted-foreground mt-0.5">{currency}</p>
            )}
          </div>
          <div className="rounded-full bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [inputValue, setInputValue] = useState("USD");

  const distributionQuery = useQuery<Distribution>({
    queryKey: ["analytics", "distribution", currencyCode],
    queryFn: async () => {
      const res = await api.get<{ data: Distribution }>(
        `/api/analytics/distribution?currencyCode=${currencyCode}`
      );
      return res.data.data;
    },
  });

  const deptQuery = useQuery<DeptBreakdown[]>({
    queryKey: ["analytics", "departments", currencyCode],
    queryFn: async () => {
      const res = await api.get<{ data: DeptBreakdown[] }>(
        `/api/analytics/departments?currencyCode=${currencyCode}`
      );
      return res.data.data;
    },
  });

  async function handleExport() {
    try {
      const res = await api.get("/api/analytics/export/csv", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `salary-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    }
  }

  const dist = distributionQuery.data;
  const depts = deptQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Salary distribution and workforce insights
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Currency Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                placeholder="USD"
                className="w-28 uppercase"
                maxLength={3}
              />
            </div>
            <Button
              onClick={() => {
                if (inputValue.length === 3) setCurrencyCode(inputValue);
              }}
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      {distributionQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : distributionQuery.isError ? (
        <p className="text-sm text-muted-foreground">
          No salary data for {currencyCode}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Total Records" value={dist?.count} icon={Users} />
            <StatCard
              label="Median Salary"
              value={dist?.median}
              icon={TrendingUp}
              currency={currencyCode}
            />
            <StatCard
              label="Mean Salary"
              value={dist?.mean}
              icon={DollarSign}
              currency={currencyCode}
            />
            <StatCard
              label="Min Salary"
              value={dist?.min}
              icon={DollarSign}
              currency={currencyCode}
            />
            <StatCard
              label="Max Salary"
              value={dist?.max}
              icon={DollarSign}
              currency={currencyCode}
            />
          </div>

          {/* Department Breakdown */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Salary by Department ({currencyCode})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deptQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={depts}
                      margin={{ top: 4, right: 4, bottom: 60, left: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="department"
                        tick={{ fontSize: 11 }}
                        angle={-40}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                        }
                      />
                      <Tooltip
                        formatter={(v) => [
                          typeof v === "number" ? v.toLocaleString() : String(v),
                          currencyCode,
                        ]}
                      />
                      <Bar
                        dataKey="median"
                        name="Median"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="mean"
                        name="Mean"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Department Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {deptQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : depts.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No department data for {currencyCode}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                          <TableHead className="text-right">Median</TableHead>
                          <TableHead className="text-right">Mean</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {depts.map((d) => (
                          <TableRow key={d.department}>
                            <TableCell className="font-medium">
                              {d.department}
                            </TableCell>
                            <TableCell className="text-right">{d.count}</TableCell>
                            <TableCell className="text-right">
                              {d.median.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {d.mean.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
