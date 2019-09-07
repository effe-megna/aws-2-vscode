import * as vscode from 'vscode';

export class LogGroupItem extends vscode.TreeItem {
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
