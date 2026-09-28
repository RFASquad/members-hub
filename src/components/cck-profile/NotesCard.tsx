import { useRef, useState } from "react";
import { FileText, Plus, X, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { PINK, PINK_SUBTLE, PINK_BORDER } from "./shared";

export interface NoteItem {
  id: string;
  text: string;
  createdAt: string;
}

interface NotesCardProps {
  notes: NoteItem[];
  onSaveNotes: (notes: NoteItem[]) => Promise<void>;
}

export function NotesCard({ notes, onSaveNotes }: NotesCardProps) {
  const [newNoteText, setNewNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const notesEndRef = useRef<HTMLDivElement>(null);

  const handleAddNote = async () => {
    const trimmed = newNoteText.trim();
    if (!trimmed) return;
    const newNote = {
      id: Date.now().toString(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    const updated = [...notes, newNote];
    await onSaveNotes(updated);
    setNewNoteText("");
    setShowNoteInput(false);
    setTimeout(
      () => notesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  };

  const handleDeleteNote = async (noteId: string) => {
    const updated = notes.filter((n) => n.id !== noteId);
    await onSaveNotes(updated);
  };

  const handleSaveEditedNote = async (noteId: string) => {
    const trimmed = editingNoteText.trim();
    if (!trimmed) return;
    const updated = notes.map((n) =>
      n.id === noteId ? { ...n, text: trimmed } : n,
    );
    await onSaveNotes(updated);
    setEditingNoteId(null);
    setEditingNoteText("");
  };

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm border border-border/30 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-xs font-bold tracking-widest uppercase flex items-center gap-1.5"
          style={{ color: PINK }}
        >
          <FileText className="w-3.5 h-3.5" />
          Notes
        </h2>
        <button
          onClick={() => {
            setShowNoteInput(!showNoteInput);
            if (!showNoteInput) {
              setTimeout(() => {
                const el = document.getElementById("cck-new-note-input");
                el?.focus();
              }, 50);
            }
          }}
          className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: PINK_SUBTLE,
            border: `1px solid ${PINK_BORDER}`,
            color: PINK,
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
      <div
        className="overflow-y-auto space-y-2 mb-3 pr-1"
        style={{ maxHeight: "260px", minHeight: "80px" }}
      >
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No notes yet.</p>
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
                      className="w-full min-h-[60px] max-h-[120px] bg-background border-border/50 focus-visible:ring-pink-400 resize-none text-sm"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveEditedNote(note.id)}
                        className="text-xs font-semibold px-2 py-1 rounded transition-colors"
                        style={{ background: PINK_SUBTLE, color: PINK }}
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
                        style={{ color: PINK }}
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
      {showNoteInput && (
        <div className="flex items-end gap-2 border-t border-border/20 pt-3">
          <Textarea
            id="cck-new-note-input"
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
            className="flex-1 min-h-[60px] max-h-[120px] bg-background border-border/50 focus-visible:ring-pink-400 resize-none text-sm"
          />
          <button
            onClick={handleAddNote}
            disabled={!newNoteText.trim()}
            className="shrink-0 p-2.5 rounded-lg transition-colors disabled:opacity-30"
            style={{ background: PINK_SUBTLE, color: PINK }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(232,62,140,0.25)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = PINK_SUBTLE)
            }
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
