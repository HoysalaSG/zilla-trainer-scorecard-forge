import { describe, expect, it } from "vitest";

import { COLUMN_ORDER, createDemoParticipants, EDITABLE_FIELDS, gradeParticipant, isDimensionValue, type Participant } from "@/lib/grading";

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
      "Inner Confidence", "Appreciation and willingness to follow process", "Score", "Internal Grade", "Recommendation", "Comments",
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
    fields.forEach((field, index) => { participant[field] = values[index]; });
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

  it("marks a dash as absent without calculating a score", () => {
    const absent = demoParticipant(6);
    expect(gradeParticipant(absent)).toMatchObject({ Score: "", "Internal Grade": "Absent" });
  });

  it("accepts only blank, dash, and a single integer from zero through five", () => {
    expect(["", "-", "0", "1", "2", "3", "4", "5"].every(isDimensionValue)).toBe(true);
    expect(["6", "-1", "2.5", " 3", "abc"].some(isDimensionValue)).toBe(false);
  });

  it("allows editing only the six dimensions, recommendation, and comments", () => {
    expect(EDITABLE_FIELDS).toEqual([
      "Clarity of Ideas",
      "Ability to involve the class and listen to participation",
      "Appreciation of the goal of the program",
      "In class participation",
      "Inner Confidence",
      "Appreciation and willingness to follow process",
      "Recommendation",
      "Comments",
    ]);
  });
});