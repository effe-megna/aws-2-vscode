import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from 'fp-ts/lib/Either';
import { window, ProgressLocation } from "vscode";
import { exec } from "child_process";

// export const withProgressTE = <A>({
//   title = "🎅 Santa Claus is coming to town",
//   onCancel = undefined
// }: { title?: string, onCancel?: () => TE.TaskEither<Error, A> }) => (taskEither: TE.TaskEither<Error, A>): TE.TaskEither<Error, A> =>
//     //@ts-ignore
//     TE.tryCatch(
//       () => {
//         const action = new Promise((resolve, reject) => {
//           window.withProgress({
//             location: ProgressLocation.Notification,
//             title,
//             cancellable: onCancel !== undefined
//           }, (_, token) => {
//             if (onCancel) {
//               token.onCancellationRequested(onCancel);
//             }
//             const res = taskEither();

//             res
//               .then(v => {
//                 pipe(
//                   v,
//                   E.fold(
//                     (e) => { throw e; },
//                     (a) => resolve(a)
//                   )
//                 );
//               });

//             return res;
//           });
//         });

//         return action;
//       },
//       E.toError
//     );

export const withProgressTE = <A>() => (taskEither: TE.TaskEither<Error, A>): TE.TaskEither<Error, A> =>
  //@ts-ignore
  TE.tryCatch(
    () => {
      const action = new Promise((resolve, reject) => {
        window.withProgress({
          location: ProgressLocation.Notification,
          title: "🎅 Santa Claus is coming to town",
        }, (_, token) => {
          const res = taskEither();

          res
            .then(v => {
              pipe(
                v,
                E.fold(
                  (e) => { throw e; },
                  (a) => resolve(a)
                )
              );
            });

          return res;
        });
      });

      return action;
    },
    E.toError
  );


export const thenableToPromise = <T>(thenable: Thenable<T>) => new Promise<T>((res, rej) => {
  thenable.then((v) => res(v), (reasons) => rej(reasons));
});

export const safeExec = (cmd: string): TE.TaskEither<Error, string> =>
  TE.tryCatch(
    () => new Promise<string>((res, rej) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          rej(err);
        } else {
          res(stdout);
        }

        console.log("STDERR ", stderr);
      });
    }),
    E.toError
  );

export const parseJsonTE = <A>(v: string): TE.TaskEither<Error, A> =>
  TE.fromEither(
    E.parseJSON(v, E.toError) as E.Either<Error, A>
  );

export interface MonadVsCode {
  window: {
    showQuickPick: (items: string[]) => TE.TaskEither<Error, string>,
    withProgress: <A>() => (t: TE.TaskEither<Error, A>) => TE.TaskEither<Error, A>
  };
}

const showQuickPickTE = (items: string[]) => TE.tryCatch(
  async () => {
    const selection = await thenableToPromise(window.showQuickPick(items));

    if (selection === undefined || selection === null) {
      throw new Error("missing selection");
    } else {
      return selection;
    }
  },
  E.toError
);

export const monadvsCode: MonadVsCode = {
  window: {
    showQuickPick: showQuickPickTE,
    withProgress: withProgressTE
  }
};