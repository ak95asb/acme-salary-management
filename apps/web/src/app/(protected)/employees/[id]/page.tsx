"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  UserX,
  Mail,
  Briefcase,
  Globe,
  Hash,
  Calendar,
} from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  jobTitle: string;
  country: string;
  status: "ACTIVE" | "INACTIVE";
  hireDate?: string;
}

interface SalaryRecord {
  id: string;
  amount: string;
  currencyCode: string;
  payFrequency: "MONTHLY" | "ANNUAL";
  effectiveDate: string;
  createdAt: string;
}

const salarySchema = z.object({
  amount: z
    .string()
    .min(1, "Required")
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount e.g. 5000.00"),
  currencyCode: z.string().min(3, "Required").max(3, "3-letter code"),
  payFrequency: z.enum(["MONTHLY", "ANNUAL"]),
  effectiveDate: z.string().min(1, "Required"),
});

type SalaryFormValues = z.infer<typeof salarySchema>;

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value ?? "—"}</p>
      </div>
    </div>
  );
}

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);

  // Employee
  const employeeQuery = useQuery<Employee>({
    queryKey: ["employees", id],
    queryFn: async () => {
      const res = await api.get<{ data: Employee }>(`/api/employees/${id}`);
      return res.data.data;
    },
  });

  // Current salary
  const currentSalaryQuery = useQuery<SalaryRecord | null>({
    queryKey: ["employees", id, "salary", "current"],
    queryFn: async () => {
      const res = await api.get<{ data: SalaryRecord | null }>(
        `/api/employees/${id}/salaries/current`
      );
      return res.data.data;
    },
  });

  // Salary history
  const salaryHistoryQuery = useQuery<SalaryRecord[]>({
    queryKey: ["employees", id, "salaries"],
    queryFn: async () => {
      const res = await api.get<{ data: SalaryRecord[] }>(
        `/api/employees/${id}/salaries`
      );
      return res.data.data;
    },
  });

  // Add salary
  const addSalaryMutation = useMutation({
    mutationFn: (values: SalaryFormValues) =>
      api.post(`/api/employees/${id}/salaries`, values),
    onSuccess: () => {
      toast.success("Salary record added");
      queryClient.invalidateQueries({ queryKey: ["employees", id, "salaries"] });
      queryClient.invalidateQueries({ queryKey: ["employees", id, "salary", "current"] });
      setSalaryDialogOpen(false);
      resetSalary();
    },
    onError: () => toast.error("Failed to add salary record"),
  });

  // Deactivate employee
  const deactivateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/api/employees/${id}`, { status: "INACTIVE" }),
    onSuccess: () => {
      toast.success("Employee deactivated");
      queryClient.invalidateQueries({ queryKey: ["employees", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: () => toast.error("Failed to deactivate employee"),
  });

  const {
    register,
    handleSubmit,
    reset: resetSalary,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SalaryFormValues>({
    resolver: zodResolver(salarySchema),
    defaultValues: { currencyCode: "USD", payFrequency: "MONTHLY" },
  });

  const employee = employeeQuery.data;

  if (employeeQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (employeeQuery.isError || !employee) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-muted-foreground">Employee not found.</p>
        <Link
          href="/employees"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/employees"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-muted-foreground text-sm">{employee.jobTitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setSalaryDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Salary Record
          </Button>
          {employee.status === "ACTIVE" && (
            <Button
              variant="destructive"
              onClick={() => deactivateMutation.mutate()}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserX className="mr-2 h-4 w-4" />
              )}
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Employee Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Employee Information</CardTitle>
            <Badge variant={employee.status === "ACTIVE" ? "default" : "secondary"}>
              {employee.status}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoRow icon={Hash} label="Employee Code" value={employee.employeeCode} />
              <InfoRow icon={Mail} label="Email" value={employee.email} />
              <InfoRow icon={Briefcase} label="Department" value={employee.department} />
              <InfoRow icon={Globe} label="Country" value={employee.country} />
              <InfoRow
                icon={Calendar}
                label="Hire Date"
                value={
                  employee.hireDate
                    ? new Date(employee.hireDate).toLocaleDateString()
                    : undefined
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Current Salary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Salary</CardTitle>
          </CardHeader>
          <CardContent>
            {currentSalaryQuery.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : currentSalaryQuery.data ? (
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-bold">
                    {parseFloat(currentSalaryQuery.data.amount).toLocaleString()}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      {currentSalaryQuery.data.currencyCode}
                    </span>
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {currentSalaryQuery.data.payFrequency}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Effective{" "}
                  {new Date(currentSalaryQuery.data.effectiveDate).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No salary on record</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Salary History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salary History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {salaryHistoryQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !salaryHistoryQuery.data || salaryHistoryQuery.data.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No salary history yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryHistoryQuery.data.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {parseFloat(record.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>{record.currencyCode}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{record.payFrequency}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(record.effectiveDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Salary Dialog */}
      <Dialog open={salaryDialogOpen} onOpenChange={setSalaryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Salary Record</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((v) => addSalaryMutation.mutate(v))}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                {...register("amount")}
                placeholder="5000.00"
                inputMode="decimal"
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Currency Code</Label>
                <Input {...register("currencyCode")} placeholder="USD" maxLength={3} />
                {errors.currencyCode && (
                  <p className="text-xs text-destructive">{errors.currencyCode.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Pay Frequency</Label>
                <Select
                  defaultValue="MONTHLY"
                  onValueChange={(v) =>
                    setValue("payFrequency", (v ?? "MONTHLY") as "MONTHLY" | "ANNUAL")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="ANNUAL">Annual</SelectItem>
                  </SelectContent>
                </Select>
                {errors.payFrequency && (
                  <p className="text-xs text-destructive">{errors.payFrequency.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Effective Date</Label>
              <Input {...register("effectiveDate")} type="date" />
              {errors.effectiveDate && (
                <p className="text-xs text-destructive">{errors.effectiveDate.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSalaryDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || addSalaryMutation.isPending}
              >
                {(isSubmitting || addSalaryMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
