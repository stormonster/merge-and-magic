import * as vscode from 'vscode';
import { GameState } from '../game/types';
import { getWebviewContent } from './webviewHtml';

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'mergeMagic.sidebarView';
  private _view?: vscode.WebviewView;
  private state: GameState;
  private messageCallback: (message: unknown) => void;
  private viewSeenCallback: () => void;
  private rendered = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    initialState: GameState,
    messageCallback: (message: unknown) => void,
    viewSeenCallback: () => void
  ) {
    this.state = initialState;
    this.messageCallback = messageCallback;
    this.viewSeenCallback = viewSeenCallback;
    console.log('SidebarViewProvider constructed');
  }

  public resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
    console.log('SidebarViewProvider.resolveWebviewView called');
    this._view = webviewView;
    this.rendered = false;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media'), vscode.Uri.joinPath(this.extensionUri, 'assets')]
    };

    webviewView.webview.onDidReceiveMessage((m) => this.handleWebviewMessage(m));
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.markViewSeen();
        this.rendered = false;
        this.renderCurrentState();
      }
    });
    try {
      this.refresh();
    } catch (e) {
      console.error('SidebarViewProvider refresh error', e);
    }
  }

  public refresh(state?: GameState) {
    if (state) this.state = state;
    if (!this._view) return;
    this._view.title = 'Merge & Magic';
    if (!this._view.visible) {
      return;
    }

    this.markViewSeen();
    this.renderCurrentState();
  }

  private renderCurrentState() {
    if (!this._view) return;
    if (!this.rendered) {
      this._view.webview.html = getWebviewContent(this.extensionUri, this._view.webview, this.state);
      this.rendered = true;
      return;
    }

    void this._view.webview.postMessage({ type: 'stateUpdate', state: this.state });
  }

  private handleWebviewMessage(message: unknown) {
    const type = typeof message === 'object' && message !== null && 'type' in message
      ? (message as { type?: unknown }).type
      : undefined;

    this.markViewSeen();

    if (type === 'viewActive' || type === 'viewHidden') {
      return;
    }

    this.messageCallback(message);
  }

  private markViewSeen() {
    this.viewSeenCallback();
  }
}
