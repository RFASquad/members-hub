import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  memberStore,
  formatDollar,
  computeTotalValue,
  getProgramDurations,
  programStore,
  computeExpirationDate,
} from "@/lib/store";
import { toast } from "sonner";
import { addMonths, format } from "date-fns";

/** Format raw string as dollar with $ and commas on blur */
function formatMoneyInput(raw: string): string {
  if (!raw) return "$0";
  const num = parseFloat(raw.replace(/[$,]/g, ""));
  if (isNaN(num)) return raw;
  return (
    "$" +
    num.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value || "");
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setDisplay(value || "");
  }, [value]);

  return (
    <Input
      value={display}
      placeholder={placeholder}
      className={className}
      onFocus={() => {
        isFocused.current = true;
        setDisplay((display || "").replace(/[$,]/g, ""));
      }}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={() => {
        isFocused.current = false;
        const formatted = formatMoneyInput(display);
        setDisplay(formatted);
        onChange(formatted);
      }}
    />
  );
}

const getExpiresForProgram = (program: string, joined: string): string => {
  const durations = getProgramDurations();
  const months = durations[program] ?? 12;
  try {
    const d = new Date(joined);
    if (isNaN(d.getTime())) throw new Error();
    return format(addMonths(d, months), "yyyy-MM-dd");
  } catch {
    return format(addMonths(new Date(), months), "yyyy-MM-dd");
  }
};

const getExpiresForDuration = (monthsStr: string, joined: string): string => {
  const months = parseInt(monthsStr) || 12;
  try {
    const d = new Date(joined);
    if (isNaN(d.getTime())) throw new Error();
    return format(addMonths(d, months), "yyyy-MM-dd");
  } catch {
    return format(addMonths(new Date(), months), "yyyy-MM-dd");
  }
};

