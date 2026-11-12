import { describe, expect, it } from "vitest";

import { COLUMN_ORDER, createDemoParticipants, EDITABLE_FIELDS, gradeDistribution, gradeParticipant, isDimensionValue, type Participant } from "@/lib/grading";
import { createGradingDataProvider, toAssessmentDraft } from "@/lib/grading-data-provider";

function demoParticipant(index: number): Participant {
  const participant = createDemoParticipants()[index];
  if (!participant) throw new Error(`Missing demo participant at index ${index}`);
  return participant;
}

describe("T3 grading rules", () => {
  it("keeps the required columns in exact order", () => {
    expect(COLUMN_ORDER).toEqual([
      "Sr no.", "userId", "Name", "email", "phone", "Division", "District", "Taluka", "Department", "Designation",
      "Coach 1", "Coach 2", "batchId", "batchName", "batchDate", "Program Assessment 1", "Program Assessment 2",
      "MT Assessment 1", "MT Assessment 2", "Cognitive Pre", "Cognitive Post", "Clarity of Ideas",
      "Ability to involve the class and listen to participation", "Appreciation of the goal of the program", "In class participation",
      "Inner Confidence", "Appreciation and willingness to follow process", "Score", "Participation Status", "Internal Grade", "Recommendation", "Comments",
    ]);
  });

  it.each([
    ["A", ["5", "5", "5", "5", "4", "5"], 29],
    ["B", ["4", "4", "4", "4", "3", "3"], 22],
    ["C", ["2", "2", "2", "2", "1", "1"], 10],
    ["D", ["1", "1", "1", "1", "1", "2"], 7],
  ] as const)("calculates grade %s from six numeric dimensions", (grade, values, score) => {
    const participant = demoParticipant(0);
    const fields = [
      "Clarity of Ideas", "Ability to involve the class and listen to participation",
      "Appreciation of the goal of the program", "In class participation", "Inner Confidence",
      "Appreciation and willingness to follow process",
    ] as const;
    fields.forEach((field, index) => {
      const value = values[index];
      if (value !== undefined) participant[field] = value;
    });
    expect(gradeParticipant(participant)).toMatchObject({ Score: score, "Internal Grade": grade });
  });

  it.each([
    [24, "A"], [23, "B"], [15, "B"], [14, "C"], [10, "C"], [9, "D"],
  ] as const)("applies the stated grade boundary at score %i", (score, expectedGrade) => {
    const participant = demoParticipant(0);
    const fields = [
      "Clarity of Ideas", "Ability to involve the class and listen to participation",
      "Appreciation of the goal of the program", "In class participation", "Inner Confidence",
      "Appreciation and willingness to follow process",
    ] as const;
    fields.forEach((field, index) => { participant[field] = String(index === 0 ? score - 5 : 1) as "0" | "1" | "2" | "3" | "4" | "5"; });
    expect(gradeParticipant(participant)).toMatchObject({ Score: score, "Internal Grade": expectedGrade });
  });

  it("keeps blank scores unfinished and zero as a complete score", () => {
    const blank = demoParticipant(0);
    const zero = demoParticipant(1);
    expect(gradeParticipant(blank)).toMatchObject({ Score: "", "Internal Grade": "" });
    expect(gradeParticipant(zero)).toMatchObject({ Score: 0, "Internal Grade": "D" });
  });

  it("keeps absent participants ungraded", () => {
    const absent = demoParticipant(6);
    absent["Participation Status"] = "Absent";
    expect(gradeParticipant(absent)).toMatchObject({ Score: "", "Internal Grade": "Absent", Recommendation: "Absent" });
    absent["Participation Status"] = "Present";
    expect(gradeParticipant(absent)).toMatchObject({ Score: "", "Internal Grade": "" });
  });

  it("calculates grade percentages within a batch from graded participants only", () => {
    const rows = createDemoParticipants().filter((row) => row.batchId === "T3-2026-01");
    expect(gradeDistribution(rows)).toMatchObject({ graded: 8, absent: 0, ungraded: 4, total: 12,
      counts: { A: 2, B: 2, C: 1, D: 3 }, percentages: { A: 25, B: 25, C: 13, D: 37 } });
    rows[0]!["Participation Status"] = "Absent";
    expect(gradeDistribution(rows)).toMatchObject({ graded: 8, absent: 1, ungraded: 3, total: 12 });
  });

  it("accepts only blank, dash, and a single integer from zero through five", () => {
    expect(["", "-", "0", "1", "2", "3", "4", "5"].every(isDimensionValue)).toBe(true);
    expect(["6", "-1", "2.5", " 3", "abc"].some(isDimensionValue)).toBe(false);
  });

  it("allows editing the six dimensions, participation status, recommendation, and comments", () => {
    expect(EDITABLE_FIELDS).toEqual([
      "Clarity of Ideas",
      "Ability to involve the class and listen to participation",
      "Appreciation of the goal of the program",
      "In class participation",
      "Inner Confidence",
      "Appreciation and willingness to follow process",
      "Participation Status",
      "Recommendation",
      "Comments",
    ]);
  });

  it("restores autosaved assessments after reopening the data provider", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const provider = createGradingDataProvider(storage);
    const rows = await provider.loadParticipants();
    rows[0]!["Clarity of Ideas"] = "4";
    rows[0]!["Participation Status"] = "Absent";
    rows[0]!.Comments = "Follow up";
    await provider.saveDrafts(rows.map(toAssessmentDraft));

    const restored = await createGradingDataProvider(storage).loadParticipants();
    expect(restored[0]).toMatchObject({ "Clarity of Ideas": "4", "Participation Status": "Absent", Comments: "Follow up" });
    expect(gradeParticipant(restored[0]!)).toMatchObject({ "Internal Grade": "Absent", Recommendation: "Absent" });
  });
});
