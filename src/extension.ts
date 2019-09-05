import * as vscode from 'vscode';
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as T from "fp-ts/lib/Task";
import * as P from "fp-ts/lib/pipeable";
import { exec } from "child_process";
import { toError } from 'fp-ts/lib/Either';
import { safeExec, thenableToPromise, withProgress } from './utils';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "aws-2-vs" is now active!');

	let disposable = vscode.commands.registerCommand('extension.CloudWatchLogs', async () => {
		console.log('Start');

		const res = await P.pipe(
			safeExec("aws logs describe-log-groups --query logGroups[*].logGroupName"),
			TE.chain(v =>
				TE.fromEither(
					E.parseJSON(v, toError) as E.Either<Error, string[]>
				)
			),
			TE.chain(logGroups => TE.tryCatch(
				async () => {
					const selection = await thenableToPromise(vscode.window.showQuickPick(logGroups));

					if (selection === undefined || selection === null) {
						throw new Error("missing selection");
					} else {
						return selection;
					}
				},
				toError
			)),
			TE.chain(logGroup =>
				P.pipe(
					safeExec(`aws logs describe-log-streams --log-group-name ${logGroup} --query logStreams[*].logStreamName`),
					TE.map(v => ({ logGroup, logStreams: v }))
				)
			),
			TE.chain(({ logGroup, logStreams }) =>
				P.pipe(
					TE.fromEither(
						E.parseJSON(logStreams, toError) as E.Either<Error, string[]>
					),
					TE.map(v => ({ logGroup, logStreams: v }))
				)
			),
			TE.chain((userSelection) => TE.tryCatch(
				async () => {
					const selection = await thenableToPromise(vscode.window.showQuickPick(userSelection.logStreams));

					if (selection === undefined || selection === null) {
						throw new Error("missing selection");
					} else {
						return { ...userSelection, streamSelected: selection };
					}
				},
				toError
			)),
			TE.chain(({ logGroup, streamSelected }) =>
				safeExec(`aws logs get-log-events --log-group-name '${logGroup}' --log-stream-name '${streamSelected}'`)
			)
		)();

		P.pipe(
			res,
			E.fold(
				(e) => vscode.window.showErrorMessage(e.message),
				(v) => {
					return vscode.window.showInformationMessage(v);
				}
			),
		);
	});

	context.subscriptions.push(disposable);
}



// this method is called when your extension is deactivated
export function deactivate() { }
