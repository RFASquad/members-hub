import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  FileText,
  Calendar,
  Trash2,
  DollarSign,
  Pencil,
  Check,
  X,
  Plus,
  UserCheck,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  memberStore,
  Member,
  computeTotalValue,
  computeExpirationDate,
  programStore,
} from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { cckMembersTable } from "@/lib/store";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

interface LiveCckData {
  status: string;
  plan_amount_display: string;
  subscription_start: string;
  trial_end: string;
  stripe_customer_id: string;
}

const formatDateStr = (dateStr: string) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, "MM/dd/yyyy");
  } catch {
    return dateStr;
  }
};

const STATUSES = [
  "Active",
  "Past Due",
  "Expired",
  "Canceled",
  "Renewed",
  "On Extension",
  "Pending",
];
const SOURCES_STORAGE_KEY = "rfa_sources";
const DEFAULT_SOURCES = ["Ads", "YouTube", "Referral", "Podcast", "Unknown"];

function getSources(): string[] {
  try {
    const stored = localStorage.getItem(SOURCES_STORAGE_KEY);
    if (stored) {
      const parsed: string[] = JSON.parse(stored);
      return [...new Set([...DEFAULT_SOURCES, ...parsed])];
    }
  } catch {}
  return DEFAULT_SOURCES;
}

