import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  MoreHorizontal,
  FileText,
  Save,
  Upload,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { memberStore, Member, programStore, isStaff } from "@/lib/store";
import { toast } from "sonner";
import { format } from "date-fns";

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

const getProgramColor = () => "bg-primary text-primary-foreground";

interface Payment {
  type: string;
  deposit: string;
  monthly: string;
  months: string;
  totalValue: string;
}

function PaymentCell({ payment }: { payment: Payment }) {
  const { type, deposit, monthly, months, totalValue } = payment;
  if (type === "PIF") {
    return (
      <div className="text-sm">
        <span className="font-semibold text-foreground">{deposit}</span>
        <span className="ml-1.5 text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
          PIF
        </span>
      </div>
    );
  }
  if (type === "Deposit + Monthly") {
    return (
      <div className="text-sm leading-snug">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-foreground">{deposit} down</span>
          <span className="text-muted-foreground">+</span>
          <span className="font-semibold text-foreground">
            {monthly}
            <span className="text-muted-foreground font-normal">/mo</span>
          </span>
          {months && (
            <span className="text-xs text-muted-foreground">× {months}mo</span>
          )}
        </div>
        {totalValue && totalValue !== "$0" && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Total:{" "}
            <span className="text-foreground font-medium">{totalValue}</span>
          </div>
        )}
      </div>
    );
  }
  // Monthly Only
  return (
    <div className="text-sm leading-snug">
      <span className="font-semibold text-foreground">
        {monthly}
        <span className="text-muted-foreground font-normal">/mo</span>
      </span>
      {months && (
        <span className="text-xs text-muted-foreground ml-1.5">
          × {months}mo
        </span>
      )}
      {totalValue && totalValue !== "$0" && (
        <div className="text-xs text-muted-foreground mt-0.5">
          Total:{" "}
          <span className="text-foreground font-medium">{totalValue}</span>
        </div>
      )}
    </div>
  );
}

