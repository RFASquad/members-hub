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
  Plus,
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
import { CckMember, cckStore, isStaff } from "@/lib/store";
import { supabase } from "@/lib/supabase";
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
    case "Trialing":
      return "bg-status-renewed text-white";
    case "Past Due":
      return "bg-status-warning text-white";
    case "Expired":
      return "bg-status-expired text-white";
    case "Canceled":
      return "bg-status-canceled text-white";
    case "Non-Member":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getProgramColor = () => "bg-primary text-primary-foreground";

export default function CommunicakeMembers() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [members, setMembers] = useState<CckMember[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof CckMember;
    direction: "asc" | "desc";
  }>({ key: "subscription_start", direction: "desc" });
  const [editingMember, setEditingMember] = useState<CckMember | null>(null);
  const [tempNotes, setTempNotes] = useState("");
  const [memberToDelete, setMemberToDelete] = useState<CckMember | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditField, setBulkEditField] = useState<
    "status" | "plan_amount_display" | null
  >(null);
  const [bulkEditValue, setBulkEditValue] = useState("");
  const staff = isStaff();

  useEffect(() => {
    cckStore.getMembers().then(setMembers);
    if (location.state?.statusFilter) {
      setStatusFilter(location.state.statusFilter as string);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSaveNotes = async () => {
    if (editingMember) {
      await cckStore.updateMember(editingMember.id, { notes: tempNotes });
      setMembers(await cckStore.getMembers());
      setEditingMember(null);
      toast.success("Notes updated successfully");
    }
  };

  const handleRowClick = (id: string) => navigate(`/communicake/members/${id}`);

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
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
          complete: async (results) => {
            const rawData = results.data as any[];
            const newMembers: Partial<CckMember>[] = rawData.map((row) => ({
              id: crypto.randomUUID(),
              name: (row["Name"] || "Unknown Member").trim(),
              email: (row["Email"] || "").trim(),
              status: (row["Status"] || "Active").trim(),
              plan_amount_display: (row["Plan"] || "$0").trim(),
              subscription_start: (row["Started"] || "").trim(),
              trial_end: (row["Trial End"] || "").trim(),
              notes: (row["Notes"] || "").trim(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }));
            const { error } = await supabase
              .from("cck_members")
              .upsert(newMembers as any);
            if (error) throw error;
            setMembers(await cckStore.getMembers());
            toast.success(`Successfully imported ${newMembers.length} members`);
          },
          error: (err: any) => toast.error(`Import failed: ${err.message}`),
        });
      } catch (err: any) {
        toast.error(
          `Import failed: ${err?.message || "Please check the format."}`,
        );
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleExportCSV = async () => {
    const data = await cckStore.getMembers();
    if (data.length === 0) {
      toast.error("No members to export");
      return;
    }

    const exportData = data.map((m) => ({
      Name: m.name,
      Email: m.email,
      Status: m.status,
      Plan: m.plan_amount_display,
      Started: m.subscription_start,
      "Trial End": m.trial_end,
      Notes: m.notes || "",
    }));

    const csvContent = Papa.unparse(exportData);
    const filename = `cck_members_${new Date().toISOString().split("T")[0]}.csv`;
    const blob = new Blob(["\ufeff", csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
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
    await cckStore.deleteMember(memberToDelete.id);
    setMembers(await cckStore.getMembers());
    setMemberToDelete(null);
    toast.success(`${memberToDelete.name} has been deleted.`);
  };

  const handleSort = (key: keyof CckMember) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc")
      direction = "desc";
    setSortConfig({ key, direction });
  };

  const filteredMembers = members
    .filter((m) => {
      let matchesStatus = true;
      if (statusFilter !== "all") {
        matchesStatus =
          (m.status || "").toLowerCase() === statusFilter.toLowerCase();
      }

      let matchesPlan = true;
      if (planFilter !== "all") {
        const planVal = (m.plan_amount_display || "").toLowerCase().trim();
        const filterVal = planFilter.toLowerCase().trim();
        matchesPlan =
          planVal === filterVal ||
          planVal + "/month" === filterVal ||
          planVal === filterVal.replace("/month", "");
      }

      return matchesStatus && matchesPlan;
    })
    .sort((a, b) => {
      const { key, direction } = sortConfig;
      let aValue: unknown = a[key];
      let bValue: unknown = b[key];
      if (key === "subscription_start" || key === "trial_end") {
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
    if (checked) setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const handleBulkUpdate = async () => {
    if (!bulkEditField || !bulkEditValue) return;
    const updates: Partial<CckMember> = {};
    updates[bulkEditField] = bulkEditValue;
    await cckStore.bulkUpdateMembers(Array.from(selectedIds), updates);
    setMembers(await cckStore.getMembers());
    setBulkEditField(null);
    setBulkEditValue("");
    setSelectedIds(new Set());
    toast.success(`Updated ${selectedIds.size} members successfully`);
  };

  const handleBulkDelete = async () => {
    if (
      confirm(
        `Are you sure you want to delete ${selectedIds.size} members? This cannot be undone.`,
      )
    ) {
      const count = selectedIds.size;
      await cckStore.bulkDeleteMembers(Array.from(selectedIds));
      setMembers(await cckStore.getMembers());
      setSelectedIds(new Set());
      setBulkEditField(null);
      setBulkEditValue("");
      toast.success(`Deleted ${count} members successfully`);
    }
  };

  const SortIcon = ({ col }: { col: keyof CckMember }) => {
    if (sortConfig.key === col) {
      return sortConfig.direction === "asc" ? (
        <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3" />
      );
    }
    return <ArrowUpDown className="w-3 h-3 opacity-30" />;
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
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="past due">Past Due</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
              <SelectItem value="non-member">Non-Member</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[160px] border-border/50 bg-background">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="$97/month">$97/month</SelectItem>
              <SelectItem value="$297/month">$297/month</SelectItem>
              <SelectItem value="$497/month">$497/month</SelectItem>
              <SelectItem value="$0">$0</SelectItem>
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
              onClick={handleBulkDelete}
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
                        "Trialing",
                        "Past Due",
                        "Canceled",
                        "Non-Member",
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
                  <DropdownMenuSubTrigger>Set Plan</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {["$97/month", "$297/month", "$497/month", "$0"].map(
                        (plan) => (
                          <DropdownMenuItem
                            key={plan}
                            onClick={() => {
                              setBulkEditField("plan_amount_display");
                              setBulkEditValue(plan);
                            }}
                          >
                            {plan}
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
                  {`Set ${bulkEditField}`}:{" "}
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
              <TableHead
                className="w-[180px] font-bold tracking-wider text-xs uppercase cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort("email")}
              >
                <div className="flex items-center gap-2">
                  Email <SortIcon col="email" />
                </div>
              </TableHead>
              <TableHead className="w-[110px] font-bold tracking-wider text-xs uppercase">
                Status
              </TableHead>
              {!staff && (
                <TableHead className="w-[110px] font-bold tracking-wider text-xs uppercase">
                  Plan
                </TableHead>
              )}
              <TableHead
                className="w-[110px] font-bold tracking-wider text-xs uppercase cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort("subscription_start")}
              >
                <div className="flex items-center gap-2">
                  Started <SortIcon col="subscription_start" />
                </div>
              </TableHead>
              <TableHead
                className="w-[110px] font-bold tracking-wider text-xs uppercase cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort("trial_end")}
              >
                <div className="flex items-center gap-2">
                  Trial End <SortIcon col="trial_end" />
                </div>
              </TableHead>
              <TableHead className="w-[140px] font-bold tracking-wider text-xs uppercase">
                Notes
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
                <TableCell className="w-[180px]">
                  <span className="text-sm text-muted-foreground">
                    {member.email || "—"}
                  </span>
                </TableCell>
                <TableCell className="w-[110px]">
                  <Badge
                    className={`border-none text-xs whitespace-nowrap ${getStatusColor(member.status)}`}
                  >
                    {member.status || "—"}
                  </Badge>
                </TableCell>
                {!staff && (
                  <TableCell className="w-[110px]">
                    <Badge
                      variant="outline"
                      className={`border-none text-xs whitespace-nowrap ${getProgramColor()}`}
                    >
                      {member.plan_amount_display || "—"}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="w-[110px] text-muted-foreground text-sm whitespace-nowrap">
                  {formatDateStr(member.subscription_start)}
                </TableCell>
                <TableCell className="w-[110px] text-muted-foreground text-sm whitespace-nowrap">
                  {formatDateStr(member.trial_end)}
                </TableCell>
                <TableCell className="w-[140px]">
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
                        setTempNotes(member.notes || "");
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
                  colSpan={staff ? 6 : 8}
                  className="h-32 text-center text-muted-foreground"
                >
                  {members.length === 0
                    ? "No CCK members yet. Import a CSV or add your first member."
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
    </div>
  );
}
