import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Download,
  ExternalLink,
  X,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Check,
} from 'lucide-react';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import {
  DownloadAndApplyUpdate,
  GetUpdateProgress,
  RestartApp,
} from '../../wailsjs/go/main/App';
import { updater } from '../../wailsjs/go/models';

export interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: updater.UpdateInfo | null;
  onCheckAgain: () => void;
  isChecking: boolean;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  onCheckAgain,
  isChecking,
}) => {
  const [installState, setInstallState] = useState<
    'idle' | 'downloading' | 'extracting' | 'applying' | 'ready' | 'error'
  >('idle');
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState({ readBytes: 0, totalBytes: 0 });
  const [errorMessage, setErrorMessage] = useState('');
  const [isRestarting, setIsRestarting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<updater.AssetOption | null>(null);

  useEffect(() => {
    if (updateInfo?.downloadUrl && updateInfo?.assetFileName) {
      setSelectedAsset({
        name: updateInfo.assetFileName,
        downloadUrl: updateInfo.downloadUrl,
        type: updateInfo.installType || 'binary',
        size: 0,
        isDefault: true,
      });
    }
  }, [updateInfo]);

  useEffect(() => {
    let timer: any;
    if (
      installState === 'downloading' ||
      installState === 'extracting' ||
      installState === 'applying'
    ) {
      timer = setInterval(async () => {
        try {
          const res = await GetUpdateProgress();
          if (res) {
            setProgress(res.percentage || 0);
            setProgressInfo({
              readBytes: res.readBytes || 0,
              totalBytes: res.totalBytes || 0,
            });
            if (res.status === 'ready') {
              setInstallState('ready');
            } else if (res.status === 'error') {
              setInstallState('error');
              setErrorMessage(res.error || 'Update failed');
            } else if (res.status && res.status !== 'idle') {
              setInstallState(
                res.status as 'downloading' | 'extracting' | 'applying' | 'ready' | 'error'
              );
            }
          }
        } catch (e) {
          console.warn('Failed to poll update progress:', e);
        }
      }, 500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [installState]);

  if (!isOpen) return null;

  const hasUpdate = Boolean(updateInfo?.available);

  const handleStartInAppUpdate = async () => {
    const targetUrl = selectedAsset?.downloadUrl || updateInfo?.downloadUrl;
    const targetFile = selectedAsset?.name || updateInfo?.assetFileName;

    if (!targetUrl || !targetFile) {
      handleManualBrowserDownload();
      return;
    }

    setInstallState('downloading');
    setProgress(0);
    setErrorMessage('');

    try {
      // Async trigger on Go side
      DownloadAndApplyUpdate(targetUrl, targetFile)
        .then(() => {
          setInstallState('ready');
        })
        .catch((err) => {
          setInstallState('error');
          setErrorMessage(String(err));
        });
    } catch (err) {
      setInstallState('error');
      setErrorMessage(String(err));
    }
  };

  const handleRestartNow = async () => {
    setIsRestarting(true);
    try {
      await RestartApp();
    } catch (err) {
      setIsRestarting(false);
      setErrorMessage(`Failed to restart: ${err}`);
      setInstallState('error');
    }
  };

  const handleManualBrowserDownload = () => {
    const url = updateInfo?.downloadUrl || updateInfo?.releaseUrl;
    if (url) {
      if (typeof BrowserOpenURL === 'function') {
        BrowserOpenURL(url);
      } else {
        window.open(url, '_blank');
      }
    }
  };

  const handleOpenReleasePage = () => {
    const url =
      updateInfo?.releaseUrl || `https://github.com/Amanbig/termlet/releases`;
    if (typeof BrowserOpenURL === 'function') {
      BrowserOpenURL(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-6 shadow-2xl shadow-blue-500/10 text-zinc-900 dark:text-zinc-100 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 mb-5 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                installState === 'ready'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : hasUpdate
                  ? 'bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-600 dark:text-blue-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {installState === 'ready' ? (
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
              ) : hasUpdate ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                {installState === 'ready'
                  ? 'Update Ready to Restart'
                  : installState === 'downloading' ||
                    installState === 'extracting' ||
                    installState === 'applying'
                  ? 'Updating Termlet...'
                  : hasUpdate
                  ? 'Update Available!'
                  : 'You Are Up To Date'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {installState === 'ready'
                  ? 'The update has been installed successfully. Restart to launch the new version.'
                  : installState === 'downloading'
                  ? 'Downloading update package in the background...'
                  : installState === 'extracting' || installState === 'applying'
                  ? 'Extracting and updating application binary...'
                  : hasUpdate
                  ? 'A newer version is available. Update now seamlessly in the background.'
                  : 'Termlet is running the latest official release.'}
              </p>
            </div>
          </div>

          {installState !== 'downloading' && installState !== 'applying' && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Versions Badges */}
        <div className="grid grid-cols-2 gap-3 mb-5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Installed
            </span>
            <span className="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
              v{String(updateInfo?.currentVersion || updateInfo?.current_version || '0.5.2').replace(/^v/, '')}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              New Version
            </span>
            <span
              className={`text-sm font-mono font-bold mt-0.5 ${
                hasUpdate
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              v{String(
                updateInfo?.latestVersion ||
                  updateInfo?.latest_version ||
                  updateInfo?.currentVersion ||
                  '0.5.2'
              ).replace(/^v/, '')}
            </span>
          </div>
        </div>

        {/* In-Progress Progress Bar & Status */}
        {(installState === 'downloading' ||
          installState === 'extracting' ||
          installState === 'applying') && (
          <div className="space-y-3 mb-6 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-blue-200 dark:border-blue-900/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {installState === 'downloading' && `Downloading: ${progress}%`}
                {installState === 'extracting' && 'Extracting binary...'}
                {installState === 'applying' &&
                  ((selectedAsset?.type || updateInfo?.installType) === 'deb'
                    ? 'Installing .deb package (system authorization prompt may appear)...'
                    : (selectedAsset?.type || updateInfo?.installType) === 'rpm'
                    ? 'Installing .rpm package (system authorization prompt may appear)...'
                    : (selectedAsset?.type || updateInfo?.installType) === 'exe'
                    ? 'Launching Windows installer...'
                    : 'Applying update in-place...')}
              </span>
              {progressInfo.totalBytes > 0 && (
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  {formatSize(progressInfo.readBytes)} / {formatSize(progressInfo.totalBytes)}
                </span>
              )}
            </div>

            {/* Progress bar line */}
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300 shadow-sm shadow-blue-500/50"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {(selectedAsset?.type || updateInfo?.installType) === 'deb' ||
              (selectedAsset?.type || updateInfo?.installType) === 'rpm'
                ? 'Your desktop password will be requested to grant permission to install the updated package.'
                : 'You can keep using Termlet while the update is applied smoothly in the background.'}
            </p>
          </div>
        )}

        {/* Ready to restart prompt */}
        {installState === 'ready' && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-3 mb-6">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-zinc-900 dark:text-zinc-100">
                Update Installed Successfully!
              </p>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                Termlet has updated to{' '}
                <strong>
                  v
                  {String(
                    updateInfo?.latestVersion || updateInfo?.latest_version
                  ).replace(/^v/, '')}
                </strong>
                . Restart now to load the new version immediately, or restart later at your convenience.
              </p>
            </div>
          </div>
        )}

        {/* Error state alert */}
        {installState === 'error' && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-900 dark:text-rose-200">Update Failed</p>
              <p className="text-rose-700 dark:text-rose-300 leading-relaxed font-mono text-[11px]">
                {errorMessage || 'An error occurred during update.'}
              </p>
              <button
                onClick={handleManualBrowserDownload}
                className="mt-1 text-blue-600 dark:text-blue-400 underline hover:text-blue-500 block cursor-pointer"
              >
                Download manually from browser instead
              </button>
            </div>
          </div>
        )}

        {/* Release Notes (Shown when idle) */}
        {hasUpdate && installState === 'idle' && (
          <div className="space-y-4 mb-6">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  {updateInfo?.releaseName ||
                    updateInfo?.release_name ||
                    `Release ${updateInfo?.latestVersion || updateInfo?.latest_version}`}
                </span>
                {(updateInfo?.publishedAt || updateInfo?.published_at) && (
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(
                      updateInfo.publishedAt || updateInfo.published_at || ''
                    ).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Release Notes snippet */}
              {(updateInfo?.releaseNotes || updateInfo?.release_notes) && (
                <div className="max-h-36 overflow-y-auto p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed select-text">
                  {updateInfo.releaseNotes || updateInfo.release_notes}
                </div>
              )}
            </div>

            {/* Auto-detected Target Package for this system */}
            {(selectedAsset?.name || updateInfo?.assetFileName) && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 flex items-center justify-between gap-3 text-xs">
                <div className="truncate">
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[11px]">
                    {updateInfo?.installType === 'deb'
                      ? 'Target Package (.deb detected):'
                      : updateInfo?.installType === 'rpm'
                      ? 'Target Package (.rpm detected):'
                      : updateInfo?.installType === 'nsis'
                      ? 'Setup Wizard Installer (.exe):'
                      : 'Automatic Update Package:'}
                  </span>
                  <span className="font-mono text-blue-700 dark:text-blue-300 font-medium truncate block mt-0.5">
                    {selectedAsset?.name || updateInfo?.assetFileName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 font-mono">
                    {selectedAsset?.type ? `.${selectedAsset.type}` : updateInfo?.platform}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {!hasUpdate && installState === 'idle' && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5 mb-6">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              You are currently enjoying the latest official build of Termlet Desktop. Automatic update checks happen seamlessly in the background.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
          <button
            onClick={onCheckAgain}
            disabled={isChecking || installState === 'downloading' || installState === 'applying'}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isChecking ? 'Checking...' : 'Check again'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenReleasePage}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Notes</span>
            </button>

            {hasUpdate && installState === 'idle' && (
              <button
                onClick={handleStartInAppUpdate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 hover:brightness-105 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Update Now</span>
              </button>
            )}

            {installState === 'ready' && (
              <button
                onClick={handleRestartNow}
                disabled={isRestarting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 hover:brightness-105 transition-all cursor-pointer"
              >
                <RotateCcw
                  className={`w-4 h-4 stroke-[2.5] ${isRestarting ? 'animate-spin' : ''}`}
                />
                <span>{isRestarting ? 'Restarting...' : 'Restart Now'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
