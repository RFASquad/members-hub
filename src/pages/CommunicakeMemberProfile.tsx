import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
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
import { cckStore, CckMember } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { membersTable } from "@/lib/store";
import { toast } from "sonner";
import { SubscriptionDetailsCard } from "@/components/cck-profile/SubscriptionDetailsCard";
import {
  RfaStatusCard,
  LiveRfaData,
} from "@/components/cck-profile/RfaStatusCard";
import { NotesCard, NoteItem } from "@/components/cck-profile/NotesCard";
import { ProfileHeader } from "@/components/cck-profile/ProfileHeader";

interface HeaderDraft {
  name: string;
  email: string;
  phone: string;
  status: string;
  stripe_customer_id: string;
  ghl_contact_id: string;
}

export default function CommunicakeMemberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState<CckMember | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [liveRfa, setLiveRfa] = useState<LiveRfaData | null>(null);
  const [rfaLoading, setRfaLoading] = useState(false);

  const [headerDraft, setHeaderDraft] = useState<HeaderDraft>({
    name: "",
    email: "",
    phone: "",
    status: "",
    stripe_customer_id: "",
    ghl_contact_id: "",
  });
  const [editingHeader, setEditingHeader] = useState(false);

  const [notes, setNotes] = useState<NoteItem[]>([]);

  // Read the member (including ghl_location_id + business_name) from the
  // communicake_members view in a SINGLE query. cck_members is RLS-restricted
  // and returns 0 rows to the dashboard session; communicake_members is the
  // frontend-facing view and returns all members with every column. No second
  // supplement query, no merging two sources — that merge is what nulled the
  // business fields out before.
  useEffect(() => {
    if (!id) return;
    supabase
      .from("communicake_members")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Member not found");
          navigate("/communicake/members");
          return;
        }
        setMember(data as CckMember);
      });
  }, [id, navigate]);

  useEffect(() => {
    if (member) {
      setHeaderDraft({
        name: member.name,
        email: member.email,
        phone: member.phone || "",
        status: member.status,
        stripe_customer_id: member.stripe_customer_id || "",
        ghl_contact_id: member.ghl_contact_id || "",
      });
      const raw = (member as any).notes || "";
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
    }
  }, [member]);

  // Live RFA cross-reference lookup by email (with name fallback)
  useEffect(() => {
    if (!member) return;
    setRfaLoading(true);
    const normalizedEmail = (member.email || "").trim().toLowerCase();
    const fetchRfa = async () => {
      const tbl = await membersTable();
      const { data: byEmail } = await supabase
        .from(tbl)
        .select(
          "status, program, name, stripe_customer_id, stripe_status, stripe_plan_display, stripe_subscription_start, stripe_current_period_end",
        )
        .ilike("email", normalizedEmail)
        .maybeSingle();
      if (byEmail) {
        const isExpired =
          byEmail.status === "Expired" || byEmail.status === "Canceled";
        setLiveRfa({
          status: isExpired ? "Non-Member" : byEmail.status || "Unknown",
          program: isExpired ? "Non-Member" : byEmail.program || "",
          stripe_customer_id: byEmail.stripe_customer_id || "",
          stripe_status: byEmail.stripe_status || "",
          stripe_plan_display: byEmail.stripe_plan_display || "",
          stripe_subscription_start: byEmail.stripe_subscription_start || "",
          stripe_current_period_end: byEmail.stripe_current_period_end || "",
        });
        setRfaLoading(false);
        return;
      }
      if (member.name) {
        const normalizedName = member.name.trim().toLowerCase();
        const { data: allRfa } = await supabase
          .from(tbl)
          .select(
            "status, program, name, email, stripe_customer_id, stripe_status, stripe_plan_display, stripe_subscription_start, stripe_current_period_end",
          );
        const nameMatch = (allRfa || []).find((m: any) => {
          const rfaName = (m.name || "").trim().toLowerCase();
          return (
            rfaName === normalizedName ||
            rfaName.replace(/\s+/g, "") === normalizedName.replace(/\s+/g, "")
          );
        });
        if (nameMatch) {
          const isExpired =
            nameMatch.status === "Expired" || nameMatch.status === "Canceled";
          setLiveRfa({
            status: isExpired ? "Non-Member" : nameMatch.status || "Unknown",
            program: isExpired ? "Non-Member" : nameMatch.program || "",
            stripe_customer_id: nameMatch.stripe_customer_id || "",
            stripe_status: nameMatch.stripe_status || "",
            stripe_plan_display: nameMatch.stripe_plan_display || "",
            stripe_subscription_start:
              nameMatch.stripe_subscription_start || "",
            stripe_current_period_end:
              nameMatch.stripe_current_period_end || "",
          });
          setRfaLoading(false);
          return;
        }
      }
      setLiveRfa(null);
      setRfaLoading(false);
    };
    fetchRfa();
  }, [member?.email, member?.name]);

  if (!member) return null;

  const handleSaveHeader = async () => {
    try {
      const updates: Partial<CckMember> = {
        name: headerDraft.name,
        email: headerDraft.email,
        phone: headerDraft.phone,
        status: headerDraft.status,
        stripe_customer_id: headerDraft.stripe_customer_id,
        ghl_contact_id: headerDraft.ghl_contact_id,
      };
      await cckStore.updateMember(member.id, updates);
      setMember({ ...member, ...updates });
      setEditingHeader(false);
      toast.success("Header updated");
    } catch (e: any) {
      toast.error("Failed to save: " + (e?.message || "Unknown error"));
    }
  };

  const handleSaveRfa = async (status: string, program: string) => {
    try {
      let rfaMemberId = null;
      const tbl = await membersTable();
      if (member.email) {
        const { data: byEmail } = await supabase
          .from(tbl)
          .select("id")
          .ilike("email", member.email.trim())
          .maybeSingle();
        if (byEmail) rfaMemberId = byEmail.id;
      }
      if (!rfaMemberId && member.name) {
        const normalizedName = member.name.trim().toLowerCase();
        const { data: allRfa } = await supabase.from(tbl).select("id, name");
        const nameMatch = (allRfa || []).find((m: any) => {
          const rfaName = (m.name || "").trim().toLowerCase();
          return (
            rfaName === normalizedName ||
            rfaName.replace(/\s+/g, "") === normalizedName.replace(/\s+/g, "")
          );
        });
        if (nameMatch) rfaMemberId = nameMatch.id;
      }

      if (rfaMemberId) {
        const { error } = await supabase
          .from("members")
          .update({ status, program })
          .eq("id", rfaMemberId);
        if (error) throw error;
      } else {
        toast.warning(
          "Saved locally, but no RFA profile found to sync status.",
        );
      }

      if (liveRfa) {
        setLiveRfa({ ...liveRfa, status, program });
      } else {
        setLiveRfa({
          status,
          program,
          stripe_customer_id: "",
          stripe_status: "",
          stripe_plan_display: "",
          stripe_subscription_start: "",
          stripe_current_period_end: "",
        });
      }
      toast.success("RFA details updated");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleSaveDetails = async (
    plan: string,
    started: string,
    trialEnd: string,
  ) => {
    const planAmount = parseInt(plan.replace(/[^0-9]/g, "")) * 100 || 0;
    const updates: any = {
      plan_amount_display: plan,
      plan_amount: planAmount,
      subscription_start: started || null,
      trial_end: trialEnd || null,
    };
    try {
      await cckStore.updateMember(member.id, updates);
      setMember({ ...member, ...updates });
      toast.success("Details updated");
    } catch (e: any) {
      toast.error("Failed to save: " + (e?.message || "Unknown error"));
    }
  };

  const handleSaveNotes = async (updated: NoteItem[]) => {
    try {
      await cckStore.updateMember(member.id, {
        notes: JSON.stringify(updated),
      } as any);
      setMember({ ...member, notes: JSON.stringify(updated) } as any);
      setNotes(updated);
    } catch (e: any) {
      toast.error("Failed to save note: " + (e?.message || "Unknown error"));
    }
  };

  const handleDelete = async () => {
    await cckStore.deleteMember(member.id);
    navigate("/communicake/members");
    toast.success(`${member.name} has been deleted.`);
  };

  const crmCustomerId = (member.ghl_contact_id || "").trim();
  const crmUrl =
    crmCustomerId && crmCustomerId !== "null"
      ? `https://app.communicake.io/v2/location/bPJ2OHzOvuzDeKgpAbca/contacts/detail/${crmCustomerId}`
      : ((member as any).crm_contact_url || "").trim();

  const cckStripeId = (member.stripe_customer_id || "").trim();
  const stripeUrl =
    cckStripeId && cckStripeId !== "null"
      ? `https://dashboard.stripe.com/acct_1ClGp3Aoa0RlwaBI/customers/${cckStripeId}`
      : "";

  // Business location link — read ghl_location_id + business_name directly
  // from the member row (loaded from the communicake_members view).
  // No hardcoded fallback: if the member has no location, the button is hidden.
  const ghlLocationId = ((member as any).ghl_location_id || "").trim();
  const businessName = ((member as any).business_name || "").trim();
  const businessUrl =
    ghlLocationId && ghlLocationId !== "null"
      ? `https://app.communicake.io/v2/location/${ghlLocationId}/dashboard`
      : "";

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <ProfileHeader
        member={member}
        headerDraft={headerDraft}
        setHeaderDraft={setHeaderDraft}
        editingHeader={editingHeader}
        setEditingHeader={setEditingHeader}
        onBack={() => navigate(-1)}
        onSaveHeader={handleSaveHeader}
        onOpenDelete={() => setConfirmDelete(true)}
        crmUrl={crmUrl}
        stripeUrl={stripeUrl}
        businessUrl={businessUrl}
        businessName={businessName}
      />

      {/* ── MAIN CONTENT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* LEFT COLUMN — 60% */}
        <div className="lg:col-span-3 space-y-5">
          <SubscriptionDetailsCard
            planAmountDisplay={member.plan_amount_display}
            subscriptionStart={member.subscription_start}
            trialEnd={member.trial_end}
            status={member.status}
            onSave={handleSaveDetails}
          />
          <RfaStatusCard
            liveRfa={liveRfa}
            rfaLoading={rfaLoading}
            onSave={handleSaveRfa}
          />
        </div>

        {/* RIGHT COLUMN — 40% */}
        <div className="lg:col-span-2 space-y-5">
          <NotesCard notes={notes} onSaveNotes={handleSaveNotes} />
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
                {member.name}
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
