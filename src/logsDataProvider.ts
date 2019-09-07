import * as vscode from 'vscode';
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { pipe } from 'fp-ts/lib/pipeable';
import { sequenceT } from 'fp-ts/lib/Apply';

import { monadAws } from "./monadAws";
import { foldOrThrowTE, tap } from './utils';
import { CloudwatchLogDecoder } from "./types";
import { monadvsCode } from './monadVsCode';

const sequenceTOption = sequenceT(O.option);

type Node = LogGroupItem | EventStreamItem;

const isLogGroupItem = (n: Node): n is LogGroupItem => n.tag === "log-group";
const isEventStreamItem = (n: Node): n is EventStreamItem => n.tag === "event-stream";

export default class LogsDataProvider implements vscode.TreeDataProvider<Node> {

	private _onDidChangeTreeData: vscode.EventEmitter<Node | undefined> = new vscode.EventEmitter<Node | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Node | undefined> = this._onDidChangeTreeData.event;
	groupNameFilter: string | undefined = undefined;

	constructor(private workspaceRoot: string) {
		vscode.commands.registerCommand("cloudwatchLogs.onEventStreamClick", async (eventName?: string, groupName?: string) => {
			// open text document with messages
			// const textDocument = await pipe(
			// 	sequenceTOption(
			// 		O.fromNullable(groupName),
			// 		O.fromNullable(eventName)
			// 	),
			// 	TE.fromOption(() => new Error("Something goes wrong")),
			// 	TE.chain(([g, e]) => monadAws.logEvents(g, e)),
			// 	TE.chain(log => {
			// 		const content = log.events.map(l => l.message).toString()

			// 		return monadvsCode.workspace.openTextDocument({ content: "<h2 style='color: red;'>123<h2/>", language: "html" });
			// 	}),
			// 	monadvsCode.window.withProgress("Loading...")
			// )();

			// pipe(
			// 	textDocument,
			// 	E.fold(
			// 		e => monadvsCode.window.showErrorMessage(e.message),
			// 		v => monadvsCode.window.showTextDocument(v, vscode.ViewColumn.Beside, true)()
			// 	)
			// );

			// const textDocument = await pipe(
			// 	sequenceTOption(
			// 		O.fromNullable(groupName),
			// 		O.fromNullable(eventName)
			// 	),
			// 	TE.fromOption(() => new Error("Something goes wrong")),
			// 	TE.chain(([g, e]) => monadAws.logEvents(g, e)),
			// 	TE.chain(log => {
			// 		const content = log.events.map(l => l.message).toString()

			// 		return monadvsCode.workspace.openTextDocument({ content: "<h2 style='color: red;'>123<h2/>", language: "html" });
			// 	}),
			// 	monadvsCode.window.withProgress("Loading...")
			// )();

			// pipe(
			// 	textDocument,
			// 	E.fold(
			// 		e => monadvsCode.window.showErrorMessage(e.message),
			// 		v => monadvsCode.window.showTextDocument(v, vscode.ViewColumn.Beside, true)()
			// 	)
			// );

			// const panel = vscode.window.createWebviewPanel(
      //   'catCoding',
      //   'Cat Coding',
      //   vscode.ViewColumn.One,
      //   {}
      // );

      // // And set its HTML content
      // panel.webview.html = getWebviewContent();
		});
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Node): vscode.TreeItem {
		return element;
	}

	applyGroupNameFilter = (groupNameFilter: string | undefined) => {
		this.groupNameFilter = groupNameFilter;
		this.refresh();
	}

	getNodes = (node?: Node): TE.TaskEither<Error, Node[]> => {
		if (node && isLogGroupItem(node)) {
			return pipe(
				monadAws.logStreams(node.groupName),
				TE.map(xs => xs.map(
					eventName => EventStreamItem.of(eventName, eventName, node.groupName, {
						command: "cloudwatchLogs.onEventStreamClick",
						title: "Show log",
						tooltip: "Show log",
						arguments: [eventName, node.groupName]
					})
				))
			);
		}
		else {
			return pipe(
				monadAws.logGroups(),
				TE.map(xs => xs.filter(
					x => this.groupNameFilter ? x.includes(this.groupNameFilter) : true
				)),
				TE.map(xs => xs.map(
					groupName => LogGroupItem.of(groupName, groupName)
				))
			);
		}
	}

	getChildren(element?: Node): Promise<Node[]> {
		if (element && isEventStreamItem(element)) {
			//@ts-ignore
			return null;
		}

		return pipe(
			this.getNodes(element),
			TE.map(
				tap(nodes => {
					if (nodes.length === 0) {
						monadvsCode.window.showInformationMessage("No data returned");
					}
				})
			),
			foldOrThrowTE
		);
	}
}

class LogGroupItem extends vscode.TreeItem {
	public readonly tag = "log-group";

	private constructor(
		public readonly label: string,
		public readonly groupName: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
	}

	get tooltip(): string {
		return `${this.label}`;
	}

	static of(label: string, groupName: string) {
		return new LogGroupItem(label, groupName, vscode.TreeItemCollapsibleState.Collapsed);
	}

	contextValue = 'log-group-item';
}

class EventStreamItem extends vscode.TreeItem {
	public readonly tag = "event-stream";

	private constructor(
		public readonly label: string,
		public readonly groupName: string,
		public readonly eventName: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
	}

	get tooltip(): string {
		return `${this.label}`;
	}

	static of(label: string, eventName: string, groupName: string, command: vscode.Command) {
		return new EventStreamItem(label, eventName, groupName, vscode.TreeItemCollapsibleState.Collapsed, command);
	}

	contextValue = 'event-stream-item';
}