import { createDemoParticipants, type Participant } from "@/lib/grading";

export type AssessmentDraft = Pick<Participant, "id"> & {
  dimensions: Record<keyof Pick<Participant,
    | "Clarity of Ideas"
    | "Ability to involve the class and listen to participation"
    | "Appreciation of the goal of the program"
    | "In class participation"
    | "Inner Confidence"
    | "Appreciation and willingness to follow process"
  >, string>;
  Recommendation: Participant["Recommendation"];
  Comments: string;
};

export interface GradingDataProvider {
  loadParticipants(): Promise<Participant[]>;
  saveDrafts(drafts: AssessmentDraft[]): Promise<void>;
  clearDrafts(): Promise<void>;
}

export function createGradingDataProvider(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">): GradingDataProvider {
  const storageKey = "zilla-t3-demo-assessments-v1";

  return {
    async loadParticipants() {
      const participants = createDemoParticipants();
      const serialized = storage.getItem(storageKey);
      if (!serialized) return participants;

      try {
        const saved = JSON.parse(serialized) as AssessmentDraft[];
        return participants.map((participant) => {
          const draft = saved.find((item) => item.id === participant.id);
          return draft ? { ...participant, ...draft.dimensions, Recommendation: draft.Recommendation, Comments: draft.Comments } : participant;
        });
      } catch {
        return participants;
      }
    },
    async saveDrafts(drafts) {
      storage.setItem(storageKey, JSON.stringify(drafts));
    },
    async clearDrafts() {
      storage.removeItem(storageKey);
    },
  };
}

export function toAssessmentDraft(participant: Participant): AssessmentDraft {
  const dimensions = {
    "Clarity of Ideas": participant["Clarity of Ideas"],
    "Ability to involve the class and listen to participation": participant["Ability to involve the class and listen to participation"],
    "Appreciation of the goal of the program": participant["Appreciation of the goal of the program"],
    "In class participation": participant["In class participation"],
    "Inner Confidence": participant["Inner Confidence"],
    "Appreciation and willingness to follow process": participant["Appreciation and willingness to follow process"],
  };
  return { id: participant.id, dimensions, Recommendation: participant.Recommendation, Comments: participant.Comments };
}