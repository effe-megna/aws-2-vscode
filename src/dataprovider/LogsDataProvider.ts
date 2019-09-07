import * as vscode from 'vscode';
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { pipe } from 'fp-ts/lib/pipeable';
import { sequenceT } from 'fp-ts/lib/Apply';

import { foldOrThrowTE, tap } from '../utils';
import { monadvsCode, monadAws } from '../monads';
import { LogGroupItem } from './LogGroupItem';
import { EventStreamItem } from './EventStreamItem';

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
			const logEvents = await pipe(
				sequenceTOption(
					O.fromNullable(groupName),
					O.fromNullable(eventName)
				),
				TE.fromOption(() => new Error("Something goes wrong")),
				TE.chain(([g, e]) => monadAws.logEvents(g, e)),
				monadvsCode.window.withProgress("Loading...")
			)();

			pipe(
				logEvents,
				E.fold(
					e => monadvsCode.window.showErrorMessage(e.message),
					v => {
						if (v.events.length === 0) {
							monadvsCode.window.showInformationMessage("No logs founded for this stream");
							return;
						}

						const panel = vscode.window.createWebviewPanel(
							'logPanel',
							`${groupName} ${eventName}`,
							{
								viewColumn: vscode.ViewColumn.Beside,
								preserveFocus: true
							}
						);

						function getWebviewContent() {
							return `<!DOCTYPE html>
						<html lang="en">
						<head>
								<meta charset="UTF-8">
								<meta name="viewport" content="width=device-width, initial-scale=1.0">
								<title>Cloudwatch log</title>
						</head>
						<body>
							${v.events.map(e => {
								let color = "";

								if (e.message.includes("START")) {
									color = "green";
								} else if (e.message.includes("END")) {
									color = "red";
								} else if (e.message.includes("REPORT")) {
									color = "yellow";
								} else {
									color = "blue";
								}

								return (`
									<div style='border-bottom: 1px solid ${color}; padding: 3px 6px;'>
										<label style='color: white;'>${e.message}</label>
									</div>
								`);
							})}
						</body>
						</html>`;
						}

						panel.webview.html = getWebviewContent();
					}
				)
			);
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