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
export type ParticipationStatus = "Present" | "Absent";
export const GRADES = ["A", "B", "C", "D"] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_THRESHOLDS = {
  A: { min: 24, max: 30 },
  B: { min: 15, max: 23 },
  C: { min: 10, max: 14 },
  D: { min: 0, max: 9 },
} as const;

export const COLUMN_GROUPS = [
  { name: "Participant", columns: ["Sr no.", "userId", "Name"] },
  { name: "Contact", columns: ["email", "phone"] },
  { name: "Geography", columns: ["Division", "District", "Taluka", "Department", "Designation"] },
  { name: "Batch", columns: ["Coach 1", "Coach 2", "batchId", "batchName", "batchDate"] },
  {
    name: "Assessments",
    columns: ["Program Assessment 1", "Program Assessment 2", "MT Assessment 1", "MT Assessment 2", "Cognitive Pre", "Cognitive Post"],
  },
  { name: "Dimensions", columns: [...DIMENSION_FIELDS] },
  { name: "Grading", columns: ["Score", "Participation Status", "Internal Grade", "Recommendation", "Comments"] },
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
  "Participation Status": ParticipationStatus;
  Recommendation: Recommendation;
  Comments: string;
};

export type GradedParticipant = Omit<Participant, "Recommendation"> & {
  Score: number | "";
  "Internal Grade": Grade | "Absent" | "";
  Recommendation: Recommendation | "Absent";
};

export type EditableField = DimensionField | "Participation Status" | "Recommendation" | "Comments";

export const EDITABLE_FIELDS: readonly EditableField[] = [
  ...DIMENSION_FIELDS,
  "Participation Status",
  "Recommendation",
  "Comments",
];

export const isDimensionValue = (value: string): value is DimensionValue =>
  value === "" || value === "-" || /^[0-5]$/.test(value);

export function gradeParticipant(participant: Participant): GradedParticipant {
  const values = DIMENSION_FIELDS.map((field) => participant[field]);
  if (participant["Participation Status"] === "Absent") {
    return { ...participant, Score: "", "Internal Grade": "Absent", Recommendation: "Absent" };
  }
  if (values.some((value) => value === "" || value === "-")) {
    return { ...participant, Score: "", "Internal Grade": "" };
  }

  const score = values.reduce((total, value) => total + Number(value), 0);
  const grade = Object.entries(GRADE_THRESHOLDS).find(
    ([, range]) => score >= range.min && score <= range.max,
  )?.[0] as Grade | undefined;

  return { ...participant, Score: score, "Internal Grade": grade ?? "" };
}

export function gradeDistribution(participants: Participant[]) {
  const counts: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 };
  let absent = 0;
  for (const participant of participants) {
    if (participant["Participation Status"] === "Absent") {
      absent += 1;
      continue;
    }
    const grade = gradeParticipant(participant)["Internal Grade"];
    if (grade && grade !== "Absent") counts[grade] += 1;
  }
  const graded = GRADES.reduce((total, grade) => total + counts[grade], 0);
  const percentages: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 };
  if (graded) {
    for (const grade of GRADES) percentages[grade] = Math.floor(counts[grade] * 100 / graded);
    const remaining = 100 - GRADES.reduce((total, grade) => total + percentages[grade], 0);
    const byRemainder = [...GRADES].sort((a, b) => (counts[b] * 100 % graded) - (counts[a] * 100 % graded));
    for (const grade of byRemainder.slice(0, remaining)) percentages[grade] += 1;
  }
  return { counts, percentages, graded, absent, ungraded: participants.length - graded - absent, total: participants.length };
}

