import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

type ConfirmFunction = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmOptions>({});
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      if (typeof options === 'string') {
        setConfig({
          title: 'Confirmation',
          description: options,
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          variant: 'default',
        });
      } else {
        setConfig({
          title: options.title || 'Confirmation',
          description: options.description || 'Are you sure you want to proceed?',
          confirmText: options.confirmText || 'Confirm',
          cancelText: options.cancelText || 'Cancel',
          variant: options.variant || 'default',
        });
      }
      setIsOpen(true);
    });
  }, []);

  const handleClose = (result: boolean) => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
  };

  const isDestructive = config.variant === 'destructive';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(false); }}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-[420px] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl rounded-xl select-none"
        >
          <div className="p-4 flex items-start gap-3.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                isDestructive
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
              }`}
            >
              {isDestructive ? (
                <AlertTriangle className="w-5 h-5 stroke-[1.8]" />
              ) : (
                <HelpCircle className="w-5 h-5 stroke-[1.8]" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                {config.title}
              </h3>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed break-words">
                {config.description}
              </p>
            </div>
          </div>

          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleClose(false)}
              className="text-xs h-8 px-3 cursor-pointer"
            >
              {config.cancelText || 'Cancel'}
            </Button>
            <Button
              variant={isDestructive ? 'destructive' : 'default'}
              size="sm"
              onClick={() => handleClose(true)}
              className="text-xs h-8 px-3 cursor-pointer"
            >
              {config.confirmText || 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};
