import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  ChevronLeft,
  Download,
  FileSpreadsheet,
  Filter,
  LogOut,
  MessageSquareText,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  COLUMN_GROUPS,
  COLUMN_ORDER,
  DIMENSION_FIELDS,
  EDITABLE_FIELDS,
  fieldColumnIndex,
  gradeParticipant,
  isDimensionValue,
  type DimensionField,
  type EditableField,
  type GradedParticipant,
  type Participant,
} from "@/lib/grading";
import { createGradingDataProvider, toAssessmentDraft } from "@/lib/grading-data-provider";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zilla T3 Master Trainer Grading" },
      { name: "description", content: "Internal demo workspace for assessing Master Trainer participants in Zilla's five-day T3 program." },
      { property: "og:title", content: "Zilla T3 Master Trainer Grading" },
      { property: "og:description", content: "Internal demo grading workspace for the five-day Zilla T3 program." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const DEMO_STORAGE_NOTICE = "Demo storage · this browser only";
const NO_FILTER = "__all__";

type SortConfig = { field: string; direction: "asc" | "desc" } | null;
type Filters = { Division: string; District: string; Taluka: string; batchName: string };

function Index() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loginStep, setLoginStep] = useState<"phone" | "otp" | "workspace">("phone");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const savedParticipantsRef = useRef<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState(NO_FILTER);
  const [filters, setFilters] = useState<Filters>({ Division: NO_FILTER, District: NO_FILTER, Taluka: NO_FILTER, batchName: NO_FILTER });
  const [sort, setSort] = useState<SortConfig>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<Participant | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const authenticated = window.sessionStorage.getItem("zilla-t3-demo-auth") === "yes";
    if (authenticated) setLoginStep("workspace");
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (loginStep !== "workspace") return;
    let active = true;
    setLoading(true);
    const provider = createGradingDataProvider(window.localStorage);
    provider.loadParticipants().then((loaded) => {
      if (!active) return;
      setParticipants(loaded);
      savedParticipantsRef.current = structuredClone(loaded);
      setLoading(false);
    }).catch(() => {
      if (active) {
        setParticipants([]);
        setLoading(false);
        setFeedback("Demo rows could not be loaded from this browser.");
      }
    });
    return () => { active = false; };
  }, [loginStep]);

  const dirtyRowIds = useMemo(() => {
    const dirty = new Set<string>();
    for (const participant of participants) {
      const before = savedParticipantsRef.current.find((row) => row.id === participant.id);
      if (before && EDITABLE_FIELDS.some((field) => before[field] !== participant[field])) dirty.add(participant.id);
    }
    return dirty;
  }, [participants]);

  useEffect(() => {
    if (!dirtyRowIds.size) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirtyRowIds.size]);

  const completedCount = useMemo(
    () => participants.filter((row) => {
      const grade = gradeParticipant(row)["Internal Grade"];
      return grade !== "" && grade !== "Absent";
    }).length,
    [participants],
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = participants.filter((row) => {
      const matchesSearch = !term || [row.Name, row.userId, row.phone].some((value) => value.toLowerCase().includes(term));
      const matchesBatch = batchFilter === NO_FILTER || row.batchName === batchFilter;
      const matchesGeography = (Object.keys(filters) as (keyof Filters)[]).every((key) => filters[key] === NO_FILTER || row[key] === filters[key]);
      return matchesSearch && matchesBatch && matchesGeography;
    });
    if (!sort) return visible;
    const valueFor = (row: Participant, field: string) => {
      if (field === "Score" || field === "Internal Grade") return gradeParticipant(row)[field];
      return row[field as keyof Participant];
    };
    return [...visible].sort((a, b) => {
      const left = valueFor(a, sort.field);
      const right = valueFor(b, sort.field);
      const comparison = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [batchFilter, filters, participants, search, sort]);

  const updateField = useCallback((id: string, field: EditableField, value: string) => {
    setParticipants((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setErrors((current) => {
      const next = { ...current };
      delete next[`${id}::${field}`];
      return next;
    });
    setFeedback("");
  }, []);

  const handleCellValue = useCallback((id: string, field: EditableField, rawValue: string) => {
    const valid = field === "Recommendation"
      ? rawValue === "" || rawValue === "Recommended as MT" || rawValue === "Not Recommended as MT"
      : field === "Comments" || isDimensionValue(rawValue);
    if (!valid) {
      setErrors((current) => ({ ...current, [`${id}::${field}`]: field === "Recommendation" ? "Choose one of the listed options." : "Enter a whole number from 0–5, or – for absent." }));
      return;
    }
    updateField(id, field, rawValue);
  }, [updateField]);

  const pasteGrid = useCallback((startRowId: string, startField: EditableField, text: string) => {
    const grid = text.replace(/\r/g, "").split("\n").map((line) => line.split("\t"));
    if (grid.length === 1 && grid[0]?.length === 1) return false;
    const startRowIndex = filteredRows.findIndex((row) => row.id === startRowId);
    const startColumnIndex = fieldColumnIndex(startField);
    let accepted = 0;
    let invalid = 0;
    const invalidCells: Record<string, string> = {};
    const updates: { id: string; field: EditableField; value: string }[] = [];

    grid.forEach((line, rowOffset) => {
      const row = filteredRows[startRowIndex + rowOffset];
      if (!row) return;
      line.forEach((raw, colOffset) => {
        const fieldName = COLUMN_ORDER[startColumnIndex + colOffset];
        if (!fieldName || !EDITABLE_FIELDS.includes(fieldName as EditableField)) return;
        const field = fieldName as EditableField;
        const value = raw.trim();
        const valid = field === "Recommendation"
          ? value === "" || value === "Recommended as MT" || value === "Not Recommended as MT"
          : field === "Comments" || isDimensionValue(value);
        if (!valid) {
          invalid += 1;
          invalidCells[`${row.id}::${field}`] = field === "Recommendation" ? "Choose one of the listed options." : "Enter a whole number from 0–5, or – for absent.";
          return;
        }
        accepted += 1;
        updates.push({ id: row.id, field, value });
      });
    });

    setParticipants((current) => current.map((row) => {
      const values = updates.filter((update) => update.id === row.id);
      return values.reduce((next, update) => ({ ...next, [update.field]: update.value }), row);
    }));
    setErrors((current) => {
      const next = { ...current };
      updates.forEach(({ id, field }) => delete next[`${id}::${field}`]);
      return { ...next, ...invalidCells };
    });
    setFeedback(`${accepted} pasted ${accepted === 1 ? "value" : "values"}${invalid ? ` · ${invalid} invalid ${invalid === 1 ? "cell" : "cells"} flagged` : ""}`);
    return true;
  }, [filteredRows]);

  const saveChanges = async () => {
    const provider = createGradingDataProvider(window.localStorage);
    try {
      await provider.saveDrafts(participants.map(toAssessmentDraft));
      savedParticipantsRef.current = structuredClone(participants);
      setFeedback(`Changes saved · ${DEMO_STORAGE_NOTICE}`);
    } catch {
      setFeedback("Could not save to this browser. Your edits remain on screen.");
    }
  };

  const discardChanges = () => {
    const baseline = savedParticipantsRef.current;
    setParticipants((current) => current.map((row) => {
      const original = baseline.find((candidate) => candidate.id === row.id);
      return original ? structuredClone(original) : row;
    }));
    setErrors({});
    setFeedback("Unsaved edits discarded.");
    setDiscardOpen(false);
  };

  const openNotes = (participant: Participant) => {
    setNoteTarget(participant);
    setNoteDraft(participant.Comments);
    setNoteOpen(true);
  };

  const applyNotes = () => {
    if (noteTarget) updateField(noteTarget.id, "Comments", noteDraft);
    setNoteOpen(false);
    setNoteTarget(null);
  };

  const exportWorkbook = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = filteredRows.map((participant) => {
        const graded = gradeParticipant(participant);
        return Object.fromEntries(COLUMN_ORDER.map((column) => [column, column === "Sr no." ? participant["Sr no."] : graded[column as keyof GradedParticipant] ?? ""]));
      });
      const sheet = XLSX.utils.json_to_sheet(rows, { header: [...COLUMN_ORDER] });
      sheet["!cols"] = COLUMN_ORDER.map((column) => ({ wch: Math.min(38, Math.max(14, column.length + 2)) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "T3 MT Grading");
      XLSX.writeFile(workbook, "Zilla_T3_Master_Trainer_Grading.xlsx");
      setFeedback(`Excel downloaded · ${filteredRows.length} visible rows${dirtyRowIds.size ? " · includes unsaved edits" : " · saved values"}`);
    } catch {
      setFeedback("The Excel file could not be created. Your edits remain on screen.");
    }
  };

  const requestLogout = () => {
    if (dirtyRowIds.size) {
      setConfirmLogout(true);
      return;
    }
    window.sessionStorage.removeItem("zilla-t3-demo-auth");
    setLoginStep("phone");
  };

  if (!sessionReady || loginStep !== "workspace") {
    return (
      <LoginScreen
        step={loginStep === "otp" ? "otp" : "phone"}
        phone={phone}
        otp={otp}
        setPhone={setPhone}
        setOtp={setOtp}
        onContinue={() => setLoginStep("otp")}
        onBack={() => setLoginStep("phone")}
        onVerify={() => {
          window.sessionStorage.setItem("zilla-t3-demo-auth", "yes");
          setLoginStep("workspace");
        }}
      />
    );
  }

  const uniqueOptions = (field: keyof Filters) => [...new Set(participants.map((row) => row[field]).filter(Boolean))].sort();
  const filterSelect = (label: string, value: string, options: string[], onValueChange: (value: string) => void) => (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label} className="h-8 w-[132px] rounded border-border bg-background text-xs">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_FILTER}>All {label}</SelectItem>
        {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-2 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground"><Award className="size-5" /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm font-semibold">Zilla T3 Master Trainer Grading</h1>
                <span className="rounded border border-accent-foreground/15 bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">DEMO</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Five-day T3 program <span className="mx-1">·</span> Internal assessment workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 border-r border-border pr-3 text-[11px] text-muted-foreground sm:inline-flex"><span className="size-1.5 rounded-full bg-primary" />{DEMO_STORAGE_NOTICE}</span>
            <Button variant="ghost" size="icon" aria-label="Sign out of demo" title="Sign out of demo" onClick={requestLogout}><LogOut /></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1920px] px-3 py-4 sm:px-5 lg:px-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-primary">Assessment register <span className="mx-1 text-muted-foreground">/</span> 2026</p>
            <h2 className="text-xl font-semibold">Master Trainer participants</h2>
            <p className="mt-1 text-xs text-muted-foreground">Grade each participant across six program dimensions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-2 text-muted-foreground"><Users className="size-4" /> <strong className="font-semibold text-foreground">{filteredRows.length}</strong> of {participants.length} participants</span>
            <span className="text-muted-foreground"><strong className="font-semibold text-foreground">{completedCount}</strong> graded</span>
            <span className="text-muted-foreground"><strong className="font-semibold text-foreground">{dirtyRowIds.size}</strong> unsaved rows</span>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 border-y border-border py-2.5">
          <div className="flex h-8 w-full max-w-[240px] items-center gap-2 rounded border border-input bg-background px-2.5 focus-within:ring-1 focus-within:ring-ring">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, userId, phone" aria-label="Search name, userId, or phone" className="h-full border-0 p-0 text-xs shadow-none focus-visible:ring-0" />
          </div>
          <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Filter className="size-3.5" /> Filters</div>
          {filterSelect("batch", batchFilter, uniqueOptions("batchName"), setBatchFilter)}
          {filterSelect("division", filters.Division, uniqueOptions("Division"), (value) => setFilters((current) => ({ ...current, Division: value })))}
          {filterSelect("district", filters.District, uniqueOptions("District"), (value) => setFilters((current) => ({ ...current, District: value })))}
          {filterSelect("taluka", filters.Taluka, uniqueOptions("Taluka"), (value) => setFilters((current) => ({ ...current, Taluka: value })))}
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setDiscardOpen(true)} disabled={!dirtyRowIds.size} title="Discard unsaved edits"><RotateCcw /><span className="hidden md:inline">Discard</span></Button>
            <Button size="sm" onClick={saveChanges} disabled={!dirtyRowIds.size}><Save /><span>Save changes</span></Button>
            <Button variant="outline" size="sm" onClick={exportWorkbook} title="Export the visible rows to Excel"><Download /><span className="hidden md:inline">Excel</span></Button>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3" aria-label="Participant assessment status">
            <LegendDot label="Untouched" className="bg-muted-foreground/35" />
            <LegendDot label="Incomplete" className="bg-chart-4" />
            <LegendDot label="Absent" className="bg-chart-3" />
            <LegendDot label="Completed" className="bg-primary" />
            <LegendDot label="Unsaved" className="bg-destructive" />
          </div>
          <span className="flex items-center gap-1.5"><FileSpreadsheet className="size-3.5" /> Excel includes current filters{dirtyRowIds.size ? " and unsaved edits" : ""}</span>
        </div>

        <div className="sheet-frame relative max-h-[calc(100vh-250px)] min-h-[400px] overflow-auto border border-border bg-background" aria-label="Participant grading spreadsheet">
          {loading ? (
            <div className="flex min-h-[400px] items-center justify-center gap-2 text-sm text-muted-foreground"><span className="size-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />Loading demo participant data…</div>
          ) : participants.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><Users className="size-6" />No demo participants are available.</div>
          ) : filteredRows.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><Search className="size-6" />No participants match these filters.</div>
          ) : (
            <table className="grading-sheet w-max min-w-full border-separate border-spacing-0 text-left text-xs">
              <colgroup>{COLUMN_ORDER.map((column, index) => <col key={column} style={{ width: columnWidth(column, index) }} />)}</colgroup>
              <thead>
                <tr className="group-header-row">
                  {COLUMN_GROUPS.map((group) => <th key={group.name} colSpan={group.columns.length} scope="colgroup" className="group-header-cell border-b border-r border-border bg-muted px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground">{group.name}</th>)}
                </tr>
                <tr className="column-header-row">
                  {COLUMN_ORDER.map((column, index) => (
                    <th key={column} scope="col" title={column} className={`${frozenClasses(index, true)} border-b border-r border-border bg-card px-2 py-2 align-bottom`}>
                      <Button variant="ghost" size="sm" className="h-auto min-h-7 w-full justify-start whitespace-normal px-0 py-0 text-left text-[10px] font-semibold leading-tight text-foreground hover:bg-transparent" onClick={() => setSort((current) => current?.field === column ? { field: column, direction: current.direction === "asc" ? "desc" : "asc" } : { field: column, direction: "asc" })} aria-label={`Sort by ${column}`}>
                        <span>{column}</span>
                        <span className="ml-auto shrink-0 text-muted-foreground">{sort?.field === column ? sort.direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}</span>
                      </Button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((participant, rowIndex) => {
                  const graded = gradeParticipant(participant);
                  const status = participantStatus(participant, graded, dirtyRowIds.has(participant.id));
                  return (
                    <tr key={participant.id} className={`group border-b border-border ${dirtyRowIds.has(participant.id) ? "bg-accent/45" : rowIndex % 2 === 0 ? "bg-background" : "bg-muted/25"}`}>
                      {COLUMN_ORDER.map((column, index) => {
                        if (column === "Sr no.") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-2 py-1 text-center tabular-nums text-muted-foreground`}><span className="inline-flex items-center gap-1" title={status.label}><span className={`size-1.5 rounded-full ${status.dot}`} />{participant["Sr no."]}</span></td>;
                        if (column === "Name") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-2 py-1`}><div className="max-w-[160px] truncate font-medium" title={participant.Name}>{participant.Name}</div><div className={`text-[9px] ${status.text}`}>{status.label}{dirtyRowIds.has(participant.id) ? " · Unsaved" : ""}</div></td>;
                        if (DIMENSION_FIELDS.includes(column as DimensionField)) {
                          const field = column as DimensionField;
                          const error = errors[`${participant.id}::${field}`];
                          return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-1.5 py-1 align-top`}>
                            <Input id={cellId(participant.id, index)} aria-label={`${participant.Name}, ${field}`} aria-invalid={Boolean(error)} title={field} value={participant[field]} placeholder="·" onChange={(event) => handleCellValue(participant.id, field, event.target.value)} onPaste={(event) => { const text = event.clipboardData.getData("text"); if (pasteGrid(participant.id, field, text)) event.preventDefault(); }} onKeyDown={(event) => handleGridKey(event, filteredRows, rowIndex, field)} className={`h-6 w-full min-w-12 rounded-sm px-1 text-center text-xs tabular-nums shadow-none ${error ? "border-destructive ring-1 ring-destructive" : "border-transparent bg-muted/45 focus-visible:border-ring"}`} />
                            {error && <span className="mt-1 block min-w-28 text-[9px] leading-tight text-destructive" role="alert">{error}</span>}
                          </td>;
                        }
                        if (column === "Score") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border bg-muted/30 px-2 py-1 text-center font-semibold tabular-nums`}>{graded.Score === "" ? <span className="text-muted-foreground">—</span> : graded.Score}</td>;
                        if (column === "Internal Grade") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border bg-muted/30 px-2 py-1 text-center`}><GradeBadge grade={graded["Internal Grade"]} /></td>;
                        if (column === "Recommendation") {
                          const error = errors[`${participant.id}::Recommendation`];
                          return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-1.5 py-1 align-top`}>
                            <Select value={participant.Recommendation || "__blank__"} onValueChange={(value) => handleCellValue(participant.id, "Recommendation", value === "__blank__" ? "" : value)}>
                              <SelectTrigger id={cellId(participant.id, index)} aria-label={`${participant.Name}, Recommendation`} aria-invalid={Boolean(error)} onKeyDown={(event) => handleGridKey(event, filteredRows, rowIndex, "Recommendation")} className={`h-6 w-[158px] rounded-sm px-1.5 text-[10px] shadow-none ${error ? "border-destructive" : "border-transparent bg-muted/45"}`}><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="__blank__">—</SelectItem><SelectItem value="Recommended as MT">Recommended as MT</SelectItem><SelectItem value="Not Recommended as MT">Not Recommended as MT</SelectItem></SelectContent>
                            </Select>
                            {error && <span className="mt-1 block text-[9px] text-destructive" role="alert">{error}</span>}
                          </td>;
                        }
                        if (column === "Comments") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-1.5 py-1`}>
                          <Button id={cellId(participant.id, index)} variant="ghost" size="sm" title={participant.Comments || "Add comments"} aria-label={`${participant.Name}, Comments`} onClick={() => openNotes(participant)} onPaste={(event) => { const text = event.clipboardData.getData("text"); if (pasteGrid(participant.id, "Comments", text)) event.preventDefault(); }} onKeyDown={(event) => handleGridKey(event, filteredRows, rowIndex, "Comments")} className="h-6 w-full min-w-44 justify-start gap-1.5 overflow-hidden rounded-sm px-1.5 text-[10px] font-normal">
                            <MessageSquareText className="size-3 shrink-0 text-muted-foreground" /><span className="truncate text-muted-foreground">{participant.Comments || "Add comment…"}</span>
                          </Button>
                        </td>;
                        const value = participant[column as keyof Participant];
                        return <td key={column} className={`${frozenClasses(index, false)} max-w-44 truncate border-b border-r border-border px-2 py-1 text-muted-foreground`} title={String(value ?? "")}>{value || "—"}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <p>{feedback || (dirtyRowIds.size ? `${dirtyRowIds.size} row${dirtyRowIds.size === 1 ? "" : "s"} have unsaved edits.` : `Showing ${filteredRows.length} participants · all rows are demo data.`)}</p>
          <p>Grade ranges: A 24–30 · B 15–23 · C 10–14 · D 0–9 <span className="ml-1 font-medium text-chart-3">Business confirmation required</span></p>
        </div>
      </section>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-xl rounded-md">
          <DialogHeader>
            <DialogTitle>Participant comments</DialogTitle>
            <DialogDescription>{noteTarget?.Name} <span className="mx-1">·</span> {noteTarget?.userId}</DialogDescription>
          </DialogHeader>
          <Textarea autoFocus rows={9} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add assessment observations or follow-up notes…" aria-label="Participant comments" className="min-h-52 resize-y text-sm" />
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={applyNotes}>Apply comments</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>This will return edited grading fields to their last saved values. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={discardChanges} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Discard changes</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Leave with unsaved edits?</AlertDialogTitle><AlertDialogDescription>Your unsaved edits will not be stored in Demo storage if you sign out now.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep grading</AlertDialogCancel><AlertDialogAction onClick={() => { window.sessionStorage.removeItem("zilla-t3-demo-auth"); setConfirmLogout(false); setLoginStep("phone"); }}>Sign out</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function LoginScreen({ step, phone, otp, setPhone, setOtp, onContinue, onBack, onVerify }: {
  step: "phone" | "otp";
  phone: string;
  otp: string;
  setPhone: (value: string) => void;
  setOtp: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onVerify: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center gap-3 border-b border-border px-5 lg:px-8">
        <div className="flex size-8 items-center justify-center rounded bg-primary text-primary-foreground"><Award className="size-4" /></div>
        <span className="text-sm font-semibold">Zilla <span className="font-normal text-muted-foreground">/</span> T3 Master Trainer Grading</span>
        <span className="ml-auto rounded border border-accent-foreground/15 bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">DEMO</span>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form className="w-full max-w-[360px]" onSubmit={(event) => {
          event.preventDefault();
          if (step === "phone") {
            if (!phone.trim()) { setError("Enter any mobile number to continue."); return; }
            setError(""); onContinue();
          } else {
            if (!otp.trim()) { setError("Enter any code to continue."); return; }
            setError(""); onVerify();
          }
        }}>
          <div className="mb-7 flex size-12 items-center justify-center rounded-md border border-border bg-accent text-primary"><Award className="size-6" /></div>
          {step === "phone" ? <>
            <p className="mb-2 text-[10px] font-semibold uppercase text-primary">Five-day T3 program</p>
            <h1 className="text-2xl font-semibold">Grader sign in</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Enter your mobile number to open the Master Trainer assessment register.</p>
            <label htmlFor="demo-phone" className="mb-1.5 mt-7 block text-xs font-medium">Mobile number</label>
            <Input id="demo-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. 98765 43210" value={phone} onChange={(event) => setPhone(event.target.value)} className="h-10" />
            <Button type="submit" className="mt-4 w-full">Continue</Button>
          </> : <>
            <Button type="button" variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2 text-muted-foreground"><ChevronLeft />Change number</Button>
            <p className="mb-2 text-[10px] font-semibold uppercase text-primary">Demo verification</p>
            <h1 className="text-2xl font-semibold">Enter one-time code</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Code step for <span className="font-medium text-foreground">{phone}</span>. This demo accepts any code.</p>
            <label htmlFor="demo-otp" className="mb-1.5 mt-7 block text-xs font-medium">One-time code</label>
            <Input id="demo-otp" inputMode="numeric" autoComplete="one-time-code" placeholder="Any code" value={otp} onChange={(event) => setOtp(event.target.value)} className="h-10" />
            <Button type="submit" className="mt-4 w-full">Open grading workspace</Button>
          </>}
          {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
          <div className="mt-7 flex gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-chart-3" /><p><strong className="font-semibold text-foreground">Demo authentication · not secure.</strong> Any mobile number and any code are accepted. No code is sent or verified.</p></div>
        </form>
      </div>
      <footer className="border-t border-border px-5 py-3 text-center text-[10px] text-muted-foreground">ZILLAP2IT Illumine trainers <span className="mx-1">·</span> Internal prototype</footer>
    </main>
  );
}

function LegendDot({ label, className }: { label: string; className: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${className}`} />{label}</span>;
}

function GradeBadge({ grade }: { grade: GradedParticipant["Internal Grade"] }) {
  if (!grade) return <span className="text-muted-foreground">—</span>;
  const style = grade === "Absent" ? "border-chart-3/30 bg-chart-3/10 text-chart-3" : grade === "A" ? "border-primary/25 bg-primary/10 text-primary" : grade === "D" ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-border bg-muted text-foreground";
  return <span className={`inline-flex min-w-9 justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${style}`}>{grade}</span>;
}

function participantStatus(participant: Participant, graded: GradedParticipant, dirty: boolean) {
  const dimensions = DIMENSION_FIELDS.map((field) => participant[field]);
  if (dirty) return { label: "Unsaved", dot: "bg-destructive", text: "text-destructive" };
  if (graded["Internal Grade"] === "Absent") return { label: "Absent", dot: "bg-chart-3", text: "text-chart-3" };
  if (graded["Internal Grade"] !== "") return { label: "Completed", dot: "bg-primary", text: "text-primary" };
  if (dimensions.every((value) => value === "") && !participant.Recommendation && !participant.Comments) return { label: "Untouched", dot: "bg-muted-foreground/35", text: "text-muted-foreground" };
  return { label: "Incomplete", dot: "bg-chart-4", text: "text-chart-4" };
}

function columnWidth(column: string, index: number) {
  if (index === 0) return 58;
  if (column === "userId") return 105;
  if (column === "Name") return 174;
  if (column === "email") return 210;
  if (column === "phone") return 130;
  if (column === "Department" || column === "Designation" || column.startsWith("Cognitive") || column.startsWith("Program") || column.startsWith("MT Assessment")) return 142;
  if (DIMENSION_FIELDS.includes(column as DimensionField)) return column.length > 32 ? 172 : 142;
  if (column === "Recommendation") return 170;
  if (column === "Comments") return 190;
  if (column === "batchName") return 172;
  return 112;
}

function frozenClasses(index: number, header: boolean) {
  if (index !== 2) return "";
  return `sticky left-0 ${header ? "z-50" : "z-20"} bg-inherit`;
}

function cellId(id: string, columnIndex: number) {
  return `cell-${id}-${columnIndex}`;
}

function handleGridKey(
  event: ReactKeyboardEvent<HTMLInputElement | HTMLButtonElement>,
  rows: Participant[],
  rowIndex: number,
  field: EditableField,
) {
  if (event.key === "Enter") {
    event.preventDefault();
    event.currentTarget.blur();
    return;
  }
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  const nextIndex = rowIndex + (event.key === "ArrowDown" ? 1 : -1);
  const nextRow = rows[nextIndex];
  if (!nextRow) return;
  event.preventDefault();
  document.getElementById(cellId(nextRow.id, fieldColumnIndex(field)))?.focus();
}
