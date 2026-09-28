import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditToggle, PINK, PINK_SUBTLE, PINK_BORDER } from "./shared";

export interface LiveRfaData {
  status: string;
  program: string;
  stripe_customer_id: string;
  stripe_status: string;
  stripe_plan_display: string;
  stripe_subscription_start: string;
  stripe_current_period_end: string;
}

interface RfaStatusCardProps {
  liveRfa: LiveRfaData | null;
  rfaLoading: boolean;
  onSave: (status: string, program: string) => void;
}

export function RfaStatusCard({
  liveRfa,
  rfaLoading,
  onSave,
}: RfaStatusCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    status: "Non-Member",
    program: "",
  });

  const startEdit = () => {
    setDraft({
      status: liveRfa?.status || "Non-Member",
      program: liveRfa?.program || "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    onSave(draft.status, draft.program);
    setEditing(false);
  };

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm border border-border/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2
            className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5"
            style={{ color: PINK }}
          >
            <div
              className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
              style={{
                background: PINK_SUBTLE,
                border: `1px solid ${PINK_BORDER}`,
              }}
            >
              <span className="text-[8px] font-black" style={{ color: PINK }}>
                R
              </span>
            </div>
            RFA Member Status
          </h2>
          {rfaLoading && (
            <span className="text-xs text-muted-foreground">Loading...</span>
          )}
        </div>
        <EditToggle
          editing={editing}
          onEdit={startEdit}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Select
              value={draft.status}
              onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}
            >
              <SelectTrigger className="w-40 bg-background border-border/50 focus:ring-pink-400 text-sm h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Past Due">Past Due</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Canceled">Canceled</SelectItem>
                <SelectItem value="Non-Member">Non-Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Programs</span>
            <Input
              value={draft.program}
              onChange={(e) =>
                setDraft((d) => ({ ...d, program: e.target.value }))
              }
              className="w-40 bg-background border-border/50 focus-visible:ring-pink-400 text-sm h-8"
              placeholder="Inner Circle, etc."
            />
          </div>
        </div>
      ) : !rfaLoading && (!liveRfa || liveRfa.status === "Non-Member") ? (
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
            Non-Member
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            No RFA membership found for this email.
          </p>
        </div>
      ) : !rfaLoading && liveRfa ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{
                background: PINK_SUBTLE,
                color: PINK,
                border: `1px solid ${PINK_BORDER}`,
              }}
            >
              {liveRfa.status}
            </span>
          </div>
          {liveRfa.program && liveRfa.program !== "Non-Member" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Programs</span>
              <div className="flex flex-wrap gap-1">
                {liveRfa.program
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: PINK_SUBTLE,
                        color: PINK,
                        border: `1px solid ${PINK_BORDER}`,
                      }}
                    >
                      {p}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
