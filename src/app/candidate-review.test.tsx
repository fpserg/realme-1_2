import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidateReviewItem } from "@/application/admission/admission";

import { CandidateReview } from "./candidate-review";

const candidate: CandidateReviewItem = {
  createdAt: "2026-08-28T08:00:00.000Z",
  evidence: [
    {
      exactText: "Football matters enough to deserve its own place.",
      sourceFragmentId: "fragment-1",
    },
  ],
  explanation: "Repeated durable evidence supports this proposed meaning.",
  id: "candidate-1",
  object: "Realm",
  predicate: "classification",
  proposedSubjectNodeId: "node-1",
  subject: "Football",
};

describe("CandidateReview", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ decisionId: "decision-1" }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows exact evidence and all four conceptually distinct decisions", () => {
    render(<CandidateReview initialCandidates={[candidate]} />);

    expect(screen.getByText(candidate.evidence[0]!.exactText)).toBeInTheDocument();
    for (const action of ["Accept", "Correct", "Defer", "Reject"]) {
      expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
    }
  });

  it("keeps a deferred candidate reviewable", async () => {
    render(<CandidateReview initialCandidates={[candidate]} />);
    fireEvent.click(screen.getByRole("button", { name: "Defer" }));

    await screen.findByText("Deferred. This candidate remains reviewable.");
    expect(screen.getByText("Football")).toBeInTheDocument();
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({
      action: "defer",
      candidateId: "candidate-1",
    });
  });

  it("removes a candidate after final acceptance", async () => {
    render(<CandidateReview initialCandidates={[candidate]} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() =>
      expect(screen.queryByText("Football")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Nothing waiting for review")).toBeInTheDocument();
  });

  it("submits corrected durable meaning without rewriting the displayed AI candidate first", async () => {
    render(<CandidateReview initialCandidates={[candidate]} />);
    fireEvent.click(screen.getByRole("button", { name: "Correct" }));

    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "Football life" },
    });
    fireEvent.change(screen.getByLabelText("Value"), {
      target: { value: "Domain" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Admit correction" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({
      action: "correct",
      candidateId: "candidate-1",
      correction: {
        object: "Domain",
        predicate: "classification",
        subject: "Football life",
      },
    });
  });
});
