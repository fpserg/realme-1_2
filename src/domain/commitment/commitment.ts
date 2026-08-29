export type CommitmentStatus = "open" | "completed" | "cancelled";
export type CommitmentSurface = "today" | "horizon";

export type CommitmentProjectionItem = {
  commitmentId: string;
  dueLocalDate: string;
  dueAssertionId: string;
  isStale: boolean;
  status: CommitmentStatus;
  statusAssertionId: string;
  surface: CommitmentSurface;
  title: string;
  titleAssertionId: string;
};

export function isCommitmentStatus(value: string): value is CommitmentStatus {
  return value === "open" || value === "completed" || value === "cancelled";
}

export function isCommitmentSurface(value: string): value is CommitmentSurface {
  return value === "today" || value === "horizon";
}
