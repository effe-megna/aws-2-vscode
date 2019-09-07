import * as vscode from "vscode";

export class EventStreamItem extends vscode.TreeItem {
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
