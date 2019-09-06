import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from 'fp-ts/lib/Either';
import { exec } from "child_process";

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

export const foldOrThrowTE = async <A>(te: TE.TaskEither<Error, A>): Promise<A> =>
  pipe(
    await te(),
    foldOrThrow
  );

export const foldOrThrow = <A>(e: E.Either<Error, A>): A =>
  pipe(
    e,
    E.fold(
      (e) => { throw e; },
      v => v
    )
  );