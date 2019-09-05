import { window, ProgressLocation } from "vscode";
import * as TE from "fp-ts/lib/TaskEither";
import { exec } from "child_process";
import { toError, Either } from 'fp-ts/lib/Either';

type withProgress = <A>(params: {
  taskEither: TE.TaskEither<Error, A>,
  title?: string,
  onCancel?: () => unknown
}) => TE.TaskEither<Error, A>;

//@ts-ignore
export const withProgress: withProgress = ({
  taskEither,
  title = "Santa Claus is coming to town",
  onCancel
}) => {

  return TE.tryCatch(
    () => {
      const action = new Promise<Either<Error, any>>((res, rej) => {
        window.withProgress({
          location: ProgressLocation.Notification,
          title,
          cancellable: onCancel !== undefined
        }, (_, token) => {
          if (onCancel) {
            token.onCancellationRequested(onCancel);
          }
          const res = taskEither();

          //@ts-ignore
          res.then(v => res(v));
      
          return res;
        });
      });

      return action;
    },
    toError
  );


  const action = window.withProgress({
    location: ProgressLocation.Notification,
    title,
    cancellable: onCancel !== undefined
  }, (_, token) => {
    if (onCancel) {
      token.onCancellationRequested(onCancel);
    }

    return taskEither();
  });

  return TE.tryCatch(
    () => thenableToPromise(action),
    toError
  );
};

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
		toError
	);