export default function NewMember() {
  const navigate = useNavigate();

  const initialJoined = format(new Date(), "yyyy-MM-dd");
  const initialProgram = programStore.getPrograms()[0]?.name || "Program";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    joined: initialJoined,
    program: initialProgram,
    customProgramName: "",
    customProgramDuration: "12",
    duration: String(getProgramDurations()[initialProgram] ?? 3),
    expires: getExpiresForProgram(initialProgram, initialJoined),
    paymentType: "PIF",
    deposit: "0",
    monthly: "0",
    source: "Unknown",
    notes: "",
    sourceDetail: "",
    assignedTo: "",
    closer: "",
  });

  const toggleProgram = (prog: string) => {
    let current = formData.program
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (current.includes(prog)) {
      current = current.filter((p) => p !== prog);
    } else {
      current.push(prog);
    }
    const newProgramStr = current.join(", ");

    let maxMonths = 0;
    if (current.includes("__CUSTOM__")) {
      maxMonths = parseInt(formData.customProgramDuration) || 12;
    }
    const durations = getProgramDurations();
    current.forEach((p) => {
      if (p !== "__CUSTOM__") {
        const m = durations[p] ?? 12;
        if (m > maxMonths) maxMonths = m;
      }
    });
    if (maxMonths === 0) maxMonths = 12;

    const newExpires = getExpiresForDuration(
      String(maxMonths),
      formData.joined,
    );
    setFormData((d) => ({
      ...d,
      program: newProgramStr,
      duration: String(maxMonths),
      expires: newExpires,
    }));
  };

  const handleCustomDurationChange = (val: string) => {
    let current = formData.program
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    let maxMonths = parseInt(val) || 12;
    const durations = getProgramDurations();
    current.forEach((p) => {
      if (p !== "__CUSTOM__") {
        const m = durations[p] ?? 12;
        if (m > maxMonths) maxMonths = m;
      }
    });

    const newExpires = getExpiresForDuration(
      String(maxMonths),
      formData.joined,
    );
    setFormData((d) => ({
      ...d,
      customProgramDuration: val,
      duration: String(maxMonths),
      expires: newExpires,
    }));
  };

  const handleJoinedChange = (joined: string) => {
    const newExpires = getExpiresForDuration(formData.duration, joined);
    setFormData((d) => ({ ...d, joined, expires: newExpires }));
  };

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error("Please enter a member name");
      return;
    }

    let finalProgram = formData.program;
    if (finalProgram.includes("__CUSTOM__")) {
      if (!formData.customProgramName) {
        toast.error("Please enter a custom program name");
        return;
      }
      finalProgram = finalProgram.replace(
        "__CUSTOM__",
        formData.customProgramName,
      );
      // Optionally save it to the global programStore so it appears next time
      const existing = programStore.getPrograms();
      if (
        !existing.find(
          (p) =>
            p.name.toLowerCase() === formData.customProgramName.toLowerCase(),
        )
      ) {
        programStore.savePrograms([
          ...existing,
          {
            name: formData.customProgramName,
            duration: formData.customProgramDuration,
            price: "$0",
          },
        ]);
      }
    }

    // Strip any $ and commas before parsing
    const depositNum = parseFloat(formData.deposit.replace(/[$,]/g, "")) || 0;
    const monthlyNum = parseFloat(formData.monthly.replace(/[$,]/g, "")) || 0;

    const mappedType =
      formData.paymentType === "PIF"
        ? "PIF"
        : formData.paymentType === "deposit"
          ? "Deposit + Monthly"
          : formData.paymentType === "placed_deposit"
            ? "Placed Deposit"
            : "Monthly Only";

    const totalValue = computeTotalValue(
      mappedType,
      formatDollar(depositNum),
      formatDollar(monthlyNum),
      formData.duration,
    );

    const newMember = {
      id: crypto.randomUUID(),
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      joined: format(new Date(formData.joined), "MMM d, yyyy"),
      expires: format(new Date(formData.expires), "MMM d, yyyy"),
      status: "Active",
      program: finalProgram,
      source: formData.sourceDetail || formData.source,
      notes: formData.notes,
      assignedTo: finalProgram
        .split(",")
        .some((p) => ["Supercharge", "VIP", "Concierge"].includes(p.trim()))
        ? formData.assignedTo
        : "",
      closer: formData.closer,
      payment: {
        type: mappedType,
        deposit: formatDollar(depositNum),
        monthly: formatDollar(monthlyNum),
        months: formData.duration,
        totalValue: totalValue,
      },
      ltv: totalValue,
      lastInteraction: "Joined",
    };

    await memberStore.addMember(newMember);
    toast.success("Member record created successfully");
    navigate("/members");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="hover:bg-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-widest uppercase text-foreground">
            Add New Member
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter the details to enroll a new member into the Hub.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* BASICS */}
        <Card className="p-6 border-border/50 bg-card">
          <h2 className="text-lg font-bold tracking-widest uppercase mb-4 text-primary">
            1. Member Basics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="John Doe"
                className="bg-background border-border/50"
                value={formData.name}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                className="bg-background border-border/50"
                value={formData.email}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="+1 (555) 000-0000"
                className="bg-background border-border/50"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Date Joined</Label>
              <Input
                type="date"
                className="bg-background border-border/50"
                value={formData.joined}
                onChange={(e) => handleJoinedChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Closer</Label>
              <Select
                value={formData.closer}
                onValueChange={(v) => setFormData((d) => ({ ...d, closer: v }))}
              >
                <SelectTrigger className="bg-background border-border/50">
                  <SelectValue placeholder="Select closer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stephen B">Stephen B</SelectItem>
                  <SelectItem value="Stephen J">Stephen J</SelectItem>
                  <SelectItem value="Webinar">Webinar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.program
              .split(",")
              .some((p) =>
                ["Supercharge", "VIP", "Concierge"].includes(p.trim()),
              ) && (
              <div className="space-y-2">
                <Label>
                  Assigned To{" "}
                  <span className="text-muted-foreground font-normal">
                    (Mentor)
                  </span>
                </Label>
                <Select
                  value={formData.assignedTo}
                  onValueChange={(v) =>
                    setFormData((d) => ({ ...d, assignedTo: v }))
                  }
                >
                  <SelectTrigger className="bg-background border-border/50">
                    <SelectValue placeholder="Select mentor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Stephen B">Stephen B</SelectItem>
                    <SelectItem value="Stephen J">Stephen J</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Card>

        {/* PROGRAM */}
        <Card className="p-6 border-border/50 bg-card">
          <h2 className="text-lg font-bold tracking-widest uppercase mb-4 text-primary">
            2. Program Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 md:col-span-3">
              <Label>Program Tiers</Label>
              <div className="flex flex-wrap gap-2">
                {programStore.getPrograms().map((p) => {
                  const isSelected = formData.program
                    .split(",")
                    .map((s) => s.trim())
                    .includes(p.name);
                  return (
                    <Badge
                      key={p.name}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer text-sm py-1 px-3"
                      onClick={() => toggleProgram(p.name)}
                    >
                      {p.name}
                    </Badge>
                  );
                })}
                <Badge
                  variant={
                    formData.program.includes("__CUSTOM__")
                      ? "default"
                      : "outline"
                  }
                  className="cursor-pointer text-sm py-1 px-3 border-dashed"
                  onClick={() => toggleProgram("__CUSTOM__")}
                >
                  + Custom Program
                </Badge>
              </div>
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label>Max Duration</Label>
              <Input
                readOnly
                className="bg-background border-border/50 text-muted-foreground cursor-not-allowed"
                value={`${formData.duration} months`}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Calculated Expiration</Label>
              <Input
                type="date"
                className="bg-background border-border/50 text-muted-foreground"
                value={formData.expires}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, expires: e.target.value }))
                }
              />
            </div>

            {formData.program.includes("__CUSTOM__") && (
              <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/30 p-4 rounded-lg mt-2">
                <div className="space-y-2">
                  <Label>Custom Program Name</Label>
                  <Input
                    placeholder="e.g. Mastermind"
                    className="bg-background border-border/50"
                    value={formData.customProgramName}
                    onChange={(e) =>
                      setFormData((d) => ({
                        ...d,
                        customProgramName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (Months)</Label>
                  <Input
                    type="number"
                    min="1"
                    className="bg-background border-border/50"
                    value={formData.customProgramDuration}
                    onChange={(e) => handleCustomDurationChange(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* PAYMENT */}
        <Card className="p-6 border-border/50 bg-card">
          <h2 className="text-lg font-bold tracking-widest uppercase mb-4 text-primary">
            3. Payment Structure
          </h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Structure Type</Label>
              <Select
                value={formData.paymentType}
                onValueChange={(v) =>
                  setFormData((d) => ({ ...d, paymentType: v }))
                }
              >
                <SelectTrigger className="bg-background border-border/50 w-full md:w-1/3">
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIF">Paid In Full (PIF)</SelectItem>
                  <SelectItem value="deposit">Deposit + Monthly</SelectItem>
                  <SelectItem value="monthly">Monthly Only</SelectItem>
                  <SelectItem value="placed_deposit">Placed Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.paymentType === "PIF" ||
              formData.paymentType === "placed_deposit") && (
              <div className="space-y-2 w-full md:w-1/3">
                <Label>
                  {formData.paymentType === "PIF"
                    ? "Total Amount Paid"
                    : "Deposit Amount"}
                </Label>
                <MoneyInput
                  placeholder={
                    formData.paymentType === "PIF" ? "$2,500" : "$500"
                  }
                  className="bg-background border-border/50"
                  value={formData.deposit}
                  onChange={(v) => setFormData((d) => ({ ...d, deposit: v }))}
                />
              </div>
            )}

            {formData.paymentType === "deposit" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Deposit Amount</Label>
                  <MoneyInput
                    placeholder="$5,000"
                    className="bg-background border-border/50"
                    value={formData.deposit}
                    onChange={(v) => setFormData((d) => ({ ...d, deposit: v }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Amount</Label>
                  <MoneyInput
                    placeholder="$545"
                    className="bg-background border-border/50"
                    value={formData.monthly}
                    onChange={(v) => setFormData((d) => ({ ...d, monthly: v }))}
                  />
                </div>
              </div>
            )}

            {formData.paymentType === "monthly" && (
              <div className="space-y-2 w-full md:w-1/3">
                <Label>Monthly Amount</Label>
                <MoneyInput
                  placeholder="$833"
                  className="bg-background border-border/50"
                  value={formData.monthly}
                  onChange={(v) => setFormData((d) => ({ ...d, monthly: v }))}
                />
              </div>
            )}
          </div>
        </Card>

        {/* ACQUISITION & NOTES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-border/50 bg-card">
            <h2 className="text-lg font-bold tracking-widest uppercase mb-4 text-primary">
              4. Acquisition
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Source / Channel</Label>
                <Select
                  value={formData.source}
                  onValueChange={(v) =>
                    setFormData((d) => ({ ...d, source: v, sourceDetail: "" }))
                  }
                >
                  <SelectTrigger className="bg-background border-border/50">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ads">Ads</SelectItem>
                    <SelectItem value="YouTube">YouTube</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="Podcast">Podcast</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.source === "Referral" && (
                <div className="space-y-2">
                  <Label>Affiliate / Referral Name</Label>
                  <Input
                    placeholder="e.g. Ms Biz, Graham, Omar..."
                    className="bg-background border-border/50"
                    value={formData.sourceDetail}
                    onChange={(e) =>
                      setFormData((d) => ({
                        ...d,
                        sourceDetail: e.target.value,
                      }))
                    }
                  />
                </div>
              )}

              {formData.source === "Podcast" && (
                <div className="space-y-2">
                  <Label>Podcast Name</Label>
                  <Input
                    placeholder="e.g. The Rich From Anywhere Show..."
                    className="bg-background border-border/50"
                    value={formData.sourceDetail}
                    onChange={(e) =>
                      setFormData((d) => ({
                        ...d,
                        sourceDetail: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6 border-border/50 bg-card">
            <h2 className="text-lg font-bold tracking-widest uppercase mb-4 text-primary">
              5. Initial Notes
            </h2>
            <div className="space-y-2 h-[calc(100%-2rem)]">
              <Label>Renewal Plan / Strategy</Label>
              <Textarea
                placeholder="Add initial context, goals, or VIP flags..."
                className="bg-background border-border/50 h-32 resize-none"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, notes: e.target.value }))
                }
              />
            </div>
          </Card>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-accent font-bold tracking-wide uppercase px-8"
            onClick={handleCreate}
          >
            <Save className="w-4 h-4 mr-2" />
            Create Member Record
          </Button>
        </div>
      </div>
    </div>
  );
}
