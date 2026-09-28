import { parse } from "papaparse";
import { supabase } from "./supabase";

// --- Role-aware table helpers ---
// Staff users read from *_staff views (financial columns removed).
// Everyone else reads from the real tables. Writes always target the real tables.

let _cachedRole: string | null = null;
let _rolePromise: Promise<string> | null = null;

/** Pre-seed the cached role (e.g. from AuthGate) so we never query profiles again. */
export function setCachedRole(role: string): void {
  _cachedRole = role;
  _rolePromise = Promise.resolve(role);
}

export function getCachedRole(): string | null {
  return _cachedRole;
}

export function isStaff(): boolean {
  return _cachedRole === "staff";
}

export async function getUserRole(): Promise<string> {
  // Return cached value immediately
  if (_cachedRole !== null) return _cachedRole;
  // Deduplicate concurrent in-flight requests — cache the PROMISE, not just the value
  if (_rolePromise) return _rolePromise;

  _rolePromise = (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        _cachedRole = "";
        return "";
      }
      const { data } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", session.user.id)
        .maybeSingle();
      _cachedRole = (data?.role as string) || "";
      return _cachedRole;
    } catch {
      _cachedRole = "";
      return "";
    }
  })();

  return _rolePromise;
}

export function isStaffRole(role: string): boolean {
  return role === "staff";
}

export async function membersTable(): Promise<string> {
  const role = await getUserRole();
  return isStaffRole(role) ? "members_staff" : "members";
}

export async function cckMembersTable(): Promise<string> {
  const role = await getUserRole();
  return isStaffRole(role) ? "cck_members_staff" : "cck_members";
}

export interface Program {
  name: string;
  duration: string;
  price: string;
}

const PROGRAMS_KEY = "rfa_programs_data";

export const DEFAULT_PROGRAMS: Program[] = [
  { name: "Jumpstart", duration: "3", price: "$2,500" },
  { name: "Inner Circle", duration: "12", price: "$15,000" },
  { name: "Supercharge", duration: "12", price: "$25,000" },
  { name: "Concierge", duration: "12", price: "$35,000" },
  { name: "VIP", duration: "12", price: "$50,000" },
  { name: "AI Employee Service", duration: "12", price: "$0" },
];

// Programs to permanently remove
const REMOVED_PROGRAMS = ["vip in house concierge"];

