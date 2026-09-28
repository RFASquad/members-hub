import {
  ArrowLeft,
  Phone,
  Mail,
  Trash2,
  Building2,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CckMember } from "@/lib/store";
import {
  STATUSES,
  getStatusColor,
  EditToggle,
  PINK,
  PINK_SUBTLE,
  PINK_BORDER,
} from "./shared";

interface HeaderDraft {
  name: string;
  email: string;
  phone: string;
  status: string;
  stripe_customer_id: string;
  ghl_contact_id: string;
}

interface ProfileHeaderProps {
  member: CckMember;
  headerDraft: HeaderDraft;
  setHeaderDraft: React.Dispatch<React.SetStateAction<HeaderDraft>>;
  editingHeader: boolean;
  setEditingHeader: (v: boolean) => void;
  onBack: () => void;
  onSaveHeader: () => void;
  onOpenDelete: () => void;
  crmUrl: string;
  stripeUrl: string;
  businessUrl: string;
  businessName: string;
}

function OutlineButton({
  label,
  url,
  icon,
}: {
  label: string;
  url: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
      style={{
        border: `1px solid ${PINK_BORDER}`,
        color: PINK,
        background: "transparent",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = PINK_SUBTLE)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon}
      {label}
    </button>
  );
}

export function ProfileHeader({
  member,
  headerDraft,
  setHeaderDraft,
  editingHeader,
  setEditingHeader,
  onBack,
  onSaveHeader,
  onOpenDelete,
  crmUrl,
  stripeUrl,
  businessUrl,
  businessName,
}: ProfileHeaderProps) {
  return (
    <div
      className="rounded-xl mb-6 overflow-hidden"
      style={{ background: "#1a1a2e" }}
    >
      <div className="px-6 pt-5 pb-6">
        {/* Top row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-white/50 hover:text-white transition-colors p-1 rounded"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {editingHeader ? (
              <div className="flex items-center gap-3 flex-wrap">
                <Input
                  value={headerDraft.name}
                  onChange={(e) =>
                    setHeaderDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className="text-xl font-bold w-56 bg-white/10 border-white/20 text-white focus-visible:ring-pink-400 placeholder:text-white/40"
                />
                <Select
                  value={headerDraft.status}
                  onValueChange={(v) =>
                    setHeaderDraft((d) => ({ ...d, status: v }))
                  }
                >
                  <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white focus:ring-pink-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-wide">
                  {member.name}
                </h1>
                <Badge
                  className={`border-none px-3 py-1 text-xs font-semibold ${getStatusColor(member.status)}`}
                >
                  {member.status}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <EditToggle
              editing={editingHeader}
              onEdit={() => {
                setHeaderDraft({
                  name: member.name,
                  email: member.email,
                  phone: member.phone || "",
                  status: member.status,
                  stripe_customer_id: member.stripe_customer_id || "",
                  ghl_contact_id: member.ghl_contact_id || "",
                });
                setEditingHeader(true);
              }}
              onSave={onSaveHeader}
              onCancel={() => setEditingHeader(false)}
            />
            <button
              onClick={onOpenDelete}
              className="text-white/40 hover:text-red-400 transition-colors p-1 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Business name subtitle */}
        {!editingHeader && businessName && (
          <div className="flex items-center gap-1.5 ml-9 mb-1">
            <Building2 className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm text-white/50">{businessName}</span>
          </div>
        )}

        {/* Contact info row */}
        {editingHeader ? (
          <div className="flex flex-wrap gap-3 ml-9 mt-3">
            <Input
              value={headerDraft.email}
              onChange={(e) =>
                setHeaderDraft((d) => ({ ...d, email: e.target.value }))
              }
              className="w-52 bg-white/10 border-white/20 text-white text-sm focus-visible:ring-pink-400 placeholder:text-white/40"
              placeholder="Email"
            />
            <Input
              value={headerDraft.phone}
              onChange={(e) =>
                setHeaderDraft((d) => ({ ...d, phone: e.target.value }))
              }
              className="w-44 bg-white/10 border-white/20 text-white text-sm focus-visible:ring-pink-400 placeholder:text-white/40"
              placeholder="Phone"
            />
            <Input
              value={headerDraft.stripe_customer_id}
              onChange={(e) =>
                setHeaderDraft((d) => ({
                  ...d,
                  stripe_customer_id: e.target.value,
                }))
              }
              className="w-52 bg-white/10 border-white/20 text-white text-sm focus-visible:ring-pink-400 placeholder:text-white/40"
              placeholder="Stripe Customer ID"
            />
            <Input
              value={headerDraft.ghl_contact_id}
              onChange={(e) =>
                setHeaderDraft((d) => ({
                  ...d,
                  ghl_contact_id: e.target.value,
                }))
              }
              className="w-52 bg-white/10 border-white/20 text-white text-sm focus-visible:ring-pink-400 placeholder:text-white/40"
              placeholder="CRM Contact ID"
            />
          </div>
        ) : (
          <div className="flex items-center gap-5 text-white/50 text-sm flex-wrap ml-9">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {member.email || "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> {member.phone || "—"}
            </span>
          </div>
        )}

        {/* Action buttons */}
        {!editingHeader && (crmUrl || stripeUrl || businessUrl) && (
          <div className="flex items-center gap-2 mt-4 ml-9 flex-wrap">
            {businessUrl && (
              <OutlineButton
                label="Open Their Business"
                url={businessUrl}
                icon={
                  <>
                    <Building2 className="w-3.5 h-3.5" />
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </>
                }
              />
            )}
            {crmUrl && <OutlineButton label="CRM Profile" url={crmUrl} />}
            {stripeUrl && (
              <OutlineButton label="Stripe Profile" url={stripeUrl} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