export default function Members() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [programFilter, setProgramFilter] = useState("all");
  const [paymentPlanOnly, setPaymentPlanOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Member;
    direction: "asc" | "desc";
  }>({ key: "joined", direction: "desc" });
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [tempNotes, setTempNotes] = useState("");
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditField, setBulkEditField] = useState<
    "status" | "program" | "assignedTo" | "closer" | null
  >(null);
  const [bulkEditValue, setBulkEditValue] = useState("");
  const staff = isStaff();

  useEffect(() => {
    memberStore.getMembers().then(setMembers);

    if (location.state?.paymentPlanFilter) {
      setPaymentPlanOnly(true);
      setStatusFilter("active");
      window.history.replaceState({}, document.title);
    } else if (location.state?.statusFilter) {
      setStatusFilter(location.state.statusFilter as string);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSaveNotes = async () => {
    if (editingMember) {
      await memberStore.updateMember(editingMember.id, { notes: tempNotes });
      setMembers(await memberStore.getMembers());
      setEditingMember(null);
      toast.success("Notes updated successfully");
    }
  };

  const handleRowClick = (id: string) => navigate(`/members/${id}`);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      try {
        const count = await memberStore.importCSV(text);
        setMembers(await memberStore.getMembers());
        toast.success(`Successfully imported ${count} members`);
      } catch (err: any) {
        console.error(err);
        toast.error(
          `Import failed: ${err?.message || "Please check the format."}`,
        );
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleExportCSV = async () => {
    const data = await memberStore.getMembers();
    if (data.length === 0) {
      toast.error("No members to export");
      return;
    }

    const exportData = data.map((m) => {
      let paymentDetails = "";
      const { type, deposit, monthly, months, totalValue } = m.payment;
      if (type === "PIF") {
        paymentDetails = `PIF ${deposit}`;
      } else if (type === "Deposit + Monthly") {
        paymentDetails = `${deposit} Down + ${monthly}/mo x ${months} months`;
      } else if (type === "Monthly Only") {
        paymentDetails = `${monthly}/mo x ${months} months`;
      } else if (type === "Placed Deposit") {
        paymentDetails = `Placed Deposit ${deposit}`;
      } else {
        paymentDetails = totalValue || "";
      }

      return {
        Name: m.name,
        Email: m.email,
        Phone: m.phone,
        Status: m.status,
        Program: m.program,
        "Date Joined": m.joined,
        "Membership Expiration": m.expires,
        "Payment Details": paymentDetails,
        "Payment Type": type,
        Deposit: deposit,
        Monthly: monthly,
        Months: months,
        "Total Value": totalValue,
        LTV: m.ltv,
        Source: m.source,
        Closer: m.closer,
        "Assigned To": m.assignedTo,
        "Last Interaction": m.lastInteraction,
        "Notes/Renewal Plan": m.notes,
      };
    });

    const csvContent = Papa.unparse(exportData);
    const filename = `rfa_members_${new Date().toISOString().split("T")[0]}.csv`;

    const blob = new Blob(["\ufeff", csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank"; // Helps in some embedded environments
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    toast.success(
      `Exported ${data.length} members — check your downloads folder`,
    );
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    await memberStore.deleteMember(memberToDelete.id);
    setMembers(await memberStore.getMembers());
    setMemberToDelete(null);
    toast.success(`${memberToDelete.name} has been deleted.`);
  };

  const handleClearAll = () => {
    if (
      confirm(
        "Are you sure you want to remove all members? This cannot be undone.",
      )
    ) {
      memberStore.clearMembers();
      setMembers([]);
      toast.success("All members removed");
    }
  };

  const handleSort = (key: keyof Member) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setProgramFilter("all");
    setPaymentPlanOnly(false);
  };

  const hasActiveFilters =
    statusFilter !== "all" || programFilter !== "all" || paymentPlanOnly;

  const filteredMembers = members
    .filter((m) => {
      let matchesStatus = true;
      if (statusFilter === "all") {
        matchesStatus = true;
      } else if (statusFilter === "expired") {
        matchesStatus = m.status === "Expired";
      } else if (statusFilter === "active") {
        const s = (m.status || "").toLowerCase();
        matchesStatus = s === "active" || s === "renewed";
      } else {
        matchesStatus =
          (m.status || "").toLowerCase() === statusFilter.toLowerCase();
      }

      const matchesProgram =
        programFilter === "all" ||
        (m.program || "").toLowerCase().includes(programFilter.toLowerCase());

      const matchesPaymentPlan =
        !paymentPlanOnly ||
        ((m.payment?.type === "Monthly Only" ||
          m.payment?.type === "Deposit + Monthly") &&
          parseFloat((m.payment?.monthly || "$0").replace(/[$,]/g, "")) > 0);

      return matchesStatus && matchesProgram && matchesPaymentPlan;
    })
    .sort((a, b) => {
      const { key, direction } = sortConfig;
      let aValue: unknown = a[key];
      let bValue: unknown = b[key];

      if (key === "joined" || key === "expires") {
        const aDate = new Date(aValue as string).getTime() || 0;
        const bDate = new Date(bValue as string).getTime() || 0;
        return direction === "asc" ? aDate - bDate : bDate - aDate;
      }

      const aStr = ((aValue as string) || "").toString().toLowerCase();
      const bStr = ((bValue as string) || "").toString().toLowerCase();
      if (aStr < bStr) return direction === "asc" ? -1 : 1;
      if (aStr > bStr) return direction === "asc" ? 1 : -1;
      return 0;
    });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const handleBulkUpdate = async () => {
    if (!bulkEditField || !bulkEditValue) return;

    const updates: Partial<Member> = {};
    updates[bulkEditField] =
      bulkEditValue === "Unassigned" ? "" : bulkEditValue;

    await memberStore.bulkUpdateMembers(Array.from(selectedIds), updates);
    setMembers(await memberStore.getMembers());
    setBulkEditField(null);
    setBulkEditValue("");
    setSelectedIds(new Set());
    toast.success(`Updated ${selectedIds.size} members successfully`);
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    await memberStore.bulkDeleteMembers(Array.from(selectedIds));
    setMembers(await memberStore.getMembers());
    setSelectedIds(new Set());
    setBulkEditField(null);
    setBulkEditValue("");
    setShowBulkDeleteConfirm(false);
    toast.success(`Deleted ${count} members successfully`);
  };

  const SortIcon = ({ col }: { col: keyof Member }) => {
    if (sortConfig.key === col) {
      return sortConfig.direction === "asc" ? (
        <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3" />
      );
    }
    return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  };

  const getStatusFilterLabel = () => {
    return statusFilter;
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border border-border/30 dark:border-0 dark:[box-shadow:0_2px_12px_0_rgba(0,0,0,0.4)] [box-shadow:0_1px_4px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] border-border/50 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="past due">Past Due</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
              <SelectItem value="renewed">Renewed</SelectItem>
              <SelectItem value="on extension">On Extension</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger className="w-[160px] border-border/50 bg-background">
              <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {programStore.getPrograms().map((p) => (
                <SelectItem key={p.name} value={p.name.toLowerCase()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,text/csv,application/csv,application/vnd.ms-excel"
            className="hidden"
          />
          {!staff && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-primary hover:bg-transparent text-xs uppercase tracking-wider font-bold"
              onClick={handleImportClick}
            >
              <Upload className="w-3.5 h-3.5 mr-2" />
              Import
            </Button>
          )}
          {!staff && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-primary hover:bg-transparent text-xs uppercase tracking-wider font-bold"
              onClick={handleExportCSV}
            >
              <Download className="w-3.5 h-3.5 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Results count / Bulk Actions */}
      <div className="flex items-center justify-between min-h-[36px]">
        <div className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {filteredMembers.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-foreground">
            {members.length}
          </span>{" "}
          members
        </div>

        {selectedIds.size > 0 && !staff && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
            <span className="text-sm font-semibold text-primary">
              {selectedIds.size} selected
            </span>

            <Button
              size="sm"
              variant="destructive"
              className="h-8 font-bold"
              onClick={() => setShowBulkDeleteConfirm(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="h-8 bg-primary text-primary-foreground hover:bg-accent font-bold"
                >
                  Bulk Actions <ArrowDown className="ml-2 w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[180px]">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Set Status</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {[
                        "Active",
                        "Past Due",
                        "Expired",
                        "Canceled",
                        "Renewed",
                        "On Extension",
                        "Pending",
                      ].map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => {
                            setBulkEditField("status");
                            setBulkEditValue(status);
                          }}
                        >
                          {status}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Set Program</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {programStore.getPrograms().map((program) => (
                        <DropdownMenuItem
                          key={program.name}
                          onClick={() => {
                            setBulkEditField("program");
                            setBulkEditValue(program.name);
                          }}
                        >
                          {program.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Set Closer</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {["Stephen B", "Stephen J", "Webinar", "Unassigned"].map(
                        (person) => (
                          <DropdownMenuItem
                            key={person}
                            onClick={() => {
                              setBulkEditField("closer");
                              setBulkEditValue(person);
                            }}
                          >
                            {person}
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Assign To</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {["Stephen B", "Stephen J", "Unassigned"].map(
                        (person) => (
                          <DropdownMenuItem
                            key={person}
                            onClick={() => {
                              setBulkEditField("assignedTo");
                              setBulkEditValue(person);
                            }}
                          >
                            {person}
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            {bulkEditField && bulkEditValue && (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in-95">
                <Badge variant="outline" className="h-8 bg-background">
                  {bulkEditField === "assignedTo"
                    ? "Assign to"
                    : bulkEditField === "closer"
                      ? "Closer"
                      : `Set ${bulkEditField}`}
                  :{" "}
                  <span className="font-bold ml-1 text-primary">
                    {bulkEditValue}
                  </span>
                </Badge>
                <Button
                  size="sm"
                  className="h-8 bg-primary text-primary-foreground hover:bg-accent font-bold"
                  onClick={handleBulkUpdate}
                >
                  Apply
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSelectedIds(new Set());
                setBulkEditField(null);
                setBulkEditValue("");
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg bg-card overflow-x-auto border border-border/30 dark:border-0 dark:[box-shadow:0_2px_20px_0_rgba(0,0,0,0.5)] [box-shadow:0_1px_4px_0_rgba(0,0,0,0.06)]">
        <Table className="min-w-[1100px]">
          <TableHeader className="bg-secondary/60">
            <TableRow className="dark:border-b-0 [box-shadow:inset_0_-1px_0_0_rgba(255,255,255,0.06)] hover:bg-transparent">
              {!staff && (
                <TableHead className="w-[40px] pl-4">
                  <Checkbox
                    checked={
                      filteredMembers.length > 0 &&
                      selectedIds.size === filteredMembers.length
                    }
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead
                className="w-[180px] font-bold tracking-wider text-xs uppercase cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-2">
                  Name <SortIcon col="name" />
                </div>
              </TableHead>
              <TableHead className="w-[110px] font-bold tracking-wider text-xs uppercase">
                Status
              </TableHead>
              <TableHead className="w-[110px] font-bold tracking-wider text-xs uppercase">
                Program
              </TableHead>
              <TableHead
                className="w-[110px] font-bold tracking-wider text-xs uppercase cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort("joined")}
              >
                <div className="flex items-center gap-2">
                  Joined <SortIcon col="joined" />
                </div>
              </TableHead>
              <TableHead
                className="w-[110px] font-bold tracking-wider text-xs uppercase cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort("expires")}
              >
                <div className="flex items-center gap-2">
                  Expires <SortIcon col="expires" />
                </div>
              </TableHead>
              {!staff && (
                <TableHead className="w-[240px] font-bold tracking-wider text-xs uppercase">
                  Payment
                </TableHead>
              )}
              {!staff && (
                <TableHead className="w-[100px] font-bold tracking-wider text-xs uppercase text-right">
                  LTV
                </TableHead>
              )}
              <TableHead className="w-[140px] font-bold tracking-wider text-xs uppercase">
                Notes
              </TableHead>
              <TableHead className="w-[110px] font-bold tracking-wider text-xs uppercase">
                Closer
              </TableHead>
              <TableHead className="w-[110px] font-bold tracking-wider text-xs uppercase">
                Assigned To
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member) => (
              <TableRow
                key={member.id}
                className="dark:border-b-0 [box-shadow:inset_0_-1px_0_0_rgba(255,255,255,0.03)] hover:bg-secondary/50 group cursor-pointer transition-colors hover:[box-shadow:0_0_0_1.5px_hsl(var(--primary)/0.5),inset_0_-1px_0_0_rgba(255,255,255,0.03)]"
                onClick={() => handleRowClick(member.id)}
              >
                {!staff && (
                  <TableCell
                    className="w-[40px] pl-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.has(member.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(member.id, !!checked)
                      }
                      aria-label={`Select ${member.name}`}
                    />
                  </TableCell>
                )}
                <TableCell className="w-[180px]">
                  <span className="font-semibold block leading-tight">
                    {member.name}
                  </span>
                </TableCell>
                <TableCell className="w-[110px]">
                  <Badge
                    className={`border-none text-xs whitespace-nowrap ${getStatusColor(member.status)}`}
                  >
                    {member.status}
                  </Badge>
                </TableCell>
                <TableCell className="w-[110px]">
                  <div className="flex flex-wrap gap-1">
                    {member.program
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((p) => (
                        <Badge
                          key={p}
                          variant="outline"
                          className={`border-none text-xs whitespace-nowrap ${getProgramColor()}`}
                        >
                          {p}
                        </Badge>
                      ))}
                  </div>
                </TableCell>
                <TableCell className="w-[110px] text-muted-foreground text-sm whitespace-nowrap">
                  {formatDateStr(member.joined)}
                </TableCell>
                <TableCell className="w-[110px] text-muted-foreground text-sm whitespace-nowrap">
                  {formatDateStr(member.expires)}
                </TableCell>
                {!staff && (
                  <TableCell className="w-[240px]">
                    <PaymentCell payment={member.payment} />
                  </TableCell>
                )}
                {!staff && (
                  <TableCell className="w-[100px] text-right font-semibold text-sm whitespace-nowrap">
                    {member.ltv}
                  </TableCell>
                )}
                <TableCell
                  className="w-[140px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {staff ? (
                    <span className="text-xs text-muted-foreground truncate max-w-[110px] inline-block">
                      {member.notes || "—"}
                    </span>
                  ) : (
                    <button
                      className="text-left w-full text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 group/note"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMember(member);
                        setTempNotes(member.notes);
                      }}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover/note:opacity-100" />
                      <span className="truncate max-w-[110px]">
                        {member.notes || (
                          <span className="italic opacity-50">Add note</span>
                        )}
                      </span>
                    </button>
                  )}
                </TableCell>
                <TableCell className="w-[110px]">
                  <span className="text-xs text-muted-foreground">
                    {member.closer || "—"}
                  </span>
                </TableCell>
                <TableCell className="w-[110px]">
                  <span className="text-xs text-muted-foreground">
                    {["Supercharge", "VIP", "Concierge"].includes(
                      member.program,
                    )
                      ? member.assignedTo || "—"
                      : "—"}
                  </span>
                </TableCell>
                {!staff && (
                  <TableCell
                    className="w-[40px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setMemberToDelete(member)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filteredMembers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={staff ? 7 : 10}
                  className="h-32 text-center text-muted-foreground"
                >
                  {members.length === 0
                    ? "No members yet. Import a CSV or add your first member."
                    : "No members match the current filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
      >
        <DialogContent className="bg-card border-border/50 text-foreground sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-widest uppercase text-primary flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Notes — {editingMember?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={tempNotes}
              onChange={(e) => setTempNotes(e.target.value)}
              placeholder="Enter member notes here..."
              className="min-h-[200px] bg-background border-border/50 focus-visible:ring-primary resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveNotes}
              className="bg-primary text-primary-foreground hover:bg-accent font-bold tracking-wide uppercase"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!memberToDelete}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      >
        <AlertDialogContent className="bg-card border-border/50 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold tracking-wide uppercase flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete Member
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">
                {memberToDelete?.name}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/50 hover:bg-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showBulkDeleteConfirm}
        onOpenChange={(open) => !open && setShowBulkDeleteConfirm(false)}
      >
        <AlertDialogContent className="bg-card border-border/50 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold tracking-wide uppercase flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete {selectedIds.size} Members
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">
                {selectedIds.size} members
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/50 hover:bg-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
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
