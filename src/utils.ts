import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from 'fp-ts/lib/Either';
import * as O from "fp-ts/lib/Option";
import * as Array from "fp-ts/lib/Array";
import { exec } from "child_process";
import { sequenceT } from "fp-ts/lib/Apply";

export const thenableToPromise = <T>(thenable: Thenable<T>) => new Promise<T>((res, rej) => {
  thenable.then((v) => res(v), (reasons) => rej(reasons));
});

export const includesOption = (searchString: O.Option<string>) => (a: O.Option<string>): O.Option<string> => {
  if (O.isNone(a) || O.isNone(searchString)) {
    return a;
  }

  return pipe(
    sequenceT(O.option)(
      a,
      searchString
    ),
    O.chain(([ab, sb]) => ab.includes(sb) ? a : O.none)
  );
};

export const safeExec = (cmd: string): TE.TaskEither<Error, string> =>
  TE.tryCatch(
    () => new Promise<string>((res, rej) => {
      exec(cmd, (err, stdout, stderr) => {
        if (stdout) {
          res(stdout);
        } else {
          rej(err);
        }
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

export const tap = <A>(fn: (v: A) => unknown) => (v: A): A => { fn(v); return v; };