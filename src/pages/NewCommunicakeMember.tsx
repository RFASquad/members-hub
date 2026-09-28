import { useState } from "react";
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
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import { programStore } from "@/lib/store";

export default function NewCommunicakeMember() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    status: "Active", // CCK Status
    plan: "$97/month",
    joined: format(new Date(), "yyyy-MM-dd"), // CCK Subscription Start
    expires: "", // CCK Trial End Date
    rfaProgram: "Non-Member", // RFA Member Status
    notes: "",
  });

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error("Please enter a member name");
      return;
    }

    const isNonMember = formData.status === "Non-Member";
    const planAmount = isNonMember
      ? 0
      : parseInt(formData.plan.replace(/\D/g, "")) || 0;

    const newMember: Record<string, any> = {
      id: crypto.randomUUID(),
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      status: formData.status,
      plan_amount_display: isNonMember ? "" : formData.plan,
      plan_amount: planAmount,
      subscription_start: isNonMember ? null : formData.joined || null,
      trial_end:
        formData.status === "Trialing" ? formData.expires || null : null,
      rfa_programs: formData.rfaProgram,
      notes: formData.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Remove nulls to avoid NOT NULL constraint surprises / empty-string issues
    Object.keys(newMember).forEach(
      (k) => newMember[k] === null && delete newMember[k],
    );

    const { error } = await supabase.from("cck_members").insert([newMember]);
    if (error) {
      console.error("Error adding communicake member:", error);
      toast.error(error.message || "Failed to create member");
    } else {
      toast.success("CCK Member record created successfully");
      navigate("/communicake/members");
    }
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
            Add New CCK Member
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter the details to enroll a new member into CCK.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
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
          </div>
        </Card>

        <Card className="p-6 border-border/50 bg-card">
          <h2 className="text-lg font-bold tracking-widest uppercase mb-4 text-primary">
            2. CCK Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>CCK Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData((d) => ({ ...d, status: v }))}
              >
                <SelectTrigger className="bg-background border-border/50">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Non-Member">Non-Member</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Trialing">Trialing</SelectItem>
                  <SelectItem value="Past Due">Past Due</SelectItem>
                  <SelectItem value="Canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.status !== "Non-Member" && (
              <div className="space-y-2">
                <Label>CCK Plan Amount</Label>
                <Select
                  value={formData.plan}
                  onValueChange={(v) => setFormData((d) => ({ ...d, plan: v }))}
                >
                  <SelectTrigger className="bg-background border-border/50">
                    <SelectValue placeholder="Select plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="$97/month">$97/month</SelectItem>
                    <SelectItem value="$297/month">$297/month</SelectItem>
                    <SelectItem value="$497/month">$497/month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.status !== "Non-Member" && (
              <div className="space-y-2">
                <Label>CCK Subscription Start</Label>
                <Input
                  type="date"
                  className="bg-background border-border/50"
                  value={formData.joined}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, joined: e.target.value }))
                  }
                />
              </div>
            )}

            {formData.status === "Trialing" && (
              <div className="space-y-2">
                <Label>CCK Trial End Date</Label>
                <Input
                  type="date"
                  className="bg-background border-border/50"
                  value={formData.expires}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, expires: e.target.value }))
                  }
                />
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 border-border/50 bg-card">
          <h2 className="text-lg font-bold tracking-widest uppercase mb-4 text-primary">
            3. RFA Member Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>RFA Program</Label>
              <Select
                value={formData.rfaProgram}
                onValueChange={(v) =>
                  setFormData((d) => ({ ...d, rfaProgram: v }))
                }
              >
                <SelectTrigger className="bg-background border-border/50">
                  <SelectValue placeholder="Select program..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Non-Member">Non-Member</SelectItem>
                  {programStore.getPrograms().map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-border/50 bg-card">
          <h2 className="text-lg font-bold tracking-widest uppercase mb-4 text-primary">
            4. Notes
          </h2>
          <div className="space-y-2">
            <Label>Initial Notes</Label>
            <Textarea
              placeholder="Add initial context, goals, or notes..."
              className="bg-background border-border/50 h-32 resize-none"
              value={formData.notes}
              onChange={(e) =>
                setFormData((d) => ({ ...d, notes: e.target.value }))
              }
            />
          </div>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-accent font-bold tracking-wide uppercase px-8"
            onClick={handleCreate}
          >
            <Save className="w-4 h-4 mr-2" />
            Create CCK Member
          </Button>
        </div>
      </div>
    </div>
  );
}
