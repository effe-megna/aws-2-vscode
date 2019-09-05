import * as vscode from 'vscode';
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/pipeable";
import { safeExec, parseJsonTE, monadvsCode } from './utils';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "aws-2-vs" is now active!');

	let disposable = vscode.commands.registerCommand('extension.CloudWatchLogs', async () => {
		console.log('Start');

		const a = new DepNodeProvider("stream-logs");

		vscode.window.registerTreeDataProvider("streamLogs", a);

		// const a = vscode.window.createTreeView('1', {
		// 	canSelectMany: true,
		// 	showCollapseAll: true,
		// 	treeDataProvider: {
		// 		getChildren: () => ["1", "2", "3"],
		// 		getParent: () => null,
		// 		getTreeItem: (el) => ({ label: "LABEL" })
		// 	}
		// });

		// vscode.window.registerTreeDataProvider("1", {
		// 	getChildren: () => ["1", "2", "3"],
		// 	getParent: () => null,
		// 	getTreeItem: (el) => ({ label: "LABEL" })
		// });

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

export class DepNodeProvider implements vscode.TreeDataProvider<LogStreamItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<LogStreamItem | undefined> = new vscode.EventEmitter<LogStreamItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<LogStreamItem | undefined> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string) { }

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: LogStreamItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: LogStreamItem): Thenable<LogStreamItem[]> {
		return Promise.resolve([
			this.toDep("1"),
			this.toDep("2"),
			this.toDep("3"),
			this.toDep("4"),
			this.toDep("5"),
		]);
	}

	toDep = (label: string): LogStreamItem => {
		return new LogStreamItem(label, vscode.TreeItemCollapsibleState.Collapsed);
	}
}

export class LogStreamItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
	}

	get tooltip(): string {
		return `${this.label}`;
	}

	// iconPath = {
	// 	light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
	// 	dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	// };

	contextValue = 'dependency';
}


// this method is called when your extension is deactivated
export function deactivate() { }
