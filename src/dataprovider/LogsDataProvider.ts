import * as vscode from 'vscode';
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as ARRAY from "fp-ts/lib/Array";
import { pipe } from 'fp-ts/lib/pipeable';
import { sequenceT } from 'fp-ts/lib/Apply';

import { foldOrThrowTE, tap, includesOption } from '../utils';
import { monadvsCode, monadAws } from '../monads';
import { LogGroupItem } from './LogGroupItem';
import { EventStreamItem } from './EventStreamItem';
import { CloudwatchLog, CloudwatchFilterLogResult } from '../types';

const sequenceTOption = sequenceT(O.option);

type Node = LogGroupItem | EventStreamItem;

const isLogGroupItem = (n: Node): n is LogGroupItem => n.tag === "log-group";
const isEventStreamItem = (n: Node): n is EventStreamItem => n.tag === "event-stream";

export default class LogsDataProvider implements vscode.TreeDataProvider<Node> {

	private _onDidChangeTreeData: vscode.EventEmitter<Node | undefined> = new vscode.EventEmitter<Node | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Node | undefined> = this._onDidChangeTreeData.event;
	logs?: CloudwatchFilterLogResult[] = undefined;
	groupNameFilter: O.Option<string> = O.none;

	constructor(private workspaceRoot: string) {
		vscode.commands.registerCommand("cloudwatchLogs.onEventStreamClick", async (eventName?: string, groupName?: string) => {
			const logEvents = await pipe(
				sequenceTOption(
					O.fromNullable(groupName),
					O.fromNullable(eventName)
				),
				TE.fromOption(() => new Error("Something goes wrong")),
				TE.chain(([g, e]) => monadAws.filterLogEvents(g, e)),
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

						this.logs = [v];

						const panel = vscode.window.createWebviewPanel(
							'logPanel',
							`${groupName} ${eventName}`,
							{
								viewColumn: vscode.ViewColumn.Beside,
								preserveFocus: true
							},
							{
								enableScripts: true
							}
						);

						panel.webview.html = this.getWebviewContent(v);

						panel.webview.onDidReceiveMessage((message) => {
							switch (message.command) {
								case "loadMore": {
									if (v.nextToken) {
										pipe(
											monadAws.filterLogEvents(groupName!, eventName!, v.nextToken),
											TE.map(newV => {
												this.logs!.push(newV);
											})
										);
									}
								}
							}
						});
					}
				)
			);
		});
	}

	getWebviewContent(v: CloudwatchFilterLogResult) {
		const script = `
			(function () {
				const vscode = acquireVsCodeApi();

				console.log('init')
	
				const dispatchMessage = (command) => {
					vscode.postMessage({
						command
					})
				}
	
				const loadMore = () => {
					console.log('loadMore')
					dispatchMessage("loadMore")
				}
	
				window.onscroll = function () {
					debugger

					console.log('onScroll')
					if (getScrollTop() < (getDocumentHeight() - window.innerHeight) - 50) return;
	
					loadMore()
				};
	
				function getDocumentHeight() {
					const body = document.body;
					const html = document.documentElement;
	
					return Math.max(
						body.scrollHeight, body.offsetHeight,
						html.clientHeight, html.scrollHeight, html.offsetHeight
					);
				};
	
				function getScrollTop() {
					return (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
				}
			}())
		`;

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
				<div style='text-align: center; margin: 10px 0;'>
					<label 
						style='text-decoration: underline; color: white; font-size: 18px;'
						id="refresh-btn"
					>
						Refresh
					</label>
				</div>
			</body>
			<script>
				${script}
			</script>
			</html>`;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Node): vscode.TreeItem {
		return element;
	}

	applyGroupNameFilter = (newValue: O.Option<string>) => {
		this.groupNameFilter = newValue;
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
				TE.map(ARRAY.map(O.option.of)),
				TE.map(ARRAY.filterMap(
					includesOption(this.groupNameFilter))
				),
				TE.map(xs => xs.map(
					groupName => LogGroupItem.of(groupName, groupName)
				))
			);
		}
	}

	getChildren(element?: Node): Promise<Node[]> | null {
		if (element && isEventStreamItem(element)) {
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