export function createDemoParticipants(): Participant[] {
  const seedRows: {
    name: string;
    userId: string;
    division: string;
    district: string;
    taluka: string;
    batch: string;
    dimensions: [DimensionValue, DimensionValue, DimensionValue, DimensionValue, DimensionValue, DimensionValue];
    recommendation?: Recommendation;
  }[] = [
    { name: "Anita Deshmukh", userId: "MT-24031", division: "Pune", district: "Satara", taluka: "Karad", batch: "T3 Pune · May 2026", dimensions: ["", "", "", "", "", ""] },
    { name: "Rahul Patil", userId: "MT-24032", division: "Pune", district: "Pune", taluka: "Haveli", batch: "T3 Pune · May 2026", dimensions: ["0", "0", "0", "0", "0", "0"] },
    { name: "Meera Kulkarni", userId: "MT-24033", division: "Konkan", district: "Ratnagiri", taluka: "Chiplun", batch: "T3 Konkan · Jun 2026", dimensions: ["5", "5", "5", "5", "4", "5"] },
    { name: "Sanjay Jadhav", userId: "MT-24034", division: "Nashik", district: "Nashik", taluka: "Sinnar", batch: "T3 Nashik · Jun 2026", dimensions: ["4", "4", "4", "4", "3", "3"] },
    { name: "Farida Shaikh", userId: "MT-24035", division: "Aurangabad", district: "Jalna", taluka: "Ambad", batch: "T3 Marathwada · Jul 2026", dimensions: ["2", "2", "2", "2", "1", "1"] },
    { name: "Vikram Shinde", userId: "MT-24036", division: "Pune", district: "Kolhapur", taluka: "Karveer", batch: "T3 Pune · May 2026", dimensions: ["1", "1", "1", "1", "1", "2"] },
    { name: "Pooja More", userId: "MT-24037", division: "Amravati", district: "Amravati", taluka: "Achalpur", batch: "T3 Vidarbha · Jul 2026", dimensions: ["-", "", "", "", "", ""] },
  ] as const;

  const batchDetails = [
    { name: "T3 Pune · May 2026", division: "Pune", locations: [["Pune", "Haveli"], ["Satara", "Karad"], ["Kolhapur", "Karveer"]], names: ["Priya Pawar", "Nilesh Patil", "Kiran Shinde", "Sneha Kulkarni", "Mahesh Jadhav", "Aarti Desai", "Imran Shaikh", "Vaishali More", "Deepak Chavan"] },
    { name: "T3 Konkan · Jun 2026", division: "Konkan", locations: [["Thane", "Bhiwandi"], ["Ratnagiri", "Chiplun"], ["Raigad", "Alibag"]], names: ["Rutuja Sawant", "Sagar Naik", "Neha Kadam", "Prasad Patkar", "Ayesha Khan", "Rohan Jagtap", "Minal Joshi", "Akash Bhosale", "Shilpa Koli"] },
    { name: "T3 Nashik · Jun 2026", division: "Nashik", locations: [["Nashik", "Sinnar"], ["Ahilyanagar", "Pathardi"], ["Dhule", "Shirpur"]], names: ["Pallavi Wagh", "Ganesh Thakare", "Poonam Sonawane", "Aniket Gawali", "Farhan Qureshi", "Rashmi Patil", "Sachin Pawar", "Asmita Shinde", "Yogesh Jadhav"] },
    { name: "T3 Marathwada · Jul 2026", division: "Aurangabad", locations: [["Jalna", "Ambad"], ["Beed", "Parli"], ["Nanded", "Mahur"]], names: ["Nandini Kale", "Vivek Deshmukh", "Megha Chavan", "Shahid Ansari", "Anjali Kendre", "Pratik Gaikwad", "Rupali More", "Adnan Shaikh", "Tejaswini Pawar"] },
    { name: "T3 Vidarbha · Jul 2026", division: "Amravati", locations: [["Amravati", "Achalpur"], ["Yavatmal", "Darwha"], ["Akola", "Akot"]], names: ["Komal Rathod", "Ritesh Ingole", "Sakshi Deshpande", "Nikhil Wankhede", "Rehana Sheikh", "Anuja Gawai", "Manoj Meshram", "Priti Khobragade", "Harshal Kale"] },
  ] as const;
  const profiles: typeof seedRows[number]["dimensions"][] = [
    ["5", "5", "4", "4", "5", "4"], ["4", "4", "4", "4", "4", "4"],
    ["4", "4", "3", "3", "4", "3"], ["3", "3", "3", "3", "3", "3"],
    ["2", "2", "2", "2", "2", "2"], ["1", "1", "1", "1", "1", "1"],
    ["", "", "", "", "", ""], ["3", "4", "", "", "", ""], ["-", "", "", "", "", ""],
  ];
  const additionalRows = batchDetails.flatMap((batch, batchIndex) => batch.names.map((name, personIndex) => {
    const location = batch.locations[personIndex % batch.locations.length] ?? batch.locations[0];
    return {
      name, userId: `MT-${24101 + batchIndex * 9 + personIndex}`,
      division: batch.division, district: location[0], taluka: location[1], batch: batch.name,
      dimensions: profiles[personIndex] ?? ["", "", "", "", "", ""],
      recommendation: personIndex < 4 ? "Recommended as MT" as const : personIndex < 6 ? "Not Recommended as MT" as const : "" as const,
    };
  }));
  const batchIds: Record<string, string> = Object.fromEntries(batchDetails.map((batch, index) => [batch.name, `T3-2026-0${index + 1}`]));
  const batchDates: Record<string, string> = {
    "T3 Pune · May 2026": "2026-05-12", "T3 Konkan · Jun 2026": "2026-06-09",
    "T3 Nashik · Jun 2026": "2026-06-23", "T3 Marathwada · Jul 2026": "2026-07-07",
    "T3 Vidarbha · Jul 2026": "2026-07-21",
  };
  const batchSequence: Record<string, number> = {};

  return [...seedRows, ...additionalRows].map((row, index): Participant => ({
    id: row.userId,
    "Sr no.": (batchSequence[row.batch] = (batchSequence[row.batch] ?? 0) + 1),
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
    batchId: batchIds[row.batch] ?? row.batch,
    batchName: row.batch,
    batchDate: batchDates[row.batch] ?? "",
    "Program Assessment 1": index % 11 === 0 ? "" : `${58 + (index * 7) % 36}%`,
    "Program Assessment 2": index % 11 === 0 ? "" : `${62 + (index * 5) % 35}%`,
    "MT Assessment 1": index % 9 === 0 ? "" : `${55 + (index * 6) % 39}%`,
    "MT Assessment 2": index % 9 === 0 ? "" : `${61 + (index * 4) % 36}%`,
    "Cognitive Pre": index % 13 === 0 ? "" : `${40 + (index * 5) % 35}%`,
    "Cognitive Post": index % 13 === 0 ? "" : `${58 + (index * 4) % 37}%`,
    "Clarity of Ideas": row.dimensions[0],
    "Ability to involve the class and listen to participation": row.dimensions[1],
    "Appreciation of the goal of the program": row.dimensions[2],
    "In class participation": row.dimensions[3],
    "Inner Confidence": row.dimensions[4],
    "Appreciation and willingness to follow process": row.dimensions[5],
    "Participation Status": "Present",
    Recommendation: row.recommendation ?? "",
    Comments: "",
  }));
}

export const fieldColumnIndex = (field: EditableField) => COLUMN_ORDER.indexOf(field);
