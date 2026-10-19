import { models, connections, main, sftpclient } from '../../wailsjs/go/models';

export type Profile = models.Profile;
export type SessionSummary = connections.SessionSummary;
export type RemoteFile = models.RemoteFile;
export type FileContent = models.FileContent;
export type HostKeyPrompt = models.HostKeyPrompt;
export type ConnectResponse = main.ConnectResponse;
export type SaveResult = sftpclient.SaveResult;
export type ForwardedPortConfig = models.ForwardedPortConfig;

export interface OpenFile {
  sessionId: string;
  path: string;
  name: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  modTime: number;
  size: number;
  isBinary: boolean;
  language?: string;
}

export interface TreeItem extends RemoteFile {
  children?: TreeItem[];
  isOpen?: boolean;
  isLoading?: boolean;
  isLoaded?: boolean;
}