function addSource(source: string): string[] {
  const current = getSources();
  if (current.includes(source)) return current;
  const updated = [...current, source];
  const extras = updated.filter((s) => !DEFAULT_SOURCES.includes(s));
  localStorage.setItem(SOURCES_STORAGE_KEY, JSON.stringify(extras));
  return updated;
}

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
  className,
}: {
  value: string;
  onChange: (v: string) => void;
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
      className={className}
      onFocus={() => {
        isFocused.current = true;
        setDisplay((display || "").replace(/[$,]/g, ""));
      }}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={() => {
        isFocused.current = false;
        const f = formatMoneyInput(display);
        setDisplay(f);
        onChange(f);
      }}
    />
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-status-active text-white";
    case "Past Due":
      return "bg-status-past-due text-white";
    case "Expired":
      return "bg-status-expired text-white";
    case "Canceled":
      return "bg-status-canceled text-white";
    case "Renewed":
      return "bg-status-renewed text-white";
    case "On Extension":
      return "bg-status-extension text-white";
    case "Pending":
      return "bg-status-pending text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getCckStatusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-emerald-500 text-white";
    case "Trialing":
      return "bg-blue-500 text-white";
    case "Past Due":
      return "bg-orange-500 text-white";
    case "Canceled":
      return "bg-red-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

function EditToggle({
  editing,
  onEdit,
  onSave,
  onCancel,
}: {
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!editing) {
    return (
      <button
        onClick={onEdit}
        className="text-[#c9a84c]/60 hover:text-[#c9a84c] transition-colors p-1 rounded"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onSave}
        className="text-emerald-400 hover:text-emerald-300 transition-colors p-1 rounded"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={onCancel}
        className="text-red-400 hover:text-red-300 transition-colors p-1 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function MemberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [liveCck, setLiveCck] = useState<LiveCckData | null>(null);
  const [cckLoading, setCckLoading] = useState(false);

  useEffect(() => {
    memberStore.getMembers().then((allMembers) => {
      const found = allMembers.find((m) => m.id === id);
      if (found) setMember(found);
      else {
        toast.error("Member not found");
        navigate("/members");
      }
    });
  }, [id, navigate]);

  // Live CCK cross-reference lookup by email (with name fallback)
  useEffect(() => {
    if (!member?.email) return;
    setCckLoading(true);
    const normalizedEmail = member.email.trim().toLowerCase();
    const fetchCck = async () => {
      const tbl = await cckMembersTable();
      // First try exact email match
      const { data: byEmail } = await supabase
        .from(tbl)
        .select(
          "status, plan_amount_display, subscription_start, trial_end, name, stripe_customer_id",
        )
        .ilike("email", normalizedEmail)
        .maybeSingle();
      if (byEmail) {
        setLiveCck({
          status: byEmail.status || "Non-Member",
          plan_amount_display: byEmail.plan_amount_display || "",
          subscription_start: byEmail.subscription_start || "",
          trial_end: byEmail.trial_end || "",
          stripe_customer_id: byEmail.stripe_customer_id || "",
        });
        setCckLoading(false);
        return;
      }
      // Fallback: match by name (first + last, normalized)
      if (member.name) {
        const normalizedName = member.name.trim().toLowerCase();
        const { data: allCck } = await supabase
          .from(tbl)
          .select(
            "status, plan_amount_display, subscription_start, trial_end, name, email, stripe_customer_id",
          );
        const nameMatch = (allCck || []).find((m: any) => {
          const cckName = (m.name || "").trim().toLowerCase();
          return (
            cckName === normalizedName ||
            cckName.replace(/\s+/g, "") === normalizedName.replace(/\s+/g, "")
          );
        });
        if (nameMatch) {
          setLiveCck({
            status: nameMatch.status || "Non-Member",
            plan_amount_display: nameMatch.plan_amount_display || "",
            subscription_start: nameMatch.subscription_start || "",
            trial_end: nameMatch.trial_end || "",
            stripe_customer_id: nameMatch.stripe_customer_id || "",
          });
          setCckLoading(false);
          return;
        }
      }
      setLiveCck(null);
      setCckLoading(false);
    };
    fetchCck();
  }, [member?.email, member?.name]);

  const [headerDraft, setHeaderDraft] = useState({
    name: "",
    email: "",
    phone: "",
    status: "",
    assignedTo: "",
    closer: "",
    profileUrl: "",
    stripeUrl: "",
    stripe_customer_id: "",
    ghl_contact_id: "",
  });
  const [editingHeader, setEditingHeader] = useState(false);

  const [membershipDraft, setMembershipDraft] = useState({
    joined: "",
    expires: "",
    source: "",
    program: "",
  });
  const [editingMembership, setEditingMembership] = useState(false);
  const [sources, setSources] = useState<string[]>(getSources());
  const [newSourceInput, setNewSourceInput] = useState("");
  const [showAddSource, setShowAddSource] = useState(false);
  const [showAddProgram, setShowAddProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState("");
  const [newProgramDuration, setNewProgramDuration] = useState("12");

  const [paymentDraft, setPaymentDraft] = useState({
    type: "PIF",
    deposit: "$0",
    monthly: "$0",
    months: "12",
    totalValue: "$0",
  });
  const [editingPayment, setEditingPayment] = useState(false);

  const [stripeDraft, setStripeDraft] = useState({
    status: "",
    planDisplay: "",
    start: "",
    end: "",
  });
  const [editingStripe, setEditingStripe] = useState(false);

  const [notes, setNotes] = useState<
    { id: string; text: string; createdAt: string }[]
  >([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const notesEndRef = useRef<HTMLDivElement>(null);

  const [cckDraft, setCckDraft] = useState({
    status: "Non-Member",
    planAmount: "",
    subscriptionStart: "",
    trialEnd: "",
  });
  const [editingCck, setEditingCck] = useState(false);

  useEffect(() => {
    if (member) {
      setHeaderDraft({
        name: member.name,
        email: member.email,
        phone: member.phone,
        status: member.status,
        assignedTo: member.assignedTo || "",
        closer: member.closer || "",
        profileUrl: member.profileUrl || "",
        stripeUrl: member.stripeUrl || "",
        stripe_customer_id: member.stripe_customer_id || "",
        ghl_contact_id: member.ghl_contact_id || "",
      });
      setMembershipDraft({
        joined: member.joined,
        expires: member.expires,
        source: member.source,
        program: member.program,
      });
      setPaymentDraft({ ...member.payment });
      setStripeDraft({
        status: member.stripe_status || "",
        planDisplay: member.stripe_plan_display || "",
        start: member.stripe_subscription_start || "",
        end: member.stripe_current_period_end || "",
      });
      // Parse notes: try JSON array, fall back to legacy plain text
      const raw = member.notes || "";
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setNotes(parsed);
        } else {
          throw new Error();
        }
      } catch {
        if (raw.trim())
          setNotes([
            {
              id: Date.now().toString(),
              text: raw,
              createdAt: new Date().toISOString(),
            },
          ]);
        else setNotes([]);
      }
      setCckDraft({
        status: member.cckStatus || "Non-Member",
        planAmount: member.cckPlanAmount || "",
        subscriptionStart: member.cckSubscriptionStart || "",
        trialEnd: member.cckTrialEnd || "",
      });
    }
  }, [member]);

  const [derivedTotal, setDerivedTotal] = useState("$0");
  useEffect(() => {
    setDerivedTotal(
      computeTotalValue(
        paymentDraft.type,
        paymentDraft.deposit,
        paymentDraft.monthly,
        paymentDraft.months,
      ),
    );
  }, [
    paymentDraft.type,
    paymentDraft.deposit,
    paymentDraft.monthly,
    paymentDraft.months,
  ]);

  useEffect(() => {
    if (liveCck) {
      setCckDraft({
        status: liveCck.status,
        planAmount: liveCck.plan_amount_display,
        subscriptionStart: liveCck.subscription_start,
        trialEnd: liveCck.trial_end,
      });
    }
  }, [liveCck]);

  const handleAddNewSource = () => {
    const trimmed = newSourceInput.trim();
    if (!trimmed) return;
    const updated = addSource(trimmed);
    setSources(updated);
    setMembershipDraft((d) => ({ ...d, source: trimmed }));
    setNewSourceInput("");
    setShowAddSource(false);
  };

  const handleAddNewProgram = () => {
    const trimmed = newProgramName.trim();
    if (!trimmed) return;
    const duration = parseInt(newProgramDuration) || 12;
    const existing = programStore.getPrograms();
    if (!existing.find((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      programStore.savePrograms([
        ...existing,
        { name: trimmed, duration: String(duration), price: "$0" },
      ]);
    }
    let current = membershipDraft.program
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!current.includes(trimmed)) current.push(trimmed);
    const newProgramStr = current.join(", ");
    const newExpires = computeExpirationDate(
      newProgramStr,
      membershipDraft.joined,
    );
    setMembershipDraft((d) => ({
      ...d,
      program: newProgramStr,
      expires: newExpires,
    }));
    const currentMonths = parseInt(paymentDraft.months) || 0;
    if (duration > currentMonths)
      setPaymentDraft((d) => ({ ...d, months: String(duration) }));
    setNewProgramName("");
    setNewProgramDuration("12");
    setShowAddProgram(false);
  };

  if (!member) return null;

  const handleSaveHeader = async () => {
    const updatedDraft = {
      ...headerDraft,
      assignedTo: member.program
        .split(",")
        .some((p) => ["Supercharge", "VIP", "Concierge"].includes(p.trim()))
        ? headerDraft.assignedTo
        : "",
    };
    try {
      await memberStore.updateMember(member.id, updatedDraft);
      setMember({ ...member, ...updatedDraft });
      setEditingHeader(false);
      toast.success("Header updated");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleSaveMembership = async () => {
    try {
      await memberStore.updateMember(member.id, membershipDraft);
      setMember({ ...member, ...membershipDraft });
      setEditingMembership(false);
      toast.success("Membership details updated");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleSavePayment = async () => {
    const updatedPayment = { ...paymentDraft, totalValue: derivedTotal };
    try {
      await memberStore.updateMember(member.id, {
        payment: updatedPayment,
        ltv: updatedPayment.totalValue,
      });
      setMember({
        ...member,
        payment: updatedPayment,
        ltv: updatedPayment.totalValue,
      });
      setEditingPayment(false);
      toast.success("Payment details updated");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleAddNote = async () => {
    const trimmed = newNoteText.trim();
    if (!trimmed) return;
    const newNote = {
      id: Date.now().toString(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    const updated = [...notes, newNote];
    try {
      await memberStore.updateMember(member.id, {
        notes: JSON.stringify(updated),
      });
      setMember({ ...member, notes: JSON.stringify(updated) });
      setNotes(updated);
      setNewNoteText("");
      setShowNoteInput(false);
      setTimeout(
        () => notesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const updated = notes.filter((n) => n.id !== noteId);
    try {
      await memberStore.updateMember(member.id, {
        notes: JSON.stringify(updated),
      });
      setMember({ ...member, notes: JSON.stringify(updated) });
      setNotes(updated);
    } catch (err: any) {
      toast.error(`Delete failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleSaveEditedNote = async (noteId: string) => {
    const trimmed = editingNoteText.trim();
    if (!trimmed) return;
    const updated = notes.map((n) =>
      n.id === noteId ? { ...n, text: trimmed } : n,
    );
    try {
      await memberStore.updateMember(member.id, {
        notes: JSON.stringify(updated),
      });
      setMember({ ...member, notes: JSON.stringify(updated) });
      setNotes(updated);
      setEditingNoteId(null);
      setEditingNoteText("");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleSaveStripe = async () => {
    try {
      const updates = {
        stripe_status: stripeDraft.status,
        stripe_plan_display: stripeDraft.planDisplay,
        stripe_subscription_start: stripeDraft.start || null,
        stripe_current_period_end: stripeDraft.end || null,
      };
      await memberStore.updateMember(member.id, updates);
      setMember({ ...member, ...updates });
      setEditingStripe(false);
      toast.success("Subscription plans updated");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleSaveCck = async () => {
    try {
      let cckMemberId = null;
      const tbl = await cckMembersTable();
      if (member.email) {
        const { data: byEmail } = await supabase
          .from(tbl)
          .select("id")
          .ilike("email", member.email.trim())
          .maybeSingle();
        if (byEmail) cckMemberId = byEmail.id;
      }
      if (!cckMemberId && member.name) {
        const normalizedName = member.name.trim().toLowerCase();
        const { data: allCck } = await supabase.from(tbl).select("id, name");
        const nameMatch = (allCck || []).find((m: any) => {
          const cckName = (m.name || "").trim().toLowerCase();
          return (
            cckName === normalizedName ||
            cckName.replace(/\s+/g, "") === normalizedName.replace(/\s+/g, "")
          );
        });
        if (nameMatch) cckMemberId = nameMatch.id;
      }

      if (cckMemberId) {
        const planAmountNum =
          parseInt(cckDraft.planAmount.replace(/[^0-9]/g, "")) * 100 || 0;
        const cckUpdates = {
          status: cckDraft.status,
          plan_amount_display: cckDraft.planAmount,
          plan_amount: planAmountNum,
          subscription_start: cckDraft.subscriptionStart || null,
          trial_end: cckDraft.trialEnd || null,
        };
        const { error } = await supabase
          .from("cck_members")
          .update(cckUpdates)
          .eq("id", cckMemberId);
        if (error) throw error;
      } else {
        toast.warning("No CCK profile found to sync status.");
      }

      if (liveCck) {
        setLiveCck({
          ...liveCck,
          status: cckDraft.status,
          plan_amount_display: cckDraft.planAmount,
          subscription_start: cckDraft.subscriptionStart || "",
          trial_end: cckDraft.trialEnd || "",
        });
      } else {
        setLiveCck({
          status: cckDraft.status,
          plan_amount_display: cckDraft.planAmount,
          subscription_start: cckDraft.subscriptionStart || "",
          trial_end: cckDraft.trialEnd || "",
          stripe_customer_id: "",
        });
      }
      setEditingCck(false);
      toast.success("CCK details updated");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleDelete = async () => {
    await memberStore.deleteMember(member.id);
    navigate("/members");
    toast.success(`${member.name} has been deleted.`);
  };

  const contactId = (member.ghl_contact_id || "").trim();
  const ghlUrl =
    contactId && contactId !== "null"
      ? `https://app.communicake.io/v2/location/MaVxnFAmOgSQzf6l9ISU/contacts/detail/${contactId}`
      : (member.profileUrl || "").trim();
  // The Stripe IDs are swapped in the DB.
  // RFA profile needs the RFA Stripe ID, which is currently stored in cck_members.stripe_customer_id (liveCck).
  const rfaStripeId = (member.stripe_customer_id || "").trim();
  const stripeUrl =
    rfaStripeId && rfaStripeId !== "null"
      ? `https://dashboard.stripe.com/acct_1ClGp3Aoa0RlwaBI/customers/${rfaStripeId}`
      : (member.stripeUrl || "").trim();

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* ── DARK HEADER ── */}
      <div
        className="rounded-xl mb-6 overflow-hidden"
        style={{ background: "#1a1a2e" }}
      >
        <div className="px-6 pt-5 pb-6">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
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
                    className="text-xl font-bold w-56 bg-white/10 border-white/20 text-white focus-visible:ring-[#c9a84c] placeholder:text-white/40"
                  />
                  <Select
                    value={headerDraft.status}
                    onValueChange={(v) =>
                      setHeaderDraft((d) => ({ ...d, status: v }))
                    }
                  >
                    <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white focus:ring-[#c9a84c]">
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
                    phone: member.phone,
                    status: member.status,
                    assignedTo: member.assignedTo || "",
                    closer: member.closer || "",
                    profileUrl: member.profileUrl || "",
                    stripeUrl: member.stripeUrl || "",
                    stripe_customer_id: member.stripe_customer_id || "",
                    ghl_contact_id: member.ghl_contact_id || "",
                  });
                  setEditingHeader(true);
                }}
                onSave={handleSaveHeader}
                onCancel={() => setEditingHeader(false)}
              />
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-white/40 hover:text-red-400 transition-colors p-1 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contact info row */}
          {editingHeader ? (
            <div className="flex flex-col gap-3 ml-9 mt-3">
              <div className="flex flex-wrap gap-3">
                <Input
                  value={headerDraft.email}
                  onChange={(e) =>
                    setHeaderDraft((d) => ({ ...d, email: e.target.value }))
                  }
                  className="w-52 bg-white/10 border-white/20 text-white text-sm focus-visible:ring-[#c9a84c] placeholder:text-white/40"
                  placeholder="Email"
                />
                <Input
                  value={headerDraft.phone}
                  onChange={(e) =>
                    setHeaderDraft((d) => ({ ...d, phone: e.target.value }))
                  }
                  className="w-44 bg-white/10 border-white/20 text-white text-sm focus-visible:ring-[#c9a84c] placeholder:text-white/40"
                  placeholder="Phone"
                />
                <Select
                  value={headerDraft.closer}
                  onValueChange={(v) =>
                    setHeaderDraft((d) => ({ ...d, closer: v }))
                  }
                >
                  <SelectTrigger className="w-36 bg-white/10 border-white/20 text-white text-sm focus:ring-[#c9a84c]">
                    <SelectValue placeholder="Closer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Stephen B">Stephen B</SelectItem>
                    <SelectItem value="Stephen J">Stephen J</SelectItem>
                    <SelectItem value="Webinar">Webinar</SelectItem>
                  </SelectContent>
                </Select>
                {member.program
                  .split(",")
                  .some((p) =>
                    ["Supercharge", "VIP", "Concierge"].includes(p.trim()),
                  ) && (
                  <Select
                    value={headerDraft.assignedTo}
                    onValueChange={(v) =>
                      setHeaderDraft((d) => ({ ...d, assignedTo: v }))
                    }
                  >
                    <SelectTrigger className="w-36 bg-white/10 border-white/20 text-white text-sm focus:ring-[#c9a84c]">
                      <SelectValue placeholder="Assigned To" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Stephen B">Stephen B</SelectItem>
                      <SelectItem value="Stephen J">Stephen J</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Input
                  value={headerDraft.stripe_customer_id}
                  onChange={(e) =>
                    setHeaderDraft((d) => ({
                      ...d,
                      stripe_customer_id: e.target.value,
                    }))
                  }
                  className="w-64 bg-white/10 border-white/20 text-white text-sm focus-visible:ring-[#c9a84c] placeholder:text-white/40"
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
                  className="w-64 bg-white/10 border-white/20 text-white text-sm focus-visible:ring-[#c9a84c] placeholder:text-white/40"
                  placeholder="CRM Contact ID"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-5 text-white/50 text-sm flex-wrap ml-9">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {member.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {member.phone || "—"}
              </span>
              {member.closer && (
                <span className="flex items-center gap-1.5 text-[#c9a84c]/80">
                  <UserCheck className="w-3.5 h-3.5" /> {member.closer}
                </span>
              )}
              {member.assignedTo &&
                member.program
                  .split(",")
                  .some((p) =>
                    ["Supercharge", "VIP", "Concierge"].includes(p.trim()),
                  ) && (
                  <span className="flex items-center gap-1.5 text-[#c9a84c]/80">
                    <UserCheck className="w-3.5 h-3.5" /> Mentor:{" "}
                    {member.assignedTo}
                  </span>
                )}
            </div>
          )}

          {/* Action buttons */}
          {!editingHeader && (ghlUrl || stripeUrl) && (
            <div className="flex items-center gap-2 mt-4 ml-9">
              {ghlUrl && (
                <button
                  onClick={() =>
                    window.open(ghlUrl, "_blank", "noopener,noreferrer")
                  }
                  className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
                  style={{
                    border: "1px solid rgba(201,168,76,0.5)",
                    color: "#c9a84c",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(201,168,76,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  CRM Profile
                </button>
              )}
              {stripeUrl && (
                <button
                  onClick={() =>
                    window.open(stripeUrl, "_blank", "noopener,noreferrer")
                  }
                  className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
                  style={{
                    border: "1px solid rgba(201,168,76,0.5)",
                    color: "#c9a84c",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(201,168,76,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  Stripe Profile
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* LEFT COLUMN — 60% */}
        <div className="lg:col-span-3 space-y-5">
          {/* MEMBERSHIP DETAILS */}
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2
                  className="text-xs font-bold tracking-widest uppercase"
                  style={{ color: "#c9a84c" }}
                >
                  <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
                  Membership Details
                </h2>
                {!editingMembership && (
                  <div className="flex flex-wrap gap-1">
                    {member.program
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((p) => (
                        <span
                          key={p}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            background: "rgba(201,168,76,0.15)",
                            color: "#c9a84c",
                            border: "1px solid rgba(201,168,76,0.3)",
                          }}
                        >
                          {p}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <EditToggle
                editing={editingMembership}
                onEdit={() => setEditingMembership(true)}
                onSave={handleSaveMembership}
                onCancel={() => {
                  setEditingMembership(false);
                  setShowAddSource(false);
                  setNewSourceInput("");
                  setShowAddProgram(false);
                  setNewProgramName("");
                  setNewProgramDuration("12");
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                  Date Joined
                </p>
                {editingMembership ? (
                  <Input
                    value={membershipDraft.joined}
                    onChange={(e) =>
                      setMembershipDraft((d) => ({
                        ...d,
                        joined: e.target.value,
                      }))
                    }
                    className="bg-background border-border/50 focus-visible:ring-primary font-semibold h-8 text-sm"
                  />
                ) : (
                  <p className="text-base font-bold text-foreground">
                    {formatDateStr(member.joined)}
                  </p>
                )}
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                  Expiration Date
                </p>
                {editingMembership ? (
                  <Input
                    value={membershipDraft.expires}
                    onChange={(e) =>
                      setMembershipDraft((d) => ({
                        ...d,
                        expires: e.target.value,
                      }))
                    }
                    className="bg-background border-border/50 focus-visible:ring-primary font-semibold h-8 text-sm"
                  />
                ) : (
                  <p className="text-base font-bold text-foreground">
                    {formatDateStr(member.expires)}
                  </p>
                )}
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                  Source
                </p>
                {editingMembership ? (
                  <div className="space-y-1.5">
                    <Select
                      value={membershipDraft.source}
                      onValueChange={(v) => {
                        if (v === "__add_new__") {
                          setShowAddSource(true);
                        } else {
                          setMembershipDraft((d) => ({ ...d, source: v }));
                          setShowAddSource(false);
                        }
                      }}
                    >
                      <SelectTrigger className="bg-background border-border/50 focus:ring-primary font-semibold h-8 text-sm">
                        <SelectValue placeholder="Select source..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sources.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                        <SelectItem
                          value="__add_new__"
                          className="text-primary font-semibold"
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" /> Add new source
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {showAddSource && (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={newSourceInput}
                          onChange={(e) => setNewSourceInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddNewSource();
                          }}
                          placeholder="New source..."
                          className="bg-background border-border/50 focus-visible:ring-primary text-xs h-7"
                          autoFocus
                        />
                        <button
                          onClick={handleAddNewSource}
                          className="text-emerald-400 p-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setShowAddSource(false);
                            setNewSourceInput("");
                          }}
                          className="text-red-400 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-base font-bold text-foreground">
                    {member.source || "—"}
                  </p>
                )}
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                  Program
                </p>
                {editingMembership ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {programStore.getPrograms().map((p) => {
                        const isSelected = membershipDraft.program
                          .split(",")
                          .map((s) => s.trim().toLowerCase())
                          .includes(p.name.toLowerCase());
                        return (
                          <button
                            key={p.name}
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${isSelected ? "text-white border-transparent" : "border-border/50 text-muted-foreground hover:border-primary/50"}`}
                            style={
                              isSelected
                                ? {
                                    background: "#c9a84c",
                                    borderColor: "#c9a84c",
                                  }
                                : {}
                            }
                            onClick={() => {
                              let current = membershipDraft.program
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean);
                              const lowerCurrent = current.map((c) =>
                                c.toLowerCase(),
                              );
                              const lowerName = p.name.toLowerCase();
                              if (lowerCurrent.includes(lowerName)) {
                                current = current.filter(
                                  (x) => x.toLowerCase() !== lowerName,
                                );
                              } else {
                                current.push(p.name);
                              }
                              const newProgramStr = current.join(", ");
                              const newExpires = computeExpirationDate(
                                newProgramStr,
                                membershipDraft.joined,
                              );
                              setMembershipDraft((d) => ({
                                ...d,
                                program: newProgramStr,
                                expires: newExpires,
                              }));
                              const durations = programStore
                                .getPrograms()
                                .reduce(
                                  (acc, p) => ({
                                    ...acc,
                                    [p.name]: parseInt(p.duration) || 12,
                                  }),
                                  {} as Record<string, number>,
                                );
                              let maxMonths = 0;
                              current.forEach((prog) => {
                                const m = durations[prog] ?? 12;
                                if (m > maxMonths) maxMonths = m;
                              });
                              if (maxMonths > 0)
                                setPaymentDraft((d) => ({
                                  ...d,
                                  months: String(maxMonths),
                                }));
                            }}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                      <button
                        className="px-2 py-0.5 rounded-full text-xs font-semibold border border-dashed border-border/50 text-muted-foreground hover:border-primary/50 transition-colors"
                        onClick={() => setShowAddProgram(true)}
                      >
                        + Custom
                      </button>
                    </div>
                    {showAddProgram && (
                      <div className="flex flex-col gap-2 mt-2 bg-background p-3 rounded-md border border-border/50">
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground tracking-widest mb-1">
                            Program Name
                          </p>
                          <Input
                            value={newProgramName}
                            onChange={(e) => setNewProgramName(e.target.value)}
                            placeholder="e.g. Mastermind"
                            className="bg-secondary/30 border-border/50 focus-visible:ring-primary text-sm h-8"
                            autoFocus
                          />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground tracking-widest mb-1">
                            Duration (Months)
                          </p>
                          <Input
                            type="number"
                            value={newProgramDuration}
                            onChange={(e) =>
                              setNewProgramDuration(e.target.value)
                            }
                            placeholder="12"
                            className="bg-secondary/30 border-border/50 focus-visible:ring-primary text-sm h-8"
                            min="1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-primary text-primary-foreground hover:bg-accent font-bold flex-1 h-8"
                            onClick={handleAddNewProgram}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive h-8"
                            onClick={() => {
                              setShowAddProgram(false);
                              setNewProgramName("");
                              setNewProgramDuration("12");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {member.program
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((p) => (
                        <span
                          key={p}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            background: "rgba(201,168,76,0.12)",
                            color: "#c9a84c",
                            border: "1px solid rgba(201,168,76,0.25)",
                          }}
                        >
                          {p}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PAYMENT DETAILS */}
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border/30">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: "#c9a84c" }}
              >
                <DollarSign className="w-3.5 h-3.5 inline mr-1.5" />
                Payment Details
              </h2>
              <EditToggle
                editing={editingPayment}
                onEdit={() => setEditingPayment(true)}
                onSave={handleSavePayment}
                onCancel={() => setEditingPayment(false)}
              />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border/20">
                <span className="text-sm text-muted-foreground">Structure</span>
                {editingPayment ? (
                  <Select
                    value={paymentDraft.type}
                    onValueChange={(v) =>
                      setPaymentDraft((d) => ({ ...d, type: v }))
                    }
                  >
                    <SelectTrigger className="w-44 bg-background border-border/50 focus:ring-primary text-sm font-semibold h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIF">PIF</SelectItem>
                      <SelectItem value="Deposit + Monthly">
                        Deposit + Monthly
                      </SelectItem>
                      <SelectItem value="Monthly Only">Monthly Only</SelectItem>
                      <SelectItem value="Placed Deposit">
                        Placed Deposit
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="font-semibold text-sm">
                    {member.payment.type}
                  </span>
                )}
              </div>
              {paymentDraft.type !== "Monthly Only" && (
                <div className="flex justify-between items-center py-2 border-b border-border/20">
                  <span className="text-sm text-muted-foreground">
                    {paymentDraft.type === "PIF" ? "Amount Paid" : "Deposit"}
                  </span>
                  {editingPayment ? (
                    <MoneyInput
                      value={paymentDraft.deposit}
                      onChange={(v) =>
                        setPaymentDraft((d) => ({ ...d, deposit: v }))
                      }
                      className="w-36 text-right bg-background border-border/50 focus-visible:ring-primary text-sm font-semibold h-8"
                    />
                  ) : (
                    <span className="font-semibold text-sm">
                      {member.payment.deposit}
                    </span>
                  )}
                </div>
              )}
              {paymentDraft.type !== "PIF" &&
                paymentDraft.type !== "Placed Deposit" && (
                  <>
                    <div className="flex justify-between items-center py-2 border-b border-border/20">
                      <span className="text-sm text-muted-foreground">
                        Monthly
                      </span>
                      {editingPayment ? (
                        <MoneyInput
                          value={paymentDraft.monthly}
                          onChange={(v) =>
                            setPaymentDraft((d) => ({ ...d, monthly: v }))
                          }
                          className="w-36 text-right bg-background border-border/50 focus-visible:ring-primary text-sm font-semibold h-8"
                        />
                      ) : (
                        <span className="font-semibold text-sm">
                          {member.payment.monthly}/mo
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/20">
                      <span className="text-sm text-muted-foreground">
                        Months
                      </span>
                      {editingPayment ? (
                        <Input
                          value={paymentDraft.months}
                          onChange={(e) =>
                            setPaymentDraft((d) => ({
                              ...d,
                              months: e.target.value,
                            }))
                          }
                          className="w-36 text-right bg-background border-border/50 focus-visible:ring-primary text-sm font-semibold h-8"
                        />
                      ) : (
                        <span className="font-semibold text-sm">
                          {member.payment.months} mo
                        </span>
                      )}
                    </div>
                  </>
                )}
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-muted-foreground">
                  Total Value
                </span>
                <span
                  className="font-bold text-base"
                  style={{ color: "#c9a84c" }}
                >
                  {editingPayment ? derivedTotal : member.payment.totalValue}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — 40% */}
        <div className="lg:col-span-2 space-y-5">
          {/* SUBSCRIPTION PLANS */}
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border/30">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5"
                style={{ color: "#c9a84c" }}
              >
                <DollarSign className="w-3.5 h-3.5" />
                Subscription Plans
              </h2>
              <EditToggle
                editing={editingStripe}
                onEdit={() => setEditingStripe(true)}
                onSave={handleSaveStripe}
                onCancel={() => setEditingStripe(false)}
              />
            </div>

            {editingStripe ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Select
                    value={stripeDraft.status}
                    onValueChange={(v) =>
                      setStripeDraft((d) => ({ ...d, status: v }))
                    }
                  >
                    <SelectTrigger className="w-40 bg-background border-border/50 focus:ring-primary text-sm h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Past Due">Past Due</SelectItem>
                      <SelectItem value="Canceled">Canceled</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Monthly Amount
                  </span>
                  <Input
                    value={stripeDraft.planDisplay}
                    onChange={(e) =>
                      setStripeDraft((d) => ({
                        ...d,
                        planDisplay: e.target.value,
                      }))
                    }
                    className="w-40 bg-background border-border/50 focus-visible:ring-primary text-sm h-8"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Started</span>
                  <Input
                    type="date"
                    value={stripeDraft.start}
                    onChange={(e) =>
                      setStripeDraft((d) => ({ ...d, start: e.target.value }))
                    }
                    className="w-40 bg-background border-border/50 focus-visible:ring-primary text-sm h-8"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Ends / Renews
                  </span>
                  <Input
                    type="date"
                    value={stripeDraft.end}
                    onChange={(e) =>
                      setStripeDraft((d) => ({ ...d, end: e.target.value }))
                    }
                    className="w-40 bg-background border-border/50 focus-visible:ring-primary text-sm h-8"
                  />
                </div>
              </div>
            ) : !member.stripe_status || member.stripe_status === "None" ? (
              <div className="flex flex-col items-center justify-center py-5 gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(201,168,76,0.08)" }}
                >
                  <DollarSign
                    className="w-4 h-4"
                    style={{ color: "#c9a84c", opacity: 0.4 }}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  No current payment plans active
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/30 overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: "rgba(201,168,76,0.06)" }}
                >
                  <span className="text-sm font-bold text-foreground">
                    RFA Membership
                  </span>
                  <Badge
                    className={`border-none text-xs px-2.5 py-0.5 font-semibold ${
                      member.stripe_status.toLowerCase() === "active"
                        ? "bg-emerald-500 text-white"
                        : member.stripe_status.toLowerCase() === "past due"
                          ? "bg-red-500 text-white"
                          : member.stripe_status.toLowerCase() === "completed"
                            ? "bg-blue-500 text-white"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {member.stripe_status}
                  </Badge>
                </div>
                <div className="divide-y divide-border/20">
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      Monthly Amount
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: "#c9a84c" }}
                    >
                      {member.stripe_plan_display || "—"}
                    </span>
                  </div>
                  {member.stripe_subscription_start && (
                    <div className="flex justify-between items-center px-4 py-2.5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                        Started
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatDateStr(member.stripe_subscription_start)}
                      </span>
                    </div>
                  )}
                  {member.stripe_current_period_end && (
                    <div className="flex justify-between items-center px-4 py-2.5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                        Ends / Renews
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatDateStr(member.stripe_current_period_end)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CCK DETAILS — live read-only from cck_members */}
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2
                  className="text-xs font-bold tracking-widest uppercase"
                  style={{ color: "#c9a84c" }}
                >
                  CCK Details
                </h2>
                {cckLoading && (
                  <span className="text-xs text-muted-foreground">
                    Loading...
                  </span>
                )}
              </div>
              <EditToggle
                editing={editingCck}
                onEdit={() => setEditingCck(true)}
                onSave={handleSaveCck}
                onCancel={() => setEditingCck(false)}
              />
            </div>

            {editingCck ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Select
                    value={cckDraft.status}
                    onValueChange={(v) =>
                      setCckDraft((d) => ({ ...d, status: v }))
                    }
                  >
                    <SelectTrigger className="w-40 bg-background border-border/50 focus:ring-primary text-sm h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Trialing">Trialing</SelectItem>
                      <SelectItem value="Past Due">Past Due</SelectItem>
                      <SelectItem value="Canceled">Canceled</SelectItem>
                      <SelectItem value="Non-Member">Non-Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <Select
                    value={cckDraft.planAmount}
                    onValueChange={(v) =>
                      setCckDraft((d) => ({ ...d, planAmount: v }))
                    }
                  >
                    <SelectTrigger className="w-40 bg-background border-border/50 focus:ring-primary text-sm h-8">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="$97/month">$97/month</SelectItem>
                      <SelectItem value="$297/month">$297/month</SelectItem>
                      <SelectItem value="$497/month">$497/month</SelectItem>
                      <SelectItem value="$0">$0</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Start Date
                  </span>
                  <Input
                    type="date"
                    value={cckDraft.subscriptionStart}
                    onChange={(e) =>
                      setCckDraft((d) => ({
                        ...d,
                        subscriptionStart: e.target.value,
                      }))
                    }
                    className="w-40 bg-background border-border/50 focus-visible:ring-primary text-sm h-8"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Trial End
                  </span>
                  <Input
                    type="date"
                    value={cckDraft.trialEnd}
                    onChange={(e) =>
                      setCckDraft((d) => ({ ...d, trialEnd: e.target.value }))
                    }
                    className="w-40 bg-background border-border/50 focus-visible:ring-primary text-sm h-8"
                  />
                </div>
              </div>
            ) : !liveCck?.status || liveCck.status === "Non-Member" ? (
              <div className="space-y-1">
                <Badge className="border-none text-xs px-2.5 py-0.5 bg-muted text-muted-foreground">
                  Non-Member
                </Badge>
                <p className="text-xs text-muted-foreground pt-1">
                  No CCK subscription found for this email.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    className={`border-none text-xs px-2.5 py-0.5 ${getCckStatusColor(liveCck.status)}`}
                  >
                    {liveCck.status}
                  </Badge>
                </div>
                {liveCck.status !== "Non-Member" && (
                  <>
                    {liveCck.plan_amount_display &&
                      liveCck.plan_amount_display !== "None" && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Plan
                          </span>
                          <span className="font-semibold text-sm">
                            {liveCck.plan_amount_display}
                          </span>
                        </div>
                      )}
                    {liveCck.subscription_start && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Start Date
                        </span>
                        <span className="font-semibold text-sm">
                          {formatDateStr(liveCck.subscription_start)}
                        </span>
                      </div>
                    )}
                    {liveCck.trial_end && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Trial End
                        </span>
                        <span className="font-semibold text-sm">
                          {formatDateStr(liveCck.trial_end)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* NOTES */}
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border/30 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5"
                style={{ color: "#c9a84c" }}
              >
                <FileText className="w-3.5 h-3.5" />
                Notes
              </h2>
              <button
                onClick={() => {
                  setShowNoteInput(!showNoteInput);
                  if (!showNoteInput) {
                    setTimeout(() => {
                      const el = document.getElementById("rfa-new-note-input");
                      el?.focus();
                    }, 50);
                  }
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center transition-colors text-[#c9a84c]/60 hover:text-[#c9a84c]"
                style={{
                  background: "rgba(201,168,76,0.12)",
                  border: "1px solid rgba(201,168,76,0.25)",
                }}
                title={showNoteInput ? "Cancel" : "Add note"}
              >
                {showNoteInput ? (
                  <X className="w-3 h-3" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
              </button>
            </div>
            {/* Scrollable notes list */}
            <div
              className="overflow-y-auto space-y-2 mb-3 pr-1"
              style={{ maxHeight: "260px", minHeight: "80px" }}
            >
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No notes yet.
                </p>
              ) : (
                [...notes].reverse().map((note) => (
                  <div
                    key={note.id}
                    className="group bg-secondary/30 rounded-lg px-3 py-2.5 flex items-start gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      {editingNoteId === note.id ? (
                        <div className="space-y-1.5">
                          <Textarea
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEditedNote(note.id);
                              }
                              if (e.key === "Escape") {
                                setEditingNoteId(null);
                                setEditingNoteText("");
                              }
                            }}
                            className="w-full min-h-[60px] max-h-[120px] bg-background border-border/50 focus-visible:ring-primary resize-none text-sm"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveEditedNote(note.id)}
                              className="text-xs font-semibold px-2 py-1 rounded transition-colors"
                              style={{
                                background: "rgba(201,168,76,0.15)",
                                color: "#c9a84c",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingNoteId(null);
                                setEditingNoteText("");
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p
                            className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words cursor-text"
                            onDoubleClick={() => {
                              setEditingNoteId(note.id);
                              setEditingNoteText(note.text);
                            }}
                          >
                            {note.text}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {(() => {
                              try {
                                return format(
                                  new Date(note.createdAt),
                                  "MMM d, yyyy 'at' h:mm a",
                                );
                              } catch {
                                return "";
                              }
                            })()}
                            <span
                              className="ml-2 opacity-0 group-hover:opacity-60 transition-opacity cursor-pointer hover:opacity-100"
                              onClick={() => {
                                setEditingNoteId(note.id);
                                setEditingNoteText(note.text);
                              }}
                            >
                              edit
                            </span>
                          </p>
                        </>
                      )}
                    </div>
                    {editingNoteId !== note.id && (
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 p-0.5 rounded shrink-0 mt-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
              <div ref={notesEndRef} />
            </div>
            {/* New note input */}
            {showNoteInput && (
              <div className="flex items-end gap-2 border-t border-border/20 pt-3">
                <Textarea
                  id="rfa-new-note-input"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddNote();
                    }
                    if (e.key === "Escape") {
                      setShowNoteInput(false);
                      setNewNoteText("");
                    }
                  }}
                  placeholder="Add a note... (Enter to save)"
                  className="flex-1 min-h-[60px] max-h-[120px] bg-background border-border/50 focus-visible:ring-primary resize-none text-sm"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNoteText.trim()}
                  className="shrink-0 p-2.5 rounded-lg transition-colors disabled:opacity-30"
                  style={{
                    background: "rgba(201,168,76,0.15)",
                    color: "#c9a84c",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(201,168,76,0.25)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "rgba(201,168,76,0.15)")
                  }
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-card border-border/50 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold tracking-wide uppercase flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> Delete Member
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">
                {member?.name}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/50 hover:bg-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
