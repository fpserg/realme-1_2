export type CommitmentStatus = "open" | "completed" | "cancelled";
export type CommitmentSurface = "today" | "horizon";

export type CommitmentProjectionItem = {
  classificationAssertionId: string;
  commitmentId: string;
  dueLocalDate: string;
  dueAssertionId: string;
  isStale: boolean;
  status: CommitmentStatus;
  statusAssertionId: string;
  surface: CommitmentSurface;
  title: string;
  titleAssertionId: string | null;
};

export function isCommitmentStatus(value: string): value is CommitmentStatus {
  return value === "open" || value === "completed" || value === "cancelled";
}

export function isCommitmentSurface(value: string): value is CommitmentSurface {
  return value === "today" || value === "horizon";
}
