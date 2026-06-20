"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Setting {
  key: string;
  value: string;
}

interface SettingCardProps {
  settingKey: string;
  title: string;
  description: string;
  suffix?: string;
  currentValue: string | undefined;
}

function SettingCard({
  settingKey,
  title,
  description,
  suffix,
  currentValue,
}: SettingCardProps) {
  const queryClient = useQueryClient();
  const [editValue, setEditValue] = useState(currentValue ?? "");
  const isDirty = editValue !== (currentValue ?? "");

  // Sync when data loads
  useEffect(() => {
    if (currentValue !== undefined) setEditValue(currentValue);
  }, [currentValue]);

  const saveMutation = useMutation({
    mutationFn: (value: string) =>
      api.put<{ data: Setting }>(`/api/settings/${settingKey}`, { value }),
    onSuccess: () => {
      toast.success(`${title} updated`);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => toast.error(`Failed to update ${title}`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1 max-w-xs">
            <Label htmlFor={settingKey}>Value{suffix ? ` (${suffix})` : ""}</Label>
            <Input
              id={settingKey}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Enter value"
            />
          </div>
          <Button
            onClick={() => saveMutation.mutate(editValue)}
            disabled={!isDirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery<Record<string, string>>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.get<{ data: Record<string, string> }>("/api/settings");
      return res.data.data;
    },
  });

  if (user?.role !== "SYSTEM_ADMIN") {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Only System Administrators can access settings.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Failed to load settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure system-wide parameters
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 max-w-2xl">
        <SettingCard
          settingKey="salary_alert_threshold_pct"
          title="Salary Alert Threshold"
          description="Percentage change in salary that triggers an alert for review."
          suffix="%"
          currentValue={data?.salary_alert_threshold_pct}
        />
        <SettingCard
          settingKey="audit_retention_days"
          title="Audit Log Retention"
          description="Number of days audit logs are retained before automatic deletion."
          suffix="days"
          currentValue={data?.audit_retention_days}
        />
        {/* Render any additional settings dynamically */}
        {data &&
          Object.entries(data)
            .filter(
              ([key]) =>
                key !== "salary_alert_threshold_pct" &&
                key !== "audit_retention_days"
            )
            .map(([key, value]) => (
              <SettingCard
                key={key}
                settingKey={key}
                title={key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                description={`Configure the ${key.replace(/_/g, " ")} setting.`}
                currentValue={value}
              />
            ))}
      </div>
    </div>
  );
}
