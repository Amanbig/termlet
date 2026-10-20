import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Shield, Key, Loader2, Check } from 'lucide-react';
import { ChmodRemotePath } from '../../wailsjs/go/main/App';
import { toast } from 'sonner';
import { formatErrorMessage } from '../utils/errors';

interface ChmodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  itemPath: string;
  itemName: string;
  isDir: boolean;
  initialPermissions?: number;
  onPermissionsUpdated: () => void;
}

export const ChmodModal: React.FC<ChmodModalProps> = ({
  open,
  onOpenChange,
  sessionId,
  itemPath,
  itemName,
  isDir,
  initialPermissions = 0o644,
  onPermissionsUpdated,
}) => {
  // Extract user/group/other bits
  const [userR, setUserR] = useState(true);
  const [userW, setUserW] = useState(true);
  const [userX, setUserX] = useState(false);

  const [groupR, setGroupR] = useState(true);
  const [groupW, setGroupW] = useState(false);
  const [groupX, setGroupX] = useState(false);

  const [otherR, setOtherR] = useState(true);
  const [otherW, setOtherW] = useState(false);
  const [otherX, setOtherX] = useState(false);

  const [octalStr, setOctalStr] = useState('0644');
  const [recursive, setRecursive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync checkboxes from numeric mode
  const syncFromNumeric = (mode: number) => {
    const perm = mode & 0o777;
    setUserR((perm & 0o400) !== 0);
    setUserW((perm & 0o200) !== 0);
    setUserX((perm & 0o100) !== 0);

    setGroupR((perm & 0o040) !== 0);
    setGroupW((perm & 0o020) !== 0);
    setGroupX((perm & 0o010) !== 0);

    setOtherR((perm & 0o004) !== 0);
    setOtherW((perm & 0o002) !== 0);
    setOtherX((perm & 0o001) !== 0);

    setOctalStr('0' + perm.toString(8).padStart(3, '0'));
  };

  // Re-calculate octal from current checkboxes
  const calculateNumeric = (
    uR: boolean,
    uW: boolean,
    uX: boolean,
    gR: boolean,
    gW: boolean,
    gX: boolean,
    oR: boolean,
    oW: boolean,
    oX: boolean
  ): number => {
    let mode = 0;
    if (uR) mode |= 0o400;
    if (uW) mode |= 0o200;
    if (uX) mode |= 0o100;

    if (gR) mode |= 0o040;
    if (gW) mode |= 0o020;
    if (gX) mode |= 0o010;

    if (oR) mode |= 0o004;
    if (oW) mode |= 0o002;
    if (oX) mode |= 0o001;

    return mode;
  };

  // Initialize state when modal opens
  useEffect(() => {
    if (open) {
      const startPerm = initialPermissions > 0 ? initialPermissions : isDir ? 0o755 : 0o644;
      syncFromNumeric(startPerm);
      setRecursive(false);
    }
  }, [open, initialPermissions, isDir]);

  // Update octal when checkboxes toggle
  const handleCheckboxChange = (
    uR: boolean,
    uW: boolean,
    uX: boolean,
    gR: boolean,
    gW: boolean,
    gX: boolean,
    oR: boolean,
    oW: boolean,
    oX: boolean
  ) => {
    setUserR(uR);
    setUserW(uW);
    setUserX(uX);
    setGroupR(gR);
    setGroupW(gW);
    setGroupX(gX);
    setOtherR(oR);
    setOtherW(oW);
    setOtherX(oX);

    const mode = calculateNumeric(uR, uW, uX, gR, gW, gX, oR, oW, oX);
    setOctalStr('0' + mode.toString(8).padStart(3, '0'));
  };

  // Handle manual input in octal text box
  const handleOctalInput = (val: string) => {
    setOctalStr(val);
    const clean = val.replace(/^0+/, '') || '0';
    const parsed = parseInt(clean, 8);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0o777) {
      setUserR((parsed & 0o400) !== 0);
      setUserW((parsed & 0o200) !== 0);
      setUserX((parsed & 0o100) !== 0);

      setGroupR((parsed & 0o040) !== 0);
      setGroupW((parsed & 0o020) !== 0);
      setGroupX((parsed & 0o010) !== 0);

      setOtherR((parsed & 0o004) !== 0);
      setOtherW((parsed & 0o002) !== 0);
      setOtherX((parsed & 0o001) !== 0);
    }
  };

  const applyPreset = (preset: number) => {
    syncFromNumeric(preset);
  };

  // Symbolic string preview (e.g. -rwxr-xr-x)
  const symbolicString = `${isDir ? 'd' : '-'}${userR ? 'r' : '-'}${userW ? 'w' : '-'}${userX ? 'x' : '-'}${groupR ? 'r' : '-'}${groupW ? 'w' : '-'}${groupX ? 'x' : '-'}${otherR ? 'r' : '-'}${otherW ? 'w' : '-'}${otherX ? 'x' : '-'}`;

  const handleSubmit = async () => {
    const clean = octalStr.replace(/^0+/, '') || '0';
    const mode = parseInt(clean, 8);
    if (isNaN(mode) || mode < 0 || mode > 0o777) {
      toast.error('Invalid octal permissions value (must be between 000 and 777)');
      return;
    }

    setIsSubmitting(true);
    try {
      await ChmodRemotePath(sessionId, itemPath, mode, recursive);
      toast.success(`Updated permissions for "${itemName}" to 0${mode.toString(8).padStart(3, '0')}`);
      onPermissionsUpdated();
      onOpenChange(false);
    } catch (err: any) {
      const formatted = formatErrorMessage(err, 'Chmod');
      toast.error(`${formatted.title}: ${formatted.message}`, {
        description: formatted.hint,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl p-0 select-none overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Edit Permissions (chmod)
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-sm">
                {itemPath}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Permission Matrix */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden text-xs">
            <div className="grid grid-cols-4 bg-zinc-100/70 dark:bg-zinc-900 px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 text-center">
              <span className="text-left">Target</span>
              <span>Read (4)</span>
              <span>Write (2)</span>
              <span>Execute (1)</span>
            </div>

            {/* Owner Row */}
            <div className="grid grid-cols-4 px-3 py-2.5 items-center border-b border-zinc-100 dark:border-zinc-900 text-center hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
              <span className="text-left font-medium text-zinc-800 dark:text-zinc-200">Owner / User</span>
              <label className="flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={userR}
                  onChange={(e) =>
                    handleCheckboxChange(e.target.checked, userW, userX, groupR, groupW, groupX, otherR, otherW, otherX)
                  }
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </label>
              <label className="flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={userW}
                  onChange={(e) =>
                    handleCheckboxChange(userR, e.target.checked, userX, groupR, groupW, groupX, otherR, otherW, otherX)
                  }
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </label>
              <label className="flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={userX}
                  onChange={(e) =>
                    handleCheckboxChange(userR, userW, e.target.checked, groupR, groupW, groupX, otherR, otherW, otherX)
                  }
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            {/* Group Row */}
            <div className="grid grid-cols-4 px-3 py-2.5 items-center border-b border-zinc-100 dark:border-zinc-900 text-center hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
              <span className="text-left font-medium text-zinc-800 dark:text-zinc-200">Group</span>
              <label className="flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupR}
                  onChange={(e) =>
                    handleCheckboxChange(userR, userW, userX, e.target.checked, groupW, groupX, otherR, otherW, otherX)
                  }
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </label>
              <label className="flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupW}
                  onChange={(e) =>
                    handleCheckboxChange(userR, userW, userX, groupR, e.target.checked, groupX, otherR, otherW, otherX)
                  }
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </label>
              <label className="flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupX}
                  onChange={(e) =>
                    handleCheckboxChange(userR, userW, userX, groupR, groupW, e.target.checked, otherR, otherW, otherX)
                  }
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            {/* Others Row */}
            <div className="grid grid-cols-4 px-3 py-2.5 items-center text-center hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
              <span className="text-left font-medium text-zinc-800 dark:text-zinc-200">Public / Others</span>
              <label className="flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={otherR}
                  onChange={(e) =>
                    handleCheckboxChange(userR, userW, userX, groupR, groupW, groupX, e.target.checked, otherW, otherX)
                  }
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </label>
              <label className="flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={otherW}
                  onChange={(e) =>
                    handleCheckboxChange(userR, userW, userX, groupR, groupW, groupX, otherR, e.target.checked, otherX)
                  }
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </label>
              <label className="flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={otherX}
                  onChange={(e) =>
                    handleCheckboxChange(userR, userW, userX, groupR, groupW, groupX, otherR, otherW, e.target.checked)
                  }
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Octal & Symbolic Representation */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 block mb-1">
                Octal Notation
              </label>
              <Input
                type="text"
                value={octalStr}
                onChange={(e) => handleOctalInput(e.target.value)}
                maxLength={4}
                className="h-8 font-mono text-center text-sm font-semibold tracking-widest bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 block mb-1">
                Symbolic Format
              </label>
              <div className="h-8 flex items-center justify-center font-mono text-xs font-semibold px-2 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 select-all">
                {symbolicString}
              </div>
            </div>
          </div>

          {/* Presets */}
          <div>
            <label className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 block mb-1.5">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(0o644)}
                className="text-xs h-6 px-2 cursor-pointer font-mono"
              >
                644 (Standard File)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(0o755)}
                className="text-xs h-6 px-2 cursor-pointer font-mono"
              >
                755 (Directory/Exec)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(0o600)}
                className="text-xs h-6 px-2 cursor-pointer font-mono"
              >
                600 (Private Key)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(0o777)}
                className="text-xs h-6 px-2 cursor-pointer font-mono"
              >
                777 (Full Access)
              </Button>
            </div>
          </div>

          {/* Recursive Option for Directories */}
          {isDir && (
            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recursive}
                  onChange={(e) => setRecursive(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Apply recursively to all contents and subdirectories</span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 px-3 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="text-xs h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Save Permissions
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
