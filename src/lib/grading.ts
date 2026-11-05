export const DIMENSION_FIELDS = [
  "Clarity of Ideas",
  "Ability to involve the class and listen to participation",
  "Appreciation of the goal of the program",
  "In class participation",
  "Inner Confidence",
  "Appreciation and willingness to follow process",
] as const;

export type DimensionField = (typeof DIMENSION_FIELDS)[number];
export type DimensionValue = "" | "-" | "0" | "1" | "2" | "3" | "4" | "5";
export type Recommendation = "" | "Recommended as MT" | "Not Recommended as MT";

export const GRADE_THRESHOLDS = {
  A: { min: 24, max: 30 },
  B: { min: 15, max: 23 },
  C: { min: 10, max: 14 },
  D: { min: 0, max: 9 },
} as const;

export const COLUMN_GROUPS = [
  { name: "Participant", columns: ["Sr no.", "userId", "Name", "email", "phone"] },
  { name: "Geography", columns: ["Division", "District", "Taluka", "Department", "Designation"] },
  { name: "Batch", columns: ["Coach 1", "Coach 2", "batchId", "batchName", "batchDate"] },
  {
    name: "Assessments",
    columns: ["Program Assessment 1", "Program Assessment 2", "MT Assessment 1", "MT Assessment 2", "Cognitive Pre", "Cognitive Post"],
  },
  { name: "Dimensions", columns: [...DIMENSION_FIELDS] },
  { name: "Grading", columns: ["Score", "Internal Grade", "Recommendation", "Comments"] },
] as const;

export const COLUMN_ORDER = COLUMN_GROUPS.flatMap((group) => [...group.columns]);

export type Participant = {
  id: string;
  "Sr no.": number;
  userId: string;
  Name: string;
  email: string;
  phone: string;
  Division: string;
  District: string;
  Taluka: string;
  Department: string;
  Designation: string;
  "Coach 1": string;
  "Coach 2": string;
  batchId: string;
  batchName: string;
  batchDate: string;
  "Program Assessment 1": string;
  "Program Assessment 2": string;
  "MT Assessment 1": string;
  "MT Assessment 2": string;
  "Cognitive Pre": string;
  "Cognitive Post": string;
  "Clarity of Ideas": DimensionValue;
  "Ability to involve the class and listen to participation": DimensionValue;
  "Appreciation of the goal of the program": DimensionValue;
  "In class participation": DimensionValue;
  "Inner Confidence": DimensionValue;
  "Appreciation and willingness to follow process": DimensionValue;
  Recommendation: Recommendation;
  Comments: string;
};

export type GradedParticipant = Participant & {
  Score: number | "";
  "Internal Grade": "A" | "B" | "C" | "D" | "Absent" | "";
};

export type EditableField = DimensionField | "Recommendation" | "Comments";

export const EDITABLE_FIELDS: readonly EditableField[] = [
  ...DIMENSION_FIELDS,
  "Recommendation",
  "Comments",
];

export const isDimensionValue = (value: string): value is DimensionValue =>
  value === "" || value === "-" || /^[0-5]$/.test(value);

export function gradeParticipant(participant: Participant): GradedParticipant {
  const values = DIMENSION_FIELDS.map((field) => participant[field]);
  if (values.includes("-")) {
    return { ...participant, Score: "", "Internal Grade": "Absent" };
  }
  if (values.some((value) => value === "")) {
    return { ...participant, Score: "", "Internal Grade": "" };
  }

  const score = values.reduce((total, value) => total + Number(value), 0);
  const grade = Object.entries(GRADE_THRESHOLDS).find(
    ([, range]) => score >= range.min && score <= range.max,
  )?.[0] as "A" | "B" | "C" | "D" | undefined;

  return { ...participant, Score: score, "Internal Grade": grade ?? "" };
}

export function createDemoParticipants(): Participant[] {
  const seedRows = [
    { name: "Anita Deshmukh", userId: "MT-24031", division: "Pune", district: "Satara", taluka: "Karad", batch: "T3 Pune · May 2026", dimensions: ["", "", "", "", "", ""] },
    { name: "Rahul Patil", userId: "MT-24032", division: "Pune", district: "Pune", taluka: "Haveli", batch: "T3 Pune · May 2026", dimensions: ["0", "0", "0", "0", "0", "0"] },
    { name: "Meera Kulkarni", userId: "MT-24033", division: "Konkan", district: "Ratnagiri", taluka: "Chiplun", batch: "T3 Konkan · Jun 2026", dimensions: ["5", "5", "5", "5", "4", "5"] },
    { name: "Sanjay Jadhav", userId: "MT-24034", division: "Nashik", district: "Nashik", taluka: "Sinnar", batch: "T3 Nashik · Jun 2026", dimensions: ["4", "4", "4", "4", "3", "3"] },
    { name: "Farida Shaikh", userId: "MT-24035", division: "Aurangabad", district: "Jalna", taluka: "Ambad", batch: "T3 Marathwada · Jul 2026", dimensions: ["2", "2", "2", "2", "1", "1"] },
    { name: "Vikram Shinde", userId: "MT-24036", division: "Pune", district: "Kolhapur", taluka: "Karveer", batch: "T3 Pune · May 2026", dimensions: ["1", "1", "1", "1", "1", "2"] },
    { name: "Pooja More", userId: "MT-24037", division: "Amravati", district: "Amravati", taluka: "Achalpur", batch: "T3 Vidarbha · Jul 2026", dimensions: ["-", "", "", "", "", ""] },
  ] as const;

  return seedRows.map((row, index) => ({
    id: row.userId,
    "Sr no.": index + 1,
    userId: row.userId,
    Name: row.name,
    email: `${row.name.toLowerCase().replaceAll(" ", ".")}@example.demo`,
    phone: `+91 98${String(24000000 + index * 173).slice(0, 8)}`,
    Division: row.division,
    District: row.district,
    Taluka: row.taluka,
    Department: index % 2 === 0 ? "School Education" : "Public Health",
    Designation: index % 2 === 0 ? "Cluster Coordinator" : "Block Resource Person",
    "Coach 1": index % 2 === 0 ? "Neha Joshi" : "Amit Desai",
    "Coach 2": index % 2 === 0 ? "Rohan Kale" : "Sonal Pawar",
    batchId: `T3-2026-${String(index % 3 + 1).padStart(2, "0")}`,
    batchName: row.batch,
    batchDate: `2026-0${5 + (index % 3)}-${String(12 + index).padStart(2, "0")}`,
    "Program Assessment 1": `${72 + index * 2}%`,
    "Program Assessment 2": `${76 + index * 2}%`,
    "MT Assessment 1": `${70 + index * 3}%`,
    "MT Assessment 2": `${74 + index * 3}%`,
    "Cognitive Pre": `${54 + index * 3}%`,
    "Cognitive Post": `${68 + index * 3}%`,
    "Clarity of Ideas": row.dimensions[0] as DimensionValue,
    "Ability to involve the class and listen to participation": row.dimensions[1] as DimensionValue,
    "Appreciation of the goal of the program": row.dimensions[2] as DimensionValue,
    "In class participation": row.dimensions[3] as DimensionValue,
    "Inner Confidence": row.dimensions[4] as DimensionValue,
    "Appreciation and willingness to follow process": row.dimensions[5] as DimensionValue,
    Recommendation: "" as Recommendation,
    Comments: "",
  }));
}

export const fieldColumnIndex = (field: EditableField) => COLUMN_ORDER.indexOf(field);