export const programStore = {
  getPrograms: (): Program[] => {
    const data = localStorage.getItem(PROGRAMS_KEY);
    let programs = data ? JSON.parse(data) : DEFAULT_PROGRAMS;
    let changed = false;

    // Remove banned programs
    const beforeCount = programs.length;
    programs = programs.filter(
      (p: Program) => !REMOVED_PROGRAMS.includes(p.name.toLowerCase()),
    );
    if (programs.length !== beforeCount) changed = true;

    // Ensure AI Employee Service is always available
    if (
      !programs.find(
        (p: Program) => p.name.toLowerCase() === "ai employee service",
      )
    ) {
      programs.push({
        name: "AI Employee Service",
        duration: "12",
        price: "$0",
      });
      changed = true;
    }

    programs = programs.map((p: Program) => {
      if (p.name.toLowerCase().includes("ai employee")) {
        if (p.name !== "AI Employee Service") {
          changed = true;
          return { ...p, name: "AI Employee Service" };
        }
      }
      return p;
    });

    const unique: Program[] = [];
    const seen = new Set();
    programs.forEach((p: Program) => {
      const lower = p.name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(p);
      } else {
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem(PROGRAMS_KEY, JSON.stringify(unique));
    }
    return unique;
  },
  savePrograms: (programs: Program[]) => {
    localStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
  },
};

// Program duration rules (months)
export function getProgramDurations(): Record<string, number> {
  const programs = programStore.getPrograms();
  const durations: Record<string, number> = {};
  programs.forEach((p) => {
    durations[p.name] = parseInt(p.duration) || 12;
  });
  return durations;
}

export function deriveStatus(
  currentStatus: string,
  expiresStr: string,
): string {
  if (!expiresStr) return currentStatus;
  const expires = new Date(expiresStr);
  if (isNaN(expires.getTime())) return currentStatus;

  const now = new Date();
  const diffDays = Math.floor(
    (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  let dateBasedStatus = "Active";
  if (diffDays < 0) dateBasedStatus = "Expired";

  // Auto-downgrade logic (Active -> Expired)
  if (currentStatus === "Active" && dateBasedStatus === "Expired") {
    return dateBasedStatus;
  }

  // Preserve manual statuses (Past Due, Expired, Canceled, Renewed, On Extension, Pending)
  // This means manually setting "Past Due" will stick, and extending a date requires manually updating status.
  return currentStatus;
}

export function computeExpirationDate(
  programStr: string,
  joinedStr: string,
): string {
  if (!joinedStr) return "";
  const joined = new Date(joinedStr);
  if (isNaN(joined.getTime())) return joinedStr;
  const durations = getProgramDurations();

  const programs = programStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let maxMonths = 0;
  programs.forEach((p) => {
    const m = durations[p] ?? 12;
    if (m > maxMonths) maxMonths = m;
  });
  if (maxMonths === 0) maxMonths = 12; // fallback

  const expires = new Date(joined);
  expires.setMonth(expires.getMonth() + maxMonths);
  return expires.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  joined: string;
  expires: string;
  status: string;
  program: string;
  source: string;
  notes: string;
  assignedTo: string;
  closer: string;
  payment: {
    type: string;
    deposit: string;
    monthly: string;
    months: string;
    totalValue: string;
  };
  ltv: string;
  lastInteraction: string;
  profileUrl?: string;
  stripeUrl?: string;
  ghl_contact_id?: string;
  stripe_customer_id?: string;
  stripe_status?: string;
  stripe_plan_display?: string;
  stripe_subscription_start?: string;
  stripe_updated_at?: string;
  stripe_current_period_end?: string;
  cckStatus?: string;
  cckPlanAmount?: string;
  cckSubscriptionStart?: string;
  cckTrialEnd?: string;
}

export function parseDollar(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[$,]/g, "")) || 0;
}

export function formatDollar(val: number): string {
  if (isNaN(val) || val < 0) return "$0";
  return (
    "$" +
    val.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

export function parsePaymentDetails(details: string) {
  const result = {
    type: "PIF",
    deposit: "$0",
    monthly: "$0",
    months: "12",
    totalValue: "$0",
  };

  if (!details) return result;

  const lower = details.toLowerCase();

  if (lower.includes("pif")) {
    result.type = "PIF";
  } else if (
    lower.includes("+") ||
    (lower.includes("down") && lower.includes("/mo"))
  ) {
    result.type = "Deposit + Monthly";
  } else if (lower.includes("/mo") || lower.includes("monthly")) {
    result.type = "Monthly Only";
  }

  const amounts = details.match(/\$[\d,]+/g) || [];
  const numbers = amounts.map((a) => parseDollar(a));

  if (result.type === "PIF") {
    result.deposit = formatDollar(numbers[0] || 0);
    result.totalValue = result.deposit;
  } else if (result.type === "Deposit + Monthly") {
    result.deposit = formatDollar(numbers[0] || 0);
    result.monthly = formatDollar(numbers[1] || 0);
  } else if (result.type === "Monthly Only") {
    result.monthly = formatDollar(numbers[0] || 0);
  }

  const monthsMatch = lower.match(/(\d+)\s*month/);
  if (monthsMatch) {
    result.months = monthsMatch[1];
  }

  if (result.type !== "PIF") {
    result.totalValue = computeTotalValue(
      result.type,
      result.deposit,
      result.monthly,
      result.months,
    );
  } else {
    result.totalValue = result.deposit;
  }

  return result;
}

export function computeTotalValue(
  type: string,
  deposit: string,
  monthly: string,
  months: string,
): string {
  const dep = parseDollar(deposit);
  const mon = parseDollar(monthly);
  const mo = parseInt(months) || 0;

  if (type === "PIF") return deposit;
  if (type === "Deposit + Monthly") return formatDollar(dep + mon * mo);
  if (type === "Monthly Only") return formatDollar(mon * mo);
  return deposit;
}

export const memberStore = {
  getMembers: async (): Promise<Member[]> => {
    const tbl = await membersTable();
    const { data, error } = await supabase.from(tbl).select("*");
    if (error || !data) {
      console.error("Error fetching members:", error);
      return [];
    }

    // READ-ONLY: normalise in memory for display, never write back on load
    const enriched = data.map((m: any) => {
      let programStr = m.program || "";
      if (programStr.toLowerCase().includes("ai employee")) {
        programStr = programStr.replace(
          /ai employee[^,]*/gi,
          "AI Employee Service",
        );
      }

      // Remove banned programs from any member's program list
      const progs = programStr
        .split(",")
        .map((s: string) => s.trim())
        .filter((p) => p && !REMOVED_PROGRAMS.includes(p.toLowerCase()));
      const uniqueProgsMap = new Map();
      progs.forEach((p: string) => {
        const lower = p.toLowerCase();
        if (!uniqueProgsMap.has(lower)) {
          uniqueProgsMap.set(lower, p);
        } else if (p === "AI Employee Service") {
          uniqueProgsMap.set(lower, p);
        }
      });

      const newProgramStr = Array.from(uniqueProgsMap.values()).join(", ");
      programStr = newProgramStr;

      let expires = m.expires;
      if (!expires && m.joined && programStr) {
        expires = computeExpirationDate(programStr, m.joined);
      }
      const payment = m.payment || {
        type: "PIF",
        deposit: "$0",
        monthly: "$0",
        months: "12",
        totalValue: "$0",
      };
      if (m.status === "Pending" && payment.type !== "Placed Deposit") {
        payment.type = "Placed Deposit";
      }
      const computedStatus = m.status || "Active";

      return {
        ...m,
        program: programStr,
        expires,
        payment,
        assignedTo: m.assignedTo || "",
        closer: m.closer || "",
        status: computedStatus,
        profileUrl: m.profileUrl || "",
        stripeUrl: m.stripeUrl || "",
        cckStatus: m.cckStatus || "Non-Member",
        cckPlanAmount: m.cckPlanAmount || "",
        cckSubscriptionStart: m.cckSubscriptionStart || "",
        cckTrialEnd: m.cckTrialEnd || "",
        stripe_status: m.stripe_status || "",
        stripe_plan_display: m.stripe_plan_display || "",
        stripe_subscription_start: m.stripe_subscription_start || "",
        stripe_updated_at: m.stripe_updated_at || "",
        stripe_current_period_end: m.stripe_current_period_end || "",
      };
    });
    return enriched;
  },

  // One-off cleanup: persists normalised program names, expiration dates, and payment migrations.
  // Call manually from Settings, not on every load.
  cleanupMembers: async (): Promise<number> => {
    if (isStaff()) throw new Error("Read-only access");
    const { data, error } = await supabase.from("members").select("*");
    if (error || !data) return 0;
    let updated = 0;
    for (const m of data) {
      const changed: Record<string, any> = {};
      let programStr = m.program || "";
      if (programStr.toLowerCase().includes("ai employee")) {
        programStr = programStr.replace(
          /ai employee[^,]*/gi,
          "AI Employee Service",
        );
      }
      const progs = programStr
        .split(",")
        .map((s: string) => s.trim())
        .filter((p) => p && !REMOVED_PROGRAMS.includes(p.toLowerCase()));
      const uniqueProgsMap = new Map();
      progs.forEach((p: string) => {
        const lower = p.toLowerCase();
        if (!uniqueProgsMap.has(lower)) uniqueProgsMap.set(lower, p);
        else if (p === "AI Employee Service") uniqueProgsMap.set(lower, p);
      });
      const newProgramStr = Array.from(uniqueProgsMap.values()).join(", ");
      if (newProgramStr !== (m.program || "")) changed.program = newProgramStr;

      let expires = m.expires;
      if (!expires && m.joined && newProgramStr)
        expires = computeExpirationDate(newProgramStr, m.joined);
      if (expires !== m.expires) changed.expires = expires;

      const payment = m.payment || {
        type: "PIF",
        deposit: "$0",
        monthly: "$0",
        months: "12",
        totalValue: "$0",
      };
      if (m.status === "Pending" && payment.type !== "Placed Deposit") {
        payment.type = "Placed Deposit";
        changed.payment = payment;
      }
      if (Object.keys(changed).length > 0) {
        await supabase.from("members").update(changed).eq("id", m.id);
        updated++;
      }
    }
    return updated;
  },

  addMember: async (member: Member) => {
    if (isStaff()) throw new Error("Read-only access");
    const { error } = await supabase.from("members").insert([member]);
    if (error) console.error("Error adding member:", error);
  },

  updateMember: async (id: string, updates: Partial<Member>) => {
    if (isStaff()) throw new Error("Read-only access");
    // Build a minimal payload — only known DB columns, never unknown fields
    const ALLOWED_COLUMNS = new Set([
      "name",
      "email",
      "phone",
      "joined",
      "expires",
      "status",
      "program",
      "source",
      "notes",
      "assignedTo",
      "closer",
      "payment",
      "ltv",
      "lastInteraction",
      "profileUrl",
      "stripeUrl",
      "ghl_contact_id",
      "stripe_customer_id",
      "stripe_status",
      "stripe_plan_display",
      "stripe_subscription_start",
      "stripe_updated_at",
      "stripe_current_period_end",
    ]);
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (ALLOWED_COLUMNS.has(k)) payload[k] = v;
    }

    // If status is explicitly passed, ALWAYS write it exactly as given — no overrides.
    // Only auto-derive if status was NOT passed AND expires was changed AND current DB status is Active.
    if (updates.status === undefined && updates.expires !== undefined) {
      const { data: existing } = await supabase
        .from(await membersTable())
        .select("status")
        .eq("id", id)
        .single();
      if (existing && existing.status === "Active") {
        payload.status = deriveStatus("Active", updates.expires);
      }
      // For any other status (Past Due, Expired, Canceled, etc.) — leave it alone
    }

    console.log(
      "[updateMember] payload being sent to Supabase:",
      JSON.stringify(payload),
    );
    const { error } = await supabase
      .from("members")
      .update(payload)
      .eq("id", id);
    if (error) {
      console.error("[updateMember] Supabase error:", error);
      throw new Error(error.message || JSON.stringify(error));
    }
    console.log("[updateMember] success for id:", id);

    // If status changed to Expired or Canceled, clear their RFA programs in CCK hub
    if (payload.status === "Expired" || payload.status === "Canceled") {
      const { data: memberData } = await supabase
        .from(await membersTable())
        .select("email, name")
        .eq("id", id)
        .single();
      if (memberData && memberData.email) {
        await supabase
          .from("cck_members")
          .update({ rfa_programs: "Non-Member" })
          .ilike("email", memberData.email.trim());
      }
    }
  },

  bulkUpdateMembers: async (ids: string[], updates: Partial<Member>) => {
    if (isStaff()) throw new Error("Read-only access");
    // For simplicity, we can fetch them, merge, and upsert
    const { data: members } = await supabase
      .from(await membersTable())
      .select("*")
      .in("id", ids);
    if (!members) return;

    const updated = members.map((m) => {
      const merged = { ...m, ...updates };
      // Only auto-derive if status was not explicitly set in the bulk update
      if (updates.status === undefined) {
        const s = merged.status || "Active";
        merged.status = s === "Active" ? deriveStatus(s, merged.expires) : s;
      }
      return merged;
    });

    const { error } = await supabase.from("members").upsert(updated);
    if (error) console.error("Error bulk updating members:", error);

    if (updates.status === "Expired" || updates.status === "Canceled") {
      const emails = updated.map((m) => m.email).filter(Boolean);
      for (const email of emails) {
        if (email) {
          await supabase
            .from("cck_members")
            .update({ rfa_programs: "Non-Member" })
            .ilike("email", email.trim());
        }
      }
    }
  },
  bulkDeleteMembers: async (ids: string[]) => {
    if (isStaff()) throw new Error("Read-only access");
    const { error } = await supabase.from("members").delete().in("id", ids);
    if (error) console.error("Error bulk deleting members:", error);
  },

  deleteMember: async (id: string) => {
    if (isStaff()) throw new Error("Read-only access");
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) console.error("Error deleting member:", error);
  },

  clearMembers: async () => {
    if (isStaff()) throw new Error("Read-only access");
    const { error } = await supabase.from("members").delete().neq("id", "0"); // deletes all
    if (error) console.error("Error clearing members:", error);
  },

  importCSV: (csvContent: string): Promise<number> => {
    if (isStaff()) return Promise.reject(new Error("Read-only access"));
    return new Promise((resolve, reject) => {
      parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: async (results) => {
          const rawData = results.data as any[];
          const newMembers: Member[] = rawData.map((row) => {
            const program = (
              row["Program"] ||
              programStore.getPrograms()[0]?.name ||
              "Program"
            ).trim();
            let joinedStr = (row["Date Joined"] || "").trim();
            if (joinedStr === "—" || joinedStr === "Invalid Date")
              joinedStr = "";

            let expiresStr = (row["Membership Expiration"] || "").trim();
            if (expiresStr === "—" || expiresStr === "Invalid Date")
              expiresStr = "";
            if (!expiresStr && joinedStr) {
              expiresStr = computeExpirationDate(program, joinedStr);
            }

            const preType = (row["Payment Type"] || "").trim();
            let payment: Member["payment"];
            const durations = getProgramDurations();

            if (preType) {
              const programMonths = durations[program] ?? 12;
              const months = (row["Months"] || String(programMonths)).trim();
              const deposit = (row["Deposit"] || "$0").trim();
              const monthly = (row["Monthly"] || "$0").trim();
              let totalValue = (row["Total Value"] || "").trim();
              if (!totalValue || totalValue === "$0") {
                totalValue = computeTotalValue(
                  preType,
                  deposit,
                  monthly,
                  months,
                );
              }
              payment = { type: preType, deposit, monthly, months, totalValue };
            } else {
              const programMonths = durations[program] ?? 12;
              payment = parsePaymentDetails(row["Payment Details"] || "");
              if (
                !(row["Payment Details"] || "")
                  .toLowerCase()
                  .match(/\d+\s*month/)
              ) {
                payment.months = String(programMonths);
              }
              if (payment.type !== "PIF") {
                payment.totalValue = computeTotalValue(
                  payment.type,
                  payment.deposit,
                  payment.monthly,
                  payment.months,
                );
              }
            }

            const ltv = (row["LTV"] || payment.totalValue || "$0").trim();

            let source = (row["Source"] || "").trim();
            if (!source) {
              const notes = (row["Notes/Renewal Plan"] || "").toLowerCase();
              if (notes.includes("youtube") || notes.includes("yt"))
                source = "YouTube";
              else if (
                notes.includes("referral") ||
                notes.includes("graham") ||
                notes.includes("omar") ||
                notes.includes("ms biz")
              )
                source = "Referral";
              else if (notes.includes("ads")) source = "Ads";
              else if (notes.includes("webinar")) source = "Webinar";
              else source = "Unknown";
            }

            const csvStatus = (row["Status"] || "Active").trim();
            const derivedStatus = deriveStatus(csvStatus, expiresStr);

            return {
              id: crypto.randomUUID(),
              name: (row["Name"] || "Unknown Member").trim(),
              email: (
                row["Email"] ||
                `${(row["Name"] || "member").toLowerCase().replace(/\s+/g, ".")}@example.com`
              ).trim(),
              phone: (row["Phone"] || "").trim(),
              joined: joinedStr || null,
              expires: expiresStr || null,
              status: derivedStatus,
              program,
              source,
              notes: (row["Notes/Renewal Plan"] || "").trim(),
              assignedTo: (row["Assigned To"] || "").trim(),
              closer: (row["Closer"] || "").trim(),
              lastInteraction: (row["Last Interaction"] || "Imported").trim(),
              payment,
              ltv,
            };
          });

          const { error } = await supabase.from("members").upsert(newMembers);
          if (error) {
            console.error("Error importing members:", error);
            reject(error);
          } else {
            resolve(newMembers.length);
          }
        },
        error: (error) => reject(error),
      });
    });
  },
};

