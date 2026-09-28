import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  Upload,
  Users,
  Tag,
  CreditCard,
  ArrowRight,
} from "lucide-react";

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const steps = [
    { id: 1, title: "Team Setup", icon: Users },
    { id: 2, title: "Program Setup", icon: Tag },
    { id: 3, title: "Data Import", icon: Upload },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary text-primary-foreground font-bold text-2xl flex items-center justify-center rounded-xl mx-auto mb-6">
            RFA
          </div>
          <h1 className="text-3xl font-bold tracking-widest uppercase">
            Let's Set Up Your Hub
          </h1>
          <p className="text-muted-foreground">
            Configure your command center to start managing your members.
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="flex items-center justify-between relative mb-12">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-border/50 z-0"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary z-0 transition-all duration-500"
            style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
          ></div>

          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = step >= s.id;
            return (
              <div
                key={s.id}
                className="relative z-10 flex flex-col items-center gap-2"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-background transition-colors duration-300 ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  {isActive && step > s.id ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </div>
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Team Setup */}
        {step === 1 && (
          <Card className="p-8 border-border/50 bg-card animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold tracking-widest uppercase mb-6 text-primary">
              Invite Your Team
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    placeholder="partner@example.com"
                    className="bg-background border-border/50"
                  />
                </div>
                <div className="w-48 space-y-2">
                  <Label>Role</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-border/50 bg-background text-sm">
                    <option>Admin</option>
                    <option>Success Manager</option>
                    <option>VA</option>
                  </select>
                </div>
                <Button variant="secondary">Invite</Button>
              </div>
              <div className="pt-6 mt-6 border-t border-border/50">
                <p className="text-sm font-bold uppercase mb-4 text-muted-foreground">
                  Current Team
                </p>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                      ST
                    </div>
                    <div>
                      <p className="text-sm font-bold">Stephen</p>
                      <p className="text-xs text-muted-foreground">
                        stephen@richfromanywhere.com
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold uppercase text-primary">
                    Owner
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-8">
              <Button
                onClick={() => setStep(2)}
                className="bg-primary text-primary-foreground hover:bg-accent font-bold tracking-wide uppercase"
              >
                Next Step <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Program Setup */}
        {step === 2 && (
          <Card className="p-8 border-border/50 bg-card animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold tracking-widest uppercase mb-6 text-primary">
              Configure Programs
            </h2>
            <div className="space-y-4">
              {["Jumpstart", "Inner Circle", "Supercharge", "VIP"].map(
                (prog, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50"
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary"
                      />
                      <span className="font-bold">{prog}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                    >
                      Edit Defaults
                    </Button>
                  </div>
                ),
              )}
              <Button
                variant="outline"
                className="w-full border-dashed border-border/50 text-muted-foreground hover:text-foreground"
              >
                + Add Custom Program
              </Button>
            </div>
            <div className="flex justify-between mt-8">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="bg-primary text-primary-foreground hover:bg-accent font-bold tracking-wide uppercase"
              >
                Next Step <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Data Import */}
        {step === 3 && (
          <Card className="p-8 border-border/50 bg-card animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold tracking-widest uppercase mb-6 text-primary">
              Import Existing Members
            </h2>
            <div className="border-2 border-dashed border-border/50 rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer bg-background/50">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">
                Upload Spreadsheet (CSV)
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                We'll automatically map your columns and parse payment details
                into structured data.
              </p>
              <Button variant="secondary">Select File</Button>
            </div>
            <div className="flex justify-between mt-8">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                onClick={() => navigate("/")}
                className="bg-status-active text-white hover:bg-status-active/80 font-bold tracking-wide uppercase"
              >
                Complete Setup <CheckCircle className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
