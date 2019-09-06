import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import * as IO from "fp-ts/lib/IO";
import * as E from 'fp-ts/lib/Either';
import { window, ProgressLocation, InputBoxOptions, TextDocument, workspace, ViewColumn, TextEditor } from "vscode";

import { thenableToPromise } from "./utils";

export interface MonadVsCode {
  window: {
    showInputBox: (options?: InputBoxOptions) => TE.TaskEither<Error, string>,
    showQuickPick: (items: string[]) => TE.TaskEither<Error, string>,
    withProgress: <A>() => (t: TE.TaskEither<Error, A>) => TE.TaskEither<Error, A>,
    showErrorMessage: (message: string) => void,
    showTextDocument: (document: TextDocument, column?: ViewColumn, preserveFocus?: boolean) => TE.TaskEither<Error, TextEditor>
  };
  workspace: {
    openTextDocument: (options?: { language?: string; content?: string; }) => TE.TaskEither<Error, TextDocument>
  };
}

const showInputBoxTE = (options?: InputBoxOptions) => TE.tryCatch(
  async () => {
    const selection = await thenableToPromise(window.showInputBox(options));

    if (selection === undefined || selection === null) {
      throw new Error("Something goes wrong");
    } else {
      return selection;
    }
  },
  E.toError
);

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

const showErrorMessage = (message: string): void => { window.showErrorMessage(message); };

const withProgressTE = <A>() => (taskEither: TE.TaskEither<Error, A>): TE.TaskEither<Error, A> => TE.tryCatch<Error, A>(
  () => {
    const action = new Promise<A>((resolve, reject) => {
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

export const monadvsCode: MonadVsCode = {
  window: {
    showInputBox: showInputBoxTE,
    showQuickPick: showQuickPickTE,
    showErrorMessage: showErrorMessage,
    withProgress: withProgressTE,
    showTextDocument: (document, column, preserveFocus) => TE.tryCatch(
      () => thenableToPromise(window.showTextDocument(document, column, preserveFocus)),
      E.toError
    )
  },
  workspace: {
    openTextDocument: (options?: { language?: string; content?: string; }) => TE.tryCatch(
      () => thenableToPromise(workspace.openTextDocument(options)),
      E.toError
    )
  }
};