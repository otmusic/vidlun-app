import { useCallback, useEffect, useState } from 'react';

import type { ConfirmEntry } from '@/application/use-cases/ConfirmEntry';
import type { CreateTextEntry } from '@/application/use-cases/CreateTextEntry';
import type { CreateVoiceEntry } from '@/application/use-cases/CreateVoiceEntry';
import type { GetHomeView, HomeView } from '@/application/use-cases/GetHomeView';
import type { DeleteEntry } from '@/application/use-cases/DeleteEntry';
import type { ReviseEntry } from '@/application/use-cases/ReviseEntry';
import type { WriteObservation } from '@/application/use-cases/WriteObservation';
import type { EntryEdits, MoodEntry } from '@/domain/entities/MoodEntry';
import { RecordingCancelledError } from '@/domain/errors/RecordingErrors';
import type { IAudioRecorder } from '@/domain/ports/IAudioRecorder';
import type { IHaptics } from '@/domain/ports/IHaptics';

export type CaptureStage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'recording' }
  | { readonly kind: 'writing' }
  | { readonly kind: 'processing' }
  | { readonly kind: 'reflecting'; readonly proposed: MoodEntry; readonly draft: MoodEntry }
  | { readonly kind: 'editing'; readonly proposed: MoodEntry; readonly draft: MoodEntry }
  | { readonly kind: 'saved'; readonly streakDays: number }
  | { readonly kind: 'failed'; readonly message: string };

export interface CaptureDependencies {
  readonly recorder: IAudioRecorder;
  readonly haptics: IHaptics;
  readonly createVoiceEntry: CreateVoiceEntry;
  readonly createTextEntry: CreateTextEntry;
  readonly confirmEntry: ConfirmEntry;
  readonly reviseEntry: ReviseEntry;
  readonly writeObservation: WriteObservation;
  readonly deleteEntry: DeleteEntry;
  readonly getHomeView: GetHomeView;
}

export interface CaptureFlow {
  readonly stage: CaptureStage;
  readonly home: HomeView | null;
  readonly startRecording: () => void;
  readonly stopRecording: () => void;
  readonly cancel: () => void;
  readonly startWriting: () => void;
  readonly submitText: (text: string) => void;
  readonly beginEditing: () => void;
  readonly applyEdits: (edits: EntryEdits) => void;
  readonly confirm: () => void;
  readonly backHome: () => void;
  readonly deleteEntry: (id: string) => void;
}

const RECENT_LIMIT = 3;

/**
 * The capture path as one state machine. Every transition here is on the ten
 * second budget, so nothing in it asks the user a question it could answer.
 */
/**
 * Native modules reject with plain objects as often as with Errors, and
 * `String({})` turns those into "[object Object]" — the one message that says
 * nothing at all. Whatever the layer below throws, something readable has to
 * survive it.
 */
function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const message: unknown = (error as { message?: unknown }).message;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }

  return String(error);
}

/**
 * Only touches the draft that was waiting for it. By the time the sentence
 * lands the user may have edited the entry, confirmed it, or started another —
 * in every one of those cases the observation is stale and dropping it is
 * correct.
 */
function addObservation(current: CaptureStage, spoken: MoodEntry): CaptureStage {
  if (current.kind !== 'reflecting' || current.draft.id !== spoken.id) {
    return current;
  }

  if (current.draft.wasRevisedByUser) {
    return current;
  }

  return { kind: 'reflecting', proposed: spoken, draft: spoken };
}

export function useCaptureFlow(dependencies: CaptureDependencies): CaptureFlow {
  const [stage, setStage] = useState<CaptureStage>({ kind: 'idle' });
  const [home, setHome] = useState<HomeView | null>(null);

  const { getHomeView } = dependencies;

  const reloadHome = useCallback(() => {
    void getHomeView
      .execute(RECENT_LIMIT)
      .then(setHome)
      .catch(() => {
        // A missing recent list is not worth blocking the capture path over.
        setHome(null);
      });
  }, [getHomeView]);

  useEffect(reloadHome, [reloadHome]);

  const fail = useCallback((error: unknown) => {
    if (error instanceof RecordingCancelledError) {
      setStage({ kind: 'idle' });

      return;
    }

    setStage({ kind: 'failed', message: describe(error) });
  }, []);

  const analyze = useCallback(
    (build: () => Promise<MoodEntry>) => {
      setStage({ kind: 'processing' });

      build()
        .then((draft) => {
          setStage({ kind: 'reflecting', proposed: draft, draft });

          /*
           * The card is already on screen. Luna's sentence comes from a slower
           * model and the entry needs it neither to render nor to save, so it
           * is written in afterwards rather than waited for — the difference
           * between two seconds of waiting and four.
           */
          void dependencies.writeObservation
            .execute(draft)
            .then((spoken) => {
              setStage((current) => addObservation(current, spoken));
            })
            .catch(() => {
              // The entry is complete without it. Failing here must not take
              // down a card the user is already reading.
            });
        })
        .catch(fail);
    },
    [dependencies.writeObservation, fail],
  );

  const startRecording = useCallback(() => {
    dependencies.haptics.tap();
    setStage({ kind: 'recording' });

    dependencies.recorder
      .start()
      .then((take) => {
        // Fires for a tap and for silence alike: the person may not be looking.
        dependencies.haptics.settle();
        analyze(() => dependencies.createVoiceEntry.execute(take));
      })
      .catch(fail);
  }, [analyze, dependencies, fail]);

  const confirm = useCallback(() => {
    if (stage.kind !== 'reflecting' && stage.kind !== 'editing') {
      return;
    }

    const { proposed, draft } = stage;

    setStage({ kind: 'processing' });

    dependencies.confirmEntry
      .execute({ proposed, confirmed: draft })
      .then(async () => {
        dependencies.haptics.success();

        const refreshed = await dependencies.getHomeView.execute(RECENT_LIMIT);

        setHome(refreshed);
        setStage({ kind: 'saved', streakDays: refreshed.streakDays });
      })
      .catch(fail);
  }, [dependencies, fail, stage]);

  return {
    stage,
    home,
    startRecording,
    stopRecording: useCallback(() => {
      dependencies.recorder.stop();
    }, [dependencies.recorder]),
    cancel: useCallback(() => {
      dependencies.recorder.cancel();
      setStage({ kind: 'idle' });
    }, [dependencies.recorder]),
    startWriting: useCallback(() => {
      setStage({ kind: 'writing' });
    }, []),
    submitText: useCallback(
      (text: string) => {
        analyze(() => dependencies.createTextEntry.execute(text));
      },
      [analyze, dependencies.createTextEntry],
    ),
    beginEditing: useCallback(() => {
      setStage((current) =>
        current.kind === 'reflecting'
          ? { kind: 'editing', proposed: current.proposed, draft: current.draft }
          : current,
      );
    }, []),
    applyEdits: useCallback(
      (edits: EntryEdits) => {
        setStage((current) => {
          if (current.kind !== 'editing') {
            return current;
          }

          return {
            kind: 'reflecting',
            proposed: current.proposed,
            draft: dependencies.reviseEntry.execute(current.draft, edits),
          };
        });
      },
      [dependencies.reviseEntry],
    ),
    confirm,
    backHome: useCallback(() => {
      setStage({ kind: 'idle' });
      reloadHome();
    }, [reloadHome]),
    deleteEntry: useCallback(
      (id: string) => {
        // Reloading rather than dropping the row locally: the streak is
        // counted from what is stored, and it may have just changed.
        void dependencies.deleteEntry.execute(id).then(reloadHome).catch(fail);
      },
      [dependencies.deleteEntry, reloadHome, fail],
    ),
  };
}
