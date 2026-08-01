"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChoiceFormState } from "../choice-stepper/choice-types";

export type PendingChoiceHandoff = {
  token: number;
  draft: ChoiceFormState;
};

type ChoiceHandoffContextValue = {
  pendingChoiceHandoff: PendingChoiceHandoff | null;
  publishChoiceHandoff: (draft: ChoiceFormState) => void;
  consumeChoiceHandoff: (token: number) => void;
};

const ChoiceHandoffContext = createContext<ChoiceHandoffContextValue | null>(
  null,
);

/**
 * Copies only the structured Choice fields. Keeping this allowlist here makes
 * it impossible for the natural-language source text or unknown UI state to
 * cross the route boundary accidentally.
 */
export function snapshotChoiceHandoffDraft(
  draft: ChoiceFormState,
): ChoiceFormState {
  return {
    who: draft.who,
    familyType: draft.familyType,
    childAge: draft.childAge,
    duration: draft.duration,
    otts: [...draft.otts],
    mood: draft.mood,
    origin: draft.origin,
    genres: [...draft.genres],
  };
}

export function ChoiceHandoffProvider({ children }: { children: ReactNode }) {
  const [pendingChoiceHandoff, setPendingChoiceHandoff] =
    useState<PendingChoiceHandoff | null>(null);
  const tokenSequence = useRef(0);

  const publishChoiceHandoff = useCallback((draft: ChoiceFormState) => {
    tokenSequence.current += 1;
    setPendingChoiceHandoff({
      token: tokenSequence.current,
      draft: snapshotChoiceHandoffDraft(draft),
    });
  }, []);

  const consumeChoiceHandoff = useCallback((token: number) => {
    setPendingChoiceHandoff((current) =>
      current?.token === token ? null : current,
    );
  }, []);

  const value = useMemo<ChoiceHandoffContextValue>(
    () => ({
      pendingChoiceHandoff,
      publishChoiceHandoff,
      consumeChoiceHandoff,
    }),
    [consumeChoiceHandoff, pendingChoiceHandoff, publishChoiceHandoff],
  );

  return (
    <ChoiceHandoffContext.Provider value={value}>
      {children}
    </ChoiceHandoffContext.Provider>
  );
}

export function useChoiceHandoff() {
  const context = useContext(ChoiceHandoffContext);
  if (!context) {
    throw new Error("useChoiceHandoff must be used inside ChoiceHandoffProvider");
  }
  return context;
}
