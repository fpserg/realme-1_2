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

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

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
  proposedSubjectNodeId: null,
  subject: "Football",
};

function withObject(
  object: CandidateReviewItem["object"],
): CandidateReviewItem {
  return { ...candidate, object };
}

function submittedBody() {
  return JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
}

describe("CandidateReview", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
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

    expect(
      screen.getByText(candidate.evidence[0]!.exactText),
    ).toBeInTheDocument();
    for (const action of ["Accept", "Correct", "Defer", "Reject"]) {
      expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
    }
  });

  it("keeps a deferred candidate reviewable", async () => {
    render(<CandidateReview initialCandidates={[candidate]} />);
    fireEvent.click(screen.getByRole("button", { name: "Defer" }));

    await screen.findByText("Deferred. This candidate remains reviewable.");
    expect(screen.getByText("Football")).toBeInTheDocument();
    expect(submittedBody()).toEqual({
      action: "defer",
      candidateId: "candidate-1",
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("removes a candidate after final acceptance and refreshes server state", async () => {
    render(<CandidateReview initialCandidates={[candidate]} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() =>
      expect(screen.queryByText("Football")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Nothing waiting for review")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("submits corrected string durable meaning without rewriting the displayed AI candidate first", async () => {
    render(<CandidateReview initialCandidates={[candidate]} />);
    fireEvent.click(screen.getByRole("button", { name: "Correct" }));

    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "Football life" },
    });
    fireEvent.change(screen.getByLabelText(/^Value$/), {
      target: { value: "Domain" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Admit correction" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(submittedBody()).toEqual({
      action: "correct",
      candidateId: "candidate-1",
      correction: {
        object: "Domain",
        predicate: "classification",
        subject: "Football life",
      },
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("retains a number when only another correction field changes", async () => {
    render(<CandidateReview initialCandidates={[withObject(42)]} />);
    fireEvent.click(screen.getByRole("button", { name: "Correct" }));
    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "Football training" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Admit correction" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(submittedBody().correction.object).toBe(42);
  });

  it("retains a boolean when only another correction field changes", async () => {
    render(<CandidateReview initialCandidates={[withObject(true)]} />);
    fireEvent.click(screen.getByRole("button", { name: "Correct" }));
    fireEvent.change(screen.getByLabelText("Durable meaning"), {
      target: { value: "currently_active" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Admit correction" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(submittedBody().correction.object).toBe(true);
  });

  it("parses an edited numeric value as a number", async () => {
    render(<CandidateReview initialCandidates={[withObject(42)]} />);
    fireEvent.click(screen.getByRole("button", { name: "Correct" }));
    fireEvent.change(screen.getByLabelText(/^Value$/), {
      target: { value: "43.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Admit correction" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(submittedBody().correction.object).toBe(43.5);
  });

  it("parses an edited boolean value as a boolean", async () => {
    render(<CandidateReview initialCandidates={[withObject(true)]} />);
    fireEvent.click(screen.getByRole("button", { name: "Correct" }));
    fireEvent.change(screen.getByLabelText(/^Value$/), {
      target: { value: "false" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Admit correction" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(submittedBody().correction.object).toBe(false);
  });

  it("keeps a string value a string", async () => {
    render(<CandidateReview initialCandidates={[withObject("42")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Correct" }));
    fireEvent.change(screen.getByLabelText("Subject"), {
      target: { value: "Football score" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Admit correction" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(submittedBody().correction.object).toBe("42");
  });
});
