import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Target,
  Plus,
  Trash2,
  Save,
  Moon,
  Sun,
  Clock,
  Database,
  RefreshCw,
} from "lucide-react";
import {
  memberStore,
  programStore,
  Program,
  syncCrossPlatformData,
  deduplicateMembers,
} from "@/lib/store";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useHub } from "@/hooks/use-hub";

const AUTO_THEME_KEY = "rfa-auto-theme-schedule";

export default function Settings() {
  const { isCCK } = useHub();
  const { setTheme } = useTheme();
  const [syncing, setSyncing] = useState(false);
  const [deduping, setDeduping] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncCrossPlatformData();
      toast.success("Cross-platform sync complete — all member data updated");
    } catch {
      toast.error("Sync failed — please try again");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeduplicate = async () => {
    if (
      !confirm(
        "This will scan all RFA members for duplicates (same name) and remove the less complete record. Continue?",
      )
    )
      return;
    setDeduping(true);
    try {
      const removed = await deduplicateMembers();
      if (removed > 0) {
        toast.success(
          `Removed ${removed} duplicate member${removed === 1 ? "" : "s"}`,
        );
      } else {
        toast.success("No duplicates found — your member list is clean!");
      }
    } catch {
      toast.error("Deduplication failed — please try again");
    } finally {
      setDeduping(false);
    }
  };

  const [programs, setPrograms] = useState<Program[]>(() =>
    programStore.getPrograms(),
  );

  const [autoThemeEnabled, setAutoThemeEnabled] = useState(() => {
    return localStorage.getItem(AUTO_THEME_KEY) === "true";
  });

  const handleToggleAutoTheme = (enabled: boolean) => {
    setAutoThemeEnabled(enabled);
    localStorage.setItem(AUTO_THEME_KEY, enabled ? "true" : "false");
    if (enabled) {
      const now = new Date();
      const estHour = new Date(
        now.toLocaleString("en-US", { timeZone: "America/New_York" }),
      ).getHours();
      if (estHour >= 7 && estHour < 20) {
        setTheme("light");
        toast.success(
          "Auto theme enabled — switching to Light Mode (7am–8pm EST)",
        );
      } else {
        setTheme("dark");
        toast.success(
          "Auto theme enabled — switching to Dark Mode (8pm–7am EST)",
        );
      }
    } else {
      toast.success("Auto theme scheduling disabled");
    }
  };

  const handleAddProgram = () => {
    setPrograms([
      ...programs,
      { name: "New Program", duration: "12", price: "$0" },
    ]);
  };

  const handleRemoveProgram = (index: number) => {
    setPrograms(programs.filter((_, i) => i !== index));
  };

  const handleUpdateProgram = (
    index: number,
    field: keyof Program,
    value: string,
  ) => {
    const updated = [...programs];
    updated[index] = { ...updated[index], [field]: value };
    setPrograms(updated);
  };

  const handleSave = (section: string) => {
    if (section === "Program") {
      programStore.savePrograms(programs);
    }
    toast.success(`${section} settings saved successfully`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold uppercase tracking-widest text-primary">
          Hub Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your programs and appearance preferences.
        </p>
      </div>

      <Tabs
        defaultValue={isCCK ? "appearance" : "programs"}
        className="space-y-6"
      >
        <TabsList className="bg-card border border-border/50 p-1">
          {!isCCK && (
            <TabsTrigger value="programs" className="gap-2">
              <Target className="w-4 h-4" /> Programs
            </TabsTrigger>
          )}
          <TabsTrigger value="appearance" className="gap-2">
            <Sun className="w-4 h-4" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Database className="w-4 h-4" /> Data Management
          </TabsTrigger>
        </TabsList>

        {/* PROGRAMS TAB */}
        {!isCCK && (
          <TabsContent value="programs" className="space-y-6">
            <Card className="bg-card border-none shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Program Setup</CardTitle>
                  <CardDescription>
                    Define your membership tiers and default durations.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={handleAddProgram}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground font-bold"
                >
                  <Plus className="w-4 h-4" /> Add Program
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {programs.map((program, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg bg-secondary/30 border border-border/10 space-y-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <Input
                          value={program.name}
                          onChange={(e) =>
                            handleUpdateProgram(index, "name", e.target.value)
                          }
                          className="font-bold text-primary h-8 border-transparent hover:border-border focus:border-primary bg-transparent p-0 px-2"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveProgram(index)}
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground tracking-widest">
                            Duration (Months)
                          </Label>
                          <Input
                            value={program.duration}
                            onChange={(e) =>
                              handleUpdateProgram(
                                index,
                                "duration",
                                e.target.value,
                              )
                            }
                            className="h-8 bg-background/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground tracking-widest">
                            Default Price
                          </Label>
                          <Input
                            value={program.price}
                            onChange={(e) =>
                              handleUpdateProgram(
                                index,
                                "price",
                                e.target.value,
                              )
                            }
                            className="h-8 bg-background/50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => handleSave("Program")}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground font-bold"
                  >
                    <Save className="w-4 h-4" /> Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* APPEARANCE TAB */}
        <TabsContent value="appearance" className="space-y-6">
          <Card className="bg-card border-none shadow-lg">
            <CardHeader>
              <CardTitle>Appearance & Theme</CardTitle>
              <CardDescription>
                Control how the hub looks throughout the day.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between p-5 rounded-lg bg-secondary/30 border border-border/10 gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <Label className="text-base font-semibold">
                      Auto Theme Schedule
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically switch to{" "}
                    <span className="text-foreground font-medium">
                      Light Mode at 7am EST
                    </span>{" "}
                    and{" "}
                    <span className="text-foreground font-medium">
                      Dark Mode at 8pm EST
                    </span>{" "}
                    every day.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When enabled, your manual theme selection is overridden by
                    the schedule.
                  </p>
                </div>
                <Switch
                  checked={autoThemeEnabled}
                  onCheckedChange={handleToggleAutoTheme}
                  className="shrink-0 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div
                  className={`p-4 rounded-lg border flex flex-col gap-2 ${autoThemeEnabled ? "border-primary/40 bg-primary/5" : "border-border/10 bg-secondary/20 opacity-50"}`}
                >
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm uppercase tracking-wider">
                      Light Mode
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">7:00 AM</p>
                  <p className="text-xs text-muted-foreground">
                    Eastern Time — active until 8pm
                  </p>
                </div>
                <div
                  className={`p-4 rounded-lg border flex flex-col gap-2 ${autoThemeEnabled ? "border-primary/40 bg-primary/5" : "border-border/10 bg-secondary/20 opacity-50"}`}
                >
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm uppercase tracking-wider">
                      Dark Mode
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">8:00 PM</p>
                  <p className="text-xs text-muted-foreground">
                    Eastern Time — active until 7am
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* DATA MANAGEMENT TAB */}
        <TabsContent value="data" className="space-y-6">
          <Card className="bg-card border-none shadow-lg">
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Control your member data and local storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cross-Platform Sync */}
              <div className="p-5 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    <Label className="text-base font-semibold">
                      Sync RFA ↔ CCK Data
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Force a full sync between RFA Members Hub and CCK Members
                    Hub. Updates CCK status on all RFA profiles and RFA programs
                    on all CCK profiles.
                  </p>
                </div>
                <Button
                  className="shrink-0 font-bold bg-primary text-primary-foreground hover:bg-accent"
                  disabled={syncing}
                  onClick={handleManualSync}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
              </div>

              {/* Deduplication */}
              <div className="p-5 rounded-lg bg-secondary/30 border border-border/20 flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    <Label className="text-base font-semibold">
                      Remove Duplicate Members
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Scan RFA Members for duplicates with the same name and
                    automatically keep the most complete record.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 font-bold border-primary/40 text-primary hover:bg-primary/10"
                  disabled={deduping}
                  onClick={handleDeduplicate}
                >
                  <Database
                    className={`w-4 h-4 mr-2 ${deduping ? "animate-pulse" : ""}`}
                  />
                  {deduping ? "Scanning..." : "Remove Duplicates"}
                </Button>
              </div>

              <div className="p-5 rounded-lg bg-destructive/5 border border-destructive/20 flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-destructive" />
                    <Label className="text-base font-semibold text-destructive">
                      Clear All Member Data
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all members from this dashboard. This
                    action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  className="shrink-0 font-bold"
                  onClick={async () => {
                    if (
                      confirm(
                        "Are you sure you want to delete ALL members? This will reset your dashboard and cannot be undone.",
                      )
                    ) {
                      await memberStore.clearMembers();
                      toast.success("All member data cleared");
                      setTimeout(() => window.location.reload(), 1000);
                    }
                  }}
                >
                  Delete Everything
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
