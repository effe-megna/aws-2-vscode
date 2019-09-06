import * as vscode from 'vscode';
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/pipeable";

import { safeExec, parseJsonTE } from './utils';
import { monadvsCode } from "./monadVsCode";
import LogsDataProvider from "./logsDataProvider";

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "aws-2-vs" is now active!');

	//@ts-ignore
	const provider = new LogsDataProvider(vscode.workspace.rootPath);

	vscode.window.registerTreeDataProvider("cloudwatchLogs", provider);

	vscode.commands.registerCommand("cloudwatchLogs.refreshGroups", () => provider.refresh());
	vscode.commands.registerCommand("cloudwatchLogs.clearGroupNameFilter", () => provider.applyGroupNameFilter(undefined));
	vscode.commands.registerCommand("cloudwatchLogs.showLogGroupSearch", async () => {
		pipe(
			await monadvsCode.window.showInputBox({
				placeHolder: "Type something for filter log groups name",
				value: provider.groupNameFilter
			})(),
			E.fold(
				(e) => monadvsCode.window.showErrorMessage(e.message),
				(v) => { provider.applyGroupNameFilter(v); }
			)
		);
	});

	let disposable = vscode.commands.registerCommand('extension.CloudWatchLogs', async () => {
		console.log('Start');

		const res = await pipe(
			pipe(
				safeExec("aws logs describe-log-groups --query logGroups[*].logGroupName"),
				monadvsCode.window.withProgress()
			),
			TE.chain(v => parseJsonTE<string[]>(v)),
			TE.chain(monadvsCode.window.showQuickPick),
			TE.chain(logGroup =>
				pipe(
					safeExec(`aws logs describe-log-streams --log-group-name ${logGroup} --query logStreams[*].logStreamName`),
					TE.map(v => ({ logGroup, logStreams: v })),
					monadvsCode.window.withProgress()
				)
			),
			TE.chain(({ logGroup, logStreams }) =>
				pipe(
					parseJsonTE<string[]>(logStreams),
					TE.map(v => ({ logGroup, logStreams: v }))
				)
			),
			TE.chain(({ logGroup, logStreams }) =>
				pipe(
					monadvsCode.window.showQuickPick(logStreams),
					TE.map(v => ({ logGroup, streamSelected: v }))
				)
			),
			TE.chain(({ logGroup, streamSelected }) =>
				pipe(
					safeExec(`aws logs get-log-events --log-group-name '${logGroup}' --log-stream-name '${streamSelected}'`),
					monadvsCode.window.withProgress(),
				)
			)
		)();

		pipe(
			res,
			E.fold(
				(e) => vscode.window.showErrorMessage(e.message),
				(v) => {
					console.log(v);
					return vscode.window.showInformationMessage(v);
				}
			),
		);
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }
