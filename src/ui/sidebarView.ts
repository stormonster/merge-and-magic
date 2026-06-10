import * as vscode from 'vscode';
import { GameState } from '../game/types';
import { getWebviewContent } from './webviewHtml';

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'mergeMagic.sidebarView';
  private _view?: vscode.WebviewView;
  private state: GameState;
  private messageCallback: (message: unknown) => void;

  constructor(private readonly extensionUri: vscode.Uri, initialState: GameState, messageCallback: (message: unknown) => void) {
    this.state = initialState;
    this.messageCallback = messageCallback;
    console.log('SidebarViewProvider constructed');
  }

  public resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
    console.log('SidebarViewProvider.resolveWebviewView called');
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media'), vscode.Uri.joinPath(this.extensionUri, 'assets')]
    };

    webviewView.webview.onDidReceiveMessage((m) => this.messageCallback(m));
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
    this._view.webview.html = getWebviewContent(this.extensionUri, this._view.webview, this.state);
  }
}
