import * as vscode from 'vscode';
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { pipe } from 'fp-ts/lib/pipeable';

import { monadAws } from "./monadAws";
import { foldOrThrowTE } from './utils';
import { monadvsCode } from './monadVsCode';

type Node = LogGroupItem | EventStreamItem;

const isLogGroupItem = (n: Node): n is LogGroupItem => n.tag === "log-group";
const isEventStreamItem = (n: Node): n is EventStreamItem => n.tag === "event-stream";

export default class LogsDataProvider implements vscode.TreeDataProvider<Node> {

	private _onDidChangeTreeData: vscode.EventEmitter<Node | undefined> = new vscode.EventEmitter<Node | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Node | undefined> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string) { }

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Node): vscode.TreeItem {
		return element;
	}

	getEventsItem = (groupName: string): TE.TaskEither<Error, EventStreamItem[]> => pipe(
		monadAws.logStreams(groupName),
		TE.map(xs => xs.map(
			eventName => EventStreamItem.of(eventName, eventName, groupName)
		))
	)

	getNodes = (node?: Node): TE.TaskEither<Error, Node[]> => {
		if (node && isLogGroupItem(node)) {
			return pipe(
				monadAws.logStreams(node.groupName),
				TE.map(xs => xs.map(
					eventName => EventStreamItem.of(eventName, eventName, node.groupName)
				))
			);
		}
		else {
			return pipe(
				monadAws.logGroups(),
				TE.map(xs => xs.map(
					groupName => LogGroupItem.of(groupName, groupName)
				))
			);
		}
	}

	async getChildren(element?: Node): Promise<Node[]> {
		if (element && isEventStreamItem(element)) {
			//@ts-ignore
			return null;
		}

		return pipe(
			this.getNodes(element),
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

	static of(label: string, eventName: string, groupName: string) {
		return new EventStreamItem(label, eventName, groupName, vscode.TreeItemCollapsibleState.Collapsed);
	}

	contextValue = 'event-stream-item';
}