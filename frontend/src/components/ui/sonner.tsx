import React from 'react';
import { Toaster as Sonner, type ToasterProps as SonnerToasterProps } from 'sonner';
import { CheckCircle2, Info, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

export interface ToasterProps extends Omit<SonnerToasterProps, 'theme'> {
  theme?: 'light' | 'dark' | 'system';
}

export const Toaster: React.FC<ToasterProps> = ({
  theme = 'system',
  position = 'bottom-right',
  closeButton = true,
  richColors = true,
  ...props
}) => {
  const effectiveTheme =
    theme === 'system'
      ? typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'
      : theme;

  return (
    <Sonner
      theme={effectiveTheme}
      position={position}
      closeButton={closeButton}
      richColors={richColors}
      className="toaster group"
      icons={{
        success: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
        info: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
        error: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
        loading: <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast relative flex items-start gap-3 w-full p-4 pr-8 rounded-xl border font-sans text-xs shadow-xl backdrop-blur-md transition-all duration-200 select-none' +
            ' bg-white/95 text-zinc-900 border-zinc-200 shadow-zinc-950/5' +
            ' dark:bg-zinc-900/95 dark:text-zinc-100 dark:border-zinc-800 dark:shadow-black/40',
          title: 'text-xs font-semibold leading-snug text-zinc-900 dark:text-zinc-100',
          description: 'text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed font-normal',
          actionButton:
            'bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs cursor-pointer transition-colors shrink-0',
          cancelButton:
            'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium px-2.5 py-1 rounded-lg cursor-pointer transition-colors shrink-0',
          closeButton:
            'bg-transparent hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border-none transition-colors cursor-pointer rounded-lg p-1',
          success:
            'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/95 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 shadow-emerald-500/10',
          error:
            'border-rose-300 dark:border-rose-800/60 bg-rose-50/95 dark:bg-rose-950/70 text-rose-950 dark:text-rose-100 shadow-rose-500/10',
          warning:
            'border-amber-300 dark:border-amber-800/60 bg-amber-50/95 dark:bg-amber-950/70 text-amber-950 dark:text-amber-100 shadow-amber-500/10',
          info:
            'border-blue-300 dark:border-blue-800/60 bg-blue-50/95 dark:bg-blue-950/70 text-blue-950 dark:text-blue-100 shadow-blue-500/10',
        },
      }}
      {...props}
    />
  );
};
