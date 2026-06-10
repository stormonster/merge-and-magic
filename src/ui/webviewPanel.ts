import * as vscode from 'vscode';
import { GameState } from '../game/types';
import { getWebviewContent } from './webviewHtml';

export class RpgWebviewPanel {
  private static currentPanel: RpgWebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly context: vscode.ExtensionContext;
  private state: GameState;
  private readonly messageCallback: (message: unknown) => void;

  private constructor(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    state: GameState,
    messageCallback: (message: unknown) => void
  ) {
    this.extensionUri = extensionUri;
    this.context = context;
    this.state = state;
    this.messageCallback = messageCallback;

    this.panel = vscode.window.createWebviewPanel(
      'mergeMagicRpg',
      'Merge & Magic',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media'), vscode.Uri.joinPath(extensionUri, 'assets')]
      }
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.context.subscriptions);
    this.panel.webview.onDidReceiveMessage((message) => this.messageCallback(message), null, this.context.subscriptions);
    this.update();
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    state: GameState,
    messageCallback: (message: unknown) => void
  ): RpgWebviewPanel {
    if (RpgWebviewPanel.currentPanel) {
      RpgWebviewPanel.currentPanel.state = state;
      RpgWebviewPanel.currentPanel.update();
      RpgWebviewPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      return RpgWebviewPanel.currentPanel;
    }

    RpgWebviewPanel.currentPanel = new RpgWebviewPanel(extensionUri, context, state, messageCallback);
    return RpgWebviewPanel.currentPanel;
  }

  public reveal() {
    this.panel.reveal(vscode.ViewColumn.One);
    this.update();
  }

  public postState(state: GameState) {
    this.state = state;
    this.update();
  }

  private update() {
    this.panel.title = 'Merge & Magic';
    this.panel.webview.html = getWebviewContent(this.extensionUri, this.panel.webview, this.state);
  }

  public dispose() {
    RpgWebviewPanel.currentPanel = undefined;
    this.panel.dispose();
  }
}
