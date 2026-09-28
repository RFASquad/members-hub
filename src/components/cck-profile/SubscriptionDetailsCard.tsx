import { useState } from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EditToggle,
  PINK,
  PINK_SUBTLE,
  PINK_BORDER,
  formatDateStr,
} from "./shared";

interface SubscriptionDetailsCardProps {
  planAmountDisplay: string;
  subscriptionStart: string;
  trialEnd: string;
  status: string;
  onSave: (plan: string, started: string, trialEnd: string) => void;
}

export function SubscriptionDetailsCard({
  planAmountDisplay,
  subscriptionStart,
  trialEnd,
  status,
  onSave,
}: SubscriptionDetailsCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    plan: planAmountDisplay,
    started: subscriptionStart,
    trialEnd: trialEnd,
  });

  const startEdit = () => {
    setDraft({ plan: planAmountDisplay, started: subscriptionStart, trialEnd });
    setEditing(true);
  };

  const handleSave = () => {
    onSave(draft.plan, draft.started, draft.trialEnd);
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
            <Calendar className="w-3.5 h-3.5" />
            Subscription Details
          </h2>
          {!editing && planAmountDisplay && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{
                background: PINK_SUBTLE,
                color: PINK,
                border: `1px solid ${PINK_BORDER}`,
              }}
            >
              {planAmountDisplay}
            </span>
          )}
        </div>
        <EditToggle
          editing={editing}
          onEdit={startEdit}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-secondary/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
            Plan
          </p>
          {editing ? (
            <Select
              value={draft.plan}
              onValueChange={(v) => setDraft((d) => ({ ...d, plan: v }))}
            >
              <SelectTrigger className="bg-background border-border/50 focus:ring-pink-400 text-sm font-semibold h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="$97/month">$97/month</SelectItem>
                <SelectItem value="$297/month">$297/month</SelectItem>
                <SelectItem value="$497/month">$497/month</SelectItem>
                <SelectItem value="$0">$0</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <p className="text-base font-bold text-foreground">
              {planAmountDisplay || "—"}
            </p>
          )}
        </div>
        <div className="bg-secondary/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
            Started
          </p>
          {editing ? (
            <Input
              type="date"
              value={draft.started}
              onChange={(e) =>
                setDraft((d) => ({ ...d, started: e.target.value }))
              }
              className="bg-background border-border/50 focus-visible:ring-pink-400 font-semibold h-8 text-sm"
            />
          ) : (
            <p className="text-base font-bold text-foreground">
              {formatDateStr(subscriptionStart)}
            </p>
          )}
        </div>
        <div className="bg-secondary/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
            Trial End
          </p>
          {editing ? (
            <Input
              type="date"
              value={draft.trialEnd}
              onChange={(e) =>
                setDraft((d) => ({ ...d, trialEnd: e.target.value }))
              }
              className="bg-background border-border/50 focus-visible:ring-pink-400 font-semibold h-8 text-sm"
            />
          ) : (
            <p className="text-base font-bold text-foreground">
              {formatDateStr(trialEnd)}
            </p>
          )}
        </div>
        <div className="bg-secondary/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
            Status
          </p>
          <p className="text-base font-bold text-foreground">{status}</p>
        </div>
      </div>
    </div>
  );
}
