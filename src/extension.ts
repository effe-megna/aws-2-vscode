import * as vscode from 'vscode';
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/pipeable";

import { safeExec, parseJsonTE } from './utils';
import { monadvsCode } from "./monadVsCode";
import LogsDataProvider from "./logsDataProvider";

export function activate(context: vscode.ExtensionContext) {
	//@ts-ignore
	const provider = new LogsDataProvider(vscode.workspace.rootPath);
	vscode.window.registerTreeDataProvider("cloudwatchLogs", provider);

	context.subscriptions.push(
		vscode.commands.registerCommand("cloudwatchLogs.refreshGroups", () => provider.refresh()),
		vscode.commands.registerCommand("cloudwatchLogs.clearGroupNameFilter", () => provider.applyGroupNameFilter(undefined)),
		vscode.commands.registerCommand("cloudwatchLogs.showLogGroupSearch", async () => {
			pipe(
				await monadvsCode.window.showInputBox({
					placeHolder: "Type something for filter log groups name",
					value: provider.groupNameFilter
				})(),
				E.fold(
					(e) => monadvsCode.window.showErrorMessage(e.message),
					(v) => provider.applyGroupNameFilter(v)
				)
			);
		}),
		vscode.commands.registerCommand("cloudwatchLogs.refreshLog", (e) => "")
	);
}

// this method is called when your extension is deactivated
export function deactivate() { }
