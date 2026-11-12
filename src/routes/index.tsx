import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Layers3,
  LogOut,
  MessageSquareText,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";

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
  gradeDistribution,
  gradeParticipant,
  GRADES,
  isDimensionValue,
  type DimensionField,
  type EditableField,
  type Grade,
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

const AUTOSAVE_NOTICE = "Edits autosave here, even if you close the tab";
const NO_FILTER = "__all__";
const ASSESSMENT_STATUSES = ["Graded", "Ungraded", "Absent"] as const;
const PAGE_SIZE = 50;

type SortConfig = { field: string; direction: "asc" | "desc" } | null;
type Filters = { District: string; Taluka: string };

function Index() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loginStep, setLoginStep] = useState<"phone" | "otp" | "batch" | "workspace">("phone");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const participantsRef = useRef<Participant[]>([]);
  const providerRef = useRef<ReturnType<typeof createGradingDataProvider> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({ District: NO_FILTER, Taluka: NO_FILTER });
  const [assessmentStatus, setAssessmentStatus] = useState<string>(NO_FILTER);
  const [sort, setSort] = useState<SortConfig>(null);
  const [page, setPage] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [noteTarget, setNoteTarget] = useState<Participant | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const isAuthenticated = loginStep === "batch" || loginStep === "workspace";

  useEffect(() => {
    const authenticated = window.sessionStorage.getItem("zilla-t3-demo-auth") === "yes";
    if (authenticated) setLoginStep("batch");
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    setLoading(true);
    const provider = createGradingDataProvider(window.localStorage);
    providerRef.current = provider;
    provider.loadParticipants().then((loaded) => {
      if (!active) return;
      setParticipants(loaded);
      participantsRef.current = loaded;
      setLoading(false);
    }).catch(() => {
      if (active) {
        setParticipants([]);
        setLoading(false);
        setFeedback("Demo rows could not be loaded from this browser.");
      }
    });
    return () => { active = false; };
  }, [isAuthenticated]);

  const batches = useMemo(() => [...new Set(participants.map((row) => row.batchId))].map((id) => {
    const rows = participants.filter((row) => row.batchId === id);
    return { id, name: rows[0]?.batchName ?? id, rows };
  }), [participants]);
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);
  const batchRows = useMemo(() => participants.filter((row) => row.batchId === selectedBatchId), [participants, selectedBatchId]);
  const distribution = gradeDistribution(batchRows);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = batchRows.filter((row) => {
      const matchesSearch = !term || [row.Name, row.userId, row.phone].some((value) => value.toLowerCase().includes(term));
      const matchesGeography = (Object.keys(filters) as (keyof Filters)[]).every((key) => filters[key] === NO_FILTER || row[key] === filters[key]);
      const matchesStatus = assessmentStatus === NO_FILTER || participantStatus(row).label === assessmentStatus;
      return matchesSearch && matchesGeography && matchesStatus;
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
  }, [assessmentStatus, batchRows, filters, search, sort]);

  useEffect(() => { setPage(1); }, [assessmentStatus, filters, search, selectedBatchId]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const persistParticipants = useCallback((next: Participant[]) => {
    participantsRef.current = next;
    setParticipants(next);
    setFeedback("");
    const provider = providerRef.current;
    if (!provider) { setFeedback("Autosave is unavailable. Your change is only on screen."); return; }
    void provider.saveDrafts(next.map(toAssessmentDraft)).catch(() => {
      setFeedback("Autosave failed. Your change is only on screen; please try again.");
    });
  }, []);

  const updateField = useCallback((id: string, field: EditableField, value: string) => {
    persistParticipants(participantsRef.current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setErrors((current) => {
      const next = { ...current };
      delete next[`${id}::${field}`];
      return next;
    });
  }, [persistParticipants]);

  const handleCellValue = useCallback((id: string, field: EditableField, rawValue: string) => {
    const valid = field === "Participation Status" ? rawValue === "Present" || rawValue === "Absent"
      : field === "Recommendation" ? rawValue === "" || rawValue === "Recommended as MT" || rawValue === "Not Recommended as MT"
      : field === "Comments" || isDimensionValue(rawValue);
    if (!valid) {
      setErrors((current) => ({ ...current, [`${id}::${field}`]: field === "Participation Status" ? "Choose Present or Absent." : field === "Recommendation" ? "Choose one of the listed options." : "Enter a whole number from 0–5, or – for absent." }));
      return;
    }
    updateField(id, field, rawValue);
  }, [updateField]);

  const pasteGrid = useCallback((startRowId: string, startField: EditableField, text: string) => {
    const grid = text.replace(/\r/g, "").split("\n").map((line) => line.split("\t"));
    if (grid.length === 1 && grid[0]?.length === 1) return false;
    const startRowIndex = visibleRows.findIndex((row) => row.id === startRowId);
    const startColumnIndex = fieldColumnIndex(startField);
    let accepted = 0;
    let invalid = 0;
    const invalidCells: Record<string, string> = {};
    const updates: { id: string; field: EditableField; value: string }[] = [];

    grid.forEach((line, rowOffset) => {
      const row = visibleRows[startRowIndex + rowOffset];
      if (!row) return;
      line.forEach((raw, colOffset) => {
        const fieldName = COLUMN_ORDER[startColumnIndex + colOffset];
        if (!fieldName || !EDITABLE_FIELDS.includes(fieldName as EditableField)) return;
        const field = fieldName as EditableField;
        const value = raw.trim();
        const valid = field === "Participation Status" ? value === "Present" || value === "Absent"
          : field === "Recommendation"
          ? value === "" || value === "Recommended as MT" || value === "Not Recommended as MT"
          : field === "Comments" || isDimensionValue(value);
        if (!valid) {
          invalid += 1;
          invalidCells[`${row.id}::${field}`] = field === "Participation Status" ? "Choose Present or Absent." : field === "Recommendation" ? "Choose one of the listed options." : "Enter a whole number from 0–5, or – for absent.";
          return;
        }
        accepted += 1;
        updates.push({ id: row.id, field, value });
      });
    });

    const next = participantsRef.current.map((row) => {
      const values = updates.filter((update) => update.id === row.id);
      return values.reduce((next, update) => ({ ...next, [update.field]: update.value }), row);
    });
    if (updates.length) persistParticipants(next);
    setErrors((current) => {
      const next = { ...current };
      updates.forEach(({ id, field }) => delete next[`${id}::${field}`]);
      return { ...next, ...invalidCells };
    });
    setFeedback(`${accepted} pasted ${accepted === 1 ? "value" : "values"}${invalid ? ` · ${invalid} invalid ${invalid === 1 ? "cell" : "cells"} flagged` : ""}`);
    return true;
  }, [persistParticipants, visibleRows]);

  const openNotes = (participant: Participant) => {
    setNoteTarget(participant);
    setNoteDraft(participant.Comments);
    setNoteOpen(true);
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
      setFeedback(`Excel downloaded · ${filteredRows.length} filtered rows`);
    } catch {
      setFeedback("The Excel file could not be created. Your edits remain on screen.");
    }
  };

  const requestLogout = () => {
    window.sessionStorage.removeItem("zilla-t3-demo-auth");
    setSelectedBatchId(null);
    setLoginStep("phone");
  };

  const requestBatchChange = () => setLoginStep("batch");

  if (!sessionReady || !isAuthenticated) {
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
          setLoginStep("batch");
        }}
      />
    );
  }

  if (loginStep === "batch" || !selectedBatch) {
    return <BatchSelectionScreen batches={batches} loading={loading} onSelect={(id) => {
      setSelectedBatchId(id);
      setSearch("");
      setFilters({ District: NO_FILTER, Taluka: NO_FILTER });
      setAssessmentStatus(NO_FILTER);
      setSort(null);
      setLoginStep("workspace");
    }} onSignOut={requestLogout} />;
  }

  const uniqueOptions = (field: keyof Filters) => [...new Set(batchRows.map((row) => row[field]).filter(Boolean))].sort();
  const filterSelect = (label: string, value: string, options: readonly string[], onValueChange: (value: string) => void, allLabel = `All ${label}`) => (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label} className={`h-9 rounded-md border-border bg-background text-xs ${label === "Assessment status" ? "w-[160px]" : "w-[132px]"}`}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_FILTER}>{allLabel}</SelectItem>
        {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <main className="min-h-screen overflow-hidden bg-slate-50/70 text-foreground">
      <header className="border-b border-border bg-card">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-2 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/illumine-logo.png" alt="Illumine" className="h-10 w-auto shrink-0 object-contain" />
            <h1 className="text-sm font-semibold">Zilla T3 Master Trainer Grading</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 border-r border-border pr-3 text-[11px] text-emerald-700 sm:inline-flex"><span className="size-1.5 rounded-full bg-emerald-500" />{AUTOSAVE_NOTICE}</span>
            <Button variant="outline" size="sm" onClick={requestBatchChange}><Layers3 className="size-3.5" />Change batch</Button>
            <Button variant="ghost" size="icon" aria-label="Sign out of demo" title="Sign out of demo" onClick={requestLogout}><LogOut /></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1720px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Batch Info</h2>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-xs">
              {([
                ["Batch Name", selectedBatch.name],
                ["Batch Date", selectedBatch.rows[0]?.batchDate ?? "—"],
                ["Total MTs", distribution.total],
                ["Graded MTs", distribution.graded],
                ["Ungraded MTs", distribution.ungraded],
                ["Absent MTs", distribution.absent],
              ] as const).map(([label, value]) => <div key={label} className="col-span-2 grid grid-cols-subgrid border-b border-slate-100 py-0.5 last:border-0"><span className="text-muted-foreground">{label}</span><strong className="text-right font-semibold tabular-nums">{value}</strong></div>)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <div className="mb-3 flex items-baseline gap-2"><h2 className="text-sm font-semibold">Batch Performance</h2><span className="text-[11px] text-muted-foreground">(percent of graded MTs)</span></div>
            <GradeDistribution rows={batchRows} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold"><Filter className="size-4 text-sky-700" />Find Master trainers <span className="ml-auto text-[11px] font-normal text-muted-foreground">{filteredRows.length} of {batchRows.length} shown</span></div>
          <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-full max-w-[260px] items-center gap-2 rounded-md border border-input bg-background px-2.5 focus-within:ring-1 focus-within:ring-ring">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, userId, phone" aria-label="Search name, userId, or phone" className="h-full border-0 p-0 text-xs shadow-none focus-visible:ring-0" />
          </div>
          {filterSelect("district", filters.District, uniqueOptions("District"), (value) => setFilters((current) => ({ ...current, District: value })))}
          {filterSelect("taluka", filters.Taluka, uniqueOptions("Taluka"), (value) => setFilters((current) => ({ ...current, Taluka: value })))}
          {filterSelect("Assessment status", assessmentStatus, ASSESSMENT_STATUSES, setAssessmentStatus, "All statuses")}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={exportWorkbook} title="Export the visible rows to Excel"><Download /><span className="hidden md:inline">Excel</span></Button>
          </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div><h3 className="text-sm font-semibold">Master Trainer register</h3><p className="mt-0.5 text-[11px] text-muted-foreground">Up to 50 trainers per page. Scroll horizontally to grade; the first three columns stay in place.</p></div>
          <div className="flex flex-wrap items-center gap-2" aria-label="Participant assessment status">
            <LegendDot label="Graded" className="bg-emerald-600" />
            <LegendDot label="Ungraded" className="bg-rose-600" />
            <LegendDot label="Absent" className="bg-slate-500" />
          </div>
        </div>

        <div className="sheet-frame relative max-h-[620px] min-h-[440px] overflow-auto bg-background" aria-label="Participant grading spreadsheet">
          {loading ? (
            <div className="flex min-h-[400px] items-center justify-center gap-2 text-sm text-muted-foreground"><span className="size-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />Loading demo participant data…</div>
          ) : batchRows.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><Users className="size-6" />No demo participants are available.</div>
          ) : filteredRows.length === 0 ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><Search className="size-6" />No participants match these filters.</div>
          ) : (
            <table className="grading-sheet table-fixed border-separate border-spacing-0 text-left text-xs" style={{ width: COLUMN_ORDER.reduce((total, column, index) => total + columnWidth(column, index), 0) }}>
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
                {visibleRows.map((participant, rowIndex) => {
                  const graded = gradeParticipant(participant);
                  const status = participantStatus(participant);
                  return (
                    <tr key={participant.id} className={`group border-b border-border ${rowIndex % 2 === 0 ? "bg-background" : "bg-muted/25"}`}>
                      {COLUMN_ORDER.map((column, index) => {
                        if (column === "Sr no.") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-2 py-1 text-center tabular-nums text-muted-foreground`}><span className="inline-flex items-center gap-1" title={status.label}><span className={`size-1.5 rounded-full ${status.dot}`} />{participant["Sr no."]}</span></td>;
                        if (column === "Name") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-2 py-1`}><div className="max-w-[160px] truncate font-medium" title={participant.Name}>{participant.Name}</div><div className={`text-[9px] ${status.text}`}>{status.label}</div></td>;
                        if (DIMENSION_FIELDS.includes(column as DimensionField)) {
                          const field = column as DimensionField;
                          const error = errors[`${participant.id}::${field}`];
                          return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-1.5 py-1 align-top`}>
                            <Input id={cellId(participant.id, index)} aria-label={`${participant.Name}, ${field}`} aria-invalid={Boolean(error)} title={field} value={participant[field]} placeholder="·" onChange={(event) => handleCellValue(participant.id, field, event.target.value)} onPaste={(event) => { const text = event.clipboardData.getData("text"); if (pasteGrid(participant.id, field, text)) event.preventDefault(); }} onKeyDown={(event) => handleGridKey(event, visibleRows, rowIndex, field)} className={`h-6 w-full min-w-12 rounded-sm px-1 text-center text-xs tabular-nums shadow-none ${error ? "border-destructive ring-1 ring-destructive" : "border-transparent bg-muted/45 focus-visible:border-ring"}`} />
                            {error && <span className="mt-1 block min-w-28 text-[9px] leading-tight text-destructive" role="alert">{error}</span>}
                          </td>;
                        }
                        if (column === "Score") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border bg-muted/30 px-2 py-1 text-center font-semibold tabular-nums`}>{graded.Score === "" ? <span className="text-muted-foreground">—</span> : graded.Score}</td>;
                        if (column === "Participation Status") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-1.5 py-1`}>
                          <Select value={participant["Participation Status"]} onValueChange={(value) => handleCellValue(participant.id, "Participation Status", value)}>
                            <SelectTrigger id={cellId(participant.id, index)} aria-label={`${participant.Name}, Participation Status`} onKeyDown={(event) => handleGridKey(event, visibleRows, rowIndex, "Participation Status")} className="h-6 w-[104px] rounded-sm border-transparent bg-muted/45 px-1.5 text-[10px] shadow-none"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Present">Present</SelectItem><SelectItem value="Absent">Absent</SelectItem></SelectContent>
                          </Select>
                        </td>;
                        if (column === "Internal Grade") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border bg-muted/30 px-2 py-1 text-center`}><GradeBadge grade={graded["Internal Grade"]} /></td>;
                        if (column === "Recommendation") {
                          if (graded.Recommendation === "Absent") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border bg-muted/30 px-2 py-1 text-center text-[10px] font-semibold text-slate-600`}>Absent</td>;
                          const error = errors[`${participant.id}::Recommendation`];
                          return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-1.5 py-1 align-top`}>
                            <Select value={participant.Recommendation || "__blank__"} onValueChange={(value) => handleCellValue(participant.id, "Recommendation", value === "__blank__" ? "" : value)}>
                              <SelectTrigger id={cellId(participant.id, index)} aria-label={`${participant.Name}, Recommendation`} aria-invalid={Boolean(error)} onKeyDown={(event) => handleGridKey(event, visibleRows, rowIndex, "Recommendation")} className={`h-6 w-[158px] rounded-sm px-1.5 text-[10px] shadow-none ${error ? "border-destructive" : "border-transparent bg-muted/45"}`}><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="__blank__">—</SelectItem><SelectItem value="Recommended as MT">Recommended as MT</SelectItem><SelectItem value="Not Recommended as MT">Not Recommended as MT</SelectItem></SelectContent>
                            </Select>
                            {error && <span className="mt-1 block text-[9px] text-destructive" role="alert">{error}</span>}
                          </td>;
                        }
                        if (column === "Comments") return <td key={column} className={`${frozenClasses(index, false)} border-b border-r border-border px-1.5 py-1`}>
                          <Button id={cellId(participant.id, index)} variant="ghost" size="sm" title={participant.Comments || "Add comments"} aria-label={`${participant.Name}, Comments`} onClick={() => openNotes(participant)} onPaste={(event) => { const text = event.clipboardData.getData("text"); if (pasteGrid(participant.id, "Comments", text)) event.preventDefault(); }} onKeyDown={(event) => handleGridKey(event, visibleRows, rowIndex, "Comments")} className="h-6 w-full min-w-44 justify-start gap-1.5 overflow-hidden rounded-sm px-1.5 text-[10px] font-normal">
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          <p>{feedback || `Showing ${filteredRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–${Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of ${filteredRows.length} Master trainers`}</p>
          <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Previous page"><ChevronLeft className="size-3.5" /></Button><span className="min-w-16 text-center">Page {currentPage} of {pageCount}</span><Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} aria-label="Next page"><ChevronRight className="size-3.5" /></Button></div>
          <p className="flex items-center gap-1.5"><FileSpreadsheet className="size-3.5" /> Excel exports filtered rows</p>
        </div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">Demo grade ranges: A 24–30 · B 15–23 · C 10–14 · D 0–9 <span className="font-medium">· Business confirmation required</span></p>
      </section>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-xl rounded-md">
          <DialogHeader>
            <DialogTitle>Master Trainer comments</DialogTitle>
            <DialogDescription>{noteTarget?.Name} <span className="mx-1">·</span> {noteTarget?.userId}</DialogDescription>
          </DialogHeader>
          <Textarea autoFocus rows={9} value={noteDraft} onChange={(event) => { setNoteDraft(event.target.value); if (noteTarget) updateField(noteTarget.id, "Comments", event.target.value); }} placeholder="Add assessment observations or follow-up notes…" aria-label="Participant comments" className="min-h-52 resize-y text-sm" />
          <DialogFooter><span className="mr-auto text-xs text-muted-foreground">Autosaved as you type</span><DialogClose asChild><Button variant="outline">Done</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
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
        <img src="/illumine-logo.png" alt="Illumine" className="h-9 w-auto shrink-0 object-contain" />
        <span className="text-sm font-semibold">Zilla <span className="font-normal text-muted-foreground">/</span> T3 Master Trainer Grading</span>
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
          <img src="/illumine-logo.png" alt="Illumine" className="mb-7 h-14 w-auto object-contain" />
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
            <Button type="submit" className="mt-4 w-full">Choose batch</Button>
          </>}
          {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
          <div className="mt-7 flex gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-chart-3" /><p><strong className="font-semibold text-foreground">Demo authentication · not secure.</strong> Any mobile number and any code are accepted. No code is sent or verified.</p></div>
        </form>
      </div>
      <footer className="border-t border-border px-5 py-3 text-center text-[10px] text-muted-foreground">ZILLAP2IT Illumine trainers <span className="mx-1">·</span> Internal prototype</footer>
    </main>
  );
}

function BatchSelectionScreen({ batches, loading, onSelect, onSignOut }: {
  batches: { id: string; name: string; rows: Participant[] }[];
  loading: boolean;
  onSelect: (id: string) => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  return <main className="min-h-screen bg-background text-foreground">
    <header className="flex min-h-14 items-center gap-3 border-b border-border bg-card px-5 lg:px-8">
      <img src="/illumine-logo.png" alt="Illumine" className="h-9 w-auto shrink-0 object-contain" />
      <span className="text-sm font-semibold">Zilla T3 Master Trainer Grading</span>
      <Button variant="ghost" size="icon" className="ml-auto" aria-label="Sign out of demo" onClick={onSignOut}><LogOut /></Button>
    </header>
    <section className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
      <div className="mb-8 flex size-12 items-center justify-center rounded-md border border-border bg-accent text-primary"><Layers3 className="size-6" /></div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-primary">Assessment workspace</p>
      <h1 className="text-2xl font-semibold">Select a batch</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose the batch you want to grade.</p>
      <div className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
        <label className="mb-2 block text-xs font-semibold">Batch</label>
        {loading ? <p className="text-sm text-muted-foreground">Loading batches…</p> : batches.length === 0 ? <p className="text-sm text-muted-foreground">No batches are available.</p> : <>
          <Select open={open} onOpenChange={setOpen} onValueChange={onSelect}>
            <SelectTrigger aria-label="Select a batch" className="h-11 w-full"><SelectValue placeholder="Select a batch to open its participants" /></SelectTrigger>
            <SelectContent className="w-[min(90vw,580px)]">
              {batches.map((batch) => <SelectItem key={batch.id} value={batch.id} className="py-3 pr-8">
                <div className="min-w-0 space-y-1">
                  <div className="font-semibold">{batch.name}</div>
                  <div className="text-[11px] text-muted-foreground">{batch.rows[0]?.batchDate ?? "—"} · {batch.rows.length} participant{batch.rows.length === 1 ? "" : "s"}</div>
                </div>
              </SelectItem>)}
            </SelectContent>
          </Select>
        </>}
      </div>
      <p className="mt-5 text-[11px] text-muted-foreground">{AUTOSAVE_NOTICE}.</p>
    </section>
  </main>;
}

function GradeDistribution({ rows }: { rows: Participant[] }) {
  const distribution = gradeDistribution(rows);
  return <div className="space-y-2" aria-label={`Grade distribution: ${GRADES.map((grade) => `${grade} ${distribution.percentages[grade]}%`).join(", ")}`}>
    {GRADES.map((grade) => <div key={grade} className="grid grid-cols-[1rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-xs">
      <span className={`font-bold ${GRADE_STYLE[grade].text}`}>{grade}</span>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${GRADE_STYLE[grade].fill}`} style={{ width: `${distribution.percentages[grade]}%` }} /></div>
      <span className={`text-right font-semibold tabular-nums ${GRADE_STYLE[grade].text}`}>{distribution.percentages[grade]}%</span>
    </div>)}
  </div>;
}

function LegendDot({ label, className }: { label: string; className: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"><span className={`size-2.5 rounded-full ${className}`} />{label}</span>;
}

const GRADE_STYLE: Record<Grade, { text: string; fill: string; badge: string }> = {
  A: { text: "text-emerald-700", fill: "bg-emerald-500", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  B: { text: "text-sky-700", fill: "bg-sky-500", badge: "border-sky-200 bg-sky-50 text-sky-700" },
  C: { text: "text-amber-700", fill: "bg-amber-500", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  D: { text: "text-rose-700", fill: "bg-rose-500", badge: "border-rose-200 bg-rose-50 text-rose-700" },
};

function GradeBadge({ grade }: { grade: GradedParticipant["Internal Grade"] }) {
  if (!grade) return <span className="text-muted-foreground">—</span>;
  if (grade === "Absent") return <span className="inline-flex min-w-9 justify-center rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Absent</span>;
  return <span className={`inline-flex min-w-9 justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${GRADE_STYLE[grade].badge}`}>{grade}</span>;
}

function participantStatus(participant: Participant) {
  if (participant["Participation Status"] === "Absent") return { label: "Absent", dot: "bg-slate-500", text: "text-slate-600" };
  if (gradeParticipant(participant)["Internal Grade"] !== "") return { label: "Graded", dot: "bg-emerald-600", text: "text-emerald-700" };
  return { label: "Ungraded", dot: "bg-rose-600", text: "text-rose-700" };
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
  if (column === "Participation Status") return 126;
  if (column === "Comments") return 190;
  if (column === "batchName") return 172;
  return 112;
}

function frozenClasses(index: number, header: boolean) {
  if (index >= 3) return "";
  return header ? "frozen-cell frozen-header" : "frozen-cell";
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