// --- CCK Member Types & Store ---
export interface CckMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  plan_amount: number;
  plan_amount_display: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  ghl_contact_id?: string;
  subscription_start: string;
  trial_end: string;
  notes?: string;
  rfa_programs?: string;
  stripe_url?: string;
  crm_contact_url?: string;
  created_at: string;
  updated_at: string;
}

export const cckStore = {
  getMembers: async (): Promise<CckMember[]> => {
    const tbl = await cckMembersTable();
    const { data, error } = await supabase.from(tbl).select("*");
    if (error || !data) {
      console.error("Error fetching CCK members:", error);
      return [];
    }
    // READ-ONLY: normalise in memory for display, never write back on load
    const enriched = data.map((m: any) => {
      let rfa_programs = m.rfa_programs || "";
      if (rfa_programs && rfa_programs !== "Non-Member") {
        const progs = rfa_programs
          .split(",")
          .map((s: string) => s.trim())
          .filter(
            (p: string) => p && !REMOVED_PROGRAMS.includes(p.toLowerCase()),
          );
        rfa_programs = progs.length > 0 ? progs.join(", ") : "Non-Member";
      }

      return {
        ...m,
        rfa_programs,
        status: m.status || "Active",
        plan_amount_display:
          m.plan_amount_display || `$${Math.round((m.plan_amount || 0) / 100)}`,
        subscription_start: m.subscription_start || "",
        trial_end: m.trial_end || "",
      };
    });
    return enriched;
  },

  // One-off cleanup: persists normalised rfa_programs. Call manually from Settings.
  cleanupMembers: async (): Promise<number> => {
    if (isStaff()) throw new Error("Read-only access");
    const { data, error } = await supabase.from("cck_members").select("*");
    if (error || !data) return 0;
    let updated = 0;
    for (const m of data) {
      let rfa_programs = m.rfa_programs || "";
      if (rfa_programs && rfa_programs !== "Non-Member") {
        const progs = rfa_programs
          .split(",")
          .map((s: string) => s.trim())
          .filter(
            (p: string) => p && !REMOVED_PROGRAMS.includes(p.toLowerCase()),
          );
        rfa_programs = progs.length > 0 ? progs.join(", ") : "Non-Member";
        if (rfa_programs !== m.rfa_programs) {
          await supabase
            .from("cck_members")
            .update({ rfa_programs })
            .eq("id", m.id);
          updated++;
        }
      }
    }
    return updated;
  },

  updateMember: async (id: string, updates: Partial<CckMember>) => {
    if (isStaff()) throw new Error("Read-only access");
    // Build update payload — only include fields that are defined
    const payload: Record<string, any> = { ...updates };
    delete payload.rfa_programs; // We don't store this in CCK table anymore

    // Try adding updated_at but don't fail if column doesn't exist
    try {
      payload.updated_at = new Date().toISOString();
    } catch {}

    if (
      Object.keys(payload).length > 0 &&
      !(Object.keys(payload).length === 1 && payload.updated_at)
    ) {
      const { error } = await supabase
        .from("cck_members")
        .update(payload)
        .eq("id", id);
      if (error) {
        console.error("Error updating CCK member:", error);
        throw error;
      }
    }

    // Sync back to RFA members if rfa_programs is updated
    if (updates.rfa_programs !== undefined) {
      const { data: cckMember } = await supabase
        .from(await cckMembersTable())
        .select("*")
        .eq("id", id)
        .single();
      if (cckMember && cckMember.email) {
        const { data: rfaMember } = await supabase
          .from(await membersTable())
          .select("*")
          .ilike("email", cckMember.email)
          .maybeSingle();
        if (rfaMember) {
          await supabase
            .from("members")
            .update({ program: updates.rfa_programs })
            .eq("id", rfaMember.id);
        }
      }
    }
  },

  bulkUpdateMembers: async (ids: string[], updates: Partial<CckMember>) => {
    if (isStaff()) throw new Error("Read-only access");
    const { data: members } = await supabase
      .from(await cckMembersTable())
      .select("*")
      .in("id", ids);
    if (!members) return;
    const updated = members.map((m) => ({
      ...m,
      ...updates,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("cck_members").upsert(updated);
    if (error) console.error("Error bulk updating CCK members:", error);
  },

  bulkDeleteMembers: async (ids: string[]) => {
    if (isStaff()) throw new Error("Read-only access");
    const { error } = await supabase.from("cck_members").delete().in("id", ids);
    if (error) console.error("Error bulk deleting CCK members:", error);
  },

  deleteMember: async (id: string) => {
    if (isStaff()) throw new Error("Read-only access");
    const { error } = await supabase.from("cck_members").delete().eq("id", id);
    if (error) console.error("Error deleting CCK member:", error);
  },
};

export const cckMemberStore = cckStore;

export const syncCrossPlatformData = async () => {
  // Staff have no write permission — skip sync entirely
  if (isStaff()) return;
  try {
    const [rfaRes, cckRes] = await Promise.all([
      supabase.from(await membersTable()).select("*"),
      supabase.from(await cckMembersTable()).select("*"),
    ]);

    if (!rfaRes.data || !cckRes.data) return;

    const rfaByEmail = new Map(
      rfaRes.data.map((m: any) => {
        let programStr = m.program || "";
        const progs = programStr
          .split(",")
          .map((s: string) => s.trim())
          .filter(
            (p: string) => p && !REMOVED_PROGRAMS.includes(p.toLowerCase()),
          );
        m.program = progs.length > 0 ? progs.join(", ") : "Non-Member";
        return [(m.email || "").toLowerCase().trim(), m];
      }),
    );
    const cckByEmail = new Map(
      cckRes.data.map((m: any) => {
        let rfa_programs = m.rfa_programs || "";
        const progs = rfa_programs
          .split(",")
          .map((s: string) => s.trim())
          .filter(
            (p: string) => p && !REMOVED_PROGRAMS.includes(p.toLowerCase()),
          );
        m.rfa_programs = progs.length > 0 ? progs.join(", ") : "Non-Member";
        return [(m.email || "").toLowerCase().trim(), m];
      }),
    );

    const rfaUpdates = [];
    const cckUpdates = [];

    // Sync CCK details into RFA — use targeted UPDATE, never upsert full rows (avoids overwriting status)
    for (const rfa of rfaRes.data) {
      if (!rfa.email) continue;
      const cck = cckByEmail.get(rfa.email.toLowerCase().trim());
      if (cck) {
        const planDisplay =
          cck.plan_amount_display ||
          (cck.plan_amount ? `$${Math.round(cck.plan_amount / 100)}` : "");
        if (
          rfa.cckStatus !== (cck.status || "Active") ||
          rfa.cckPlanAmount !== planDisplay ||
          rfa.cckSubscriptionStart !== (cck.subscription_start || "") ||
          rfa.cckTrialEnd !== (cck.trial_end || "")
        ) {
          rfaUpdates.push({
            id: rfa.id,
            cckStatus: cck.status || "Active",
            cckPlanAmount: planDisplay,
            cckSubscriptionStart: cck.subscription_start || "",
            cckTrialEnd: cck.trial_end || "",
          });
        }
      } else {
        if ((rfa.cckStatus || "Non-Member") !== "Non-Member") {
          rfaUpdates.push({
            id: rfa.id,
            cckStatus: "Non-Member",
            cckPlanAmount: "",
            cckSubscriptionStart: "",
            cckTrialEnd: "",
          });
        }
      }
    }

    // Sync RFA programs into CCK — use targeted UPDATE, never upsert full rows
    for (const cck of cckRes.data) {
      if (!cck.email) continue;
      const rfa = rfaByEmail.get(cck.email.toLowerCase().trim());
      if (rfa) {
        const isExpired = rfa.status === "Expired";
        const newProgram = isExpired
          ? "Non-Member"
          : rfa.program || "Non-Member";
        if (cck.rfa_programs !== newProgram) {
          cckUpdates.push({ id: cck.id, rfa_programs: newProgram });
        }
      } else {
        if ((cck.rfa_programs || "Non-Member") !== "Non-Member") {
          cckUpdates.push({ id: cck.id, rfa_programs: "Non-Member" });
        }
      }
    }

    // Process updates one by one to avoid touching unrelated fields
    for (const u of rfaUpdates) {
      const { id, ...fields } = u;
      await supabase.from("members").update(fields).eq("id", id);
    }
    for (const u of cckUpdates) {
      const { id, ...fields } = u;
      await supabase.from("cck_members").update(fields).eq("id", id);
    }

    console.log("Cross-platform sync complete.");
  } catch (error) {
    console.error("Error during cross-platform sync:", error);
  }
};

// Deduplicate RFA members — keeps the record with the most data (non-empty fields)
export const deduplicateMembers = async (): Promise<number> => {
  if (isStaff()) throw new Error("Read-only access");
  const { data, error } = await supabase
    .from(await membersTable())
    .select("*")
    .order("joined", { ascending: true });
  if (error || !data) return 0;

  // Group by normalized name (lowercase, trimmed)
  const byName = new Map<string, any[]>();
  for (const m of data) {
    const key = (m.name || "").toLowerCase().trim();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(m);
  }

  const toDelete: string[] = [];
  for (const [, group] of byName) {
    if (group.length <= 1) continue;
    // Score each record by how many non-empty meaningful fields it has
    const scored = group.map((m) => ({
      m,
      score: [
        m.email,
        m.phone,
        m.joined,
        m.expires,
        m.program,
        m.ltv,
        m.profileUrl,
        m.notes,
      ].filter((v) => v && v !== "" && v !== "$0" && v !== "Unknown").length,
    }));
    scored.sort((a, b) => b.score - a.score); // best record first
    // Keep the first (best), delete the rest
    for (let i = 1; i < scored.length; i++) {
      toDelete.push(scored[i].m.id);
    }
  }

  if (toDelete.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      await supabase
        .from("members")
        .delete()
        .in("id", toDelete.slice(i, i + chunkSize));
    }
  }

  return toDelete.length;
};
