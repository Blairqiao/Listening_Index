import React from "react";
import { Copy, Check, Loader2 } from "lucide-react";

export interface ScheduledSyncCardProps {
  displaySyncUrl: string;
  placeholderSyncUrl: string;
  hasValidSyncKey: boolean;
  copiedSyncUrl: boolean;
  isBusy: boolean;
  isRegeneratingKey: boolean;
  onCopySyncUrl: () => void;
  onRegenerateSyncKey: () => void;
  accentColorClass?: string;
  focusBorderClass?: string;
  hoverColorClass?: string;
}

export const ScheduledSyncCard: React.FC<ScheduledSyncCardProps> = ({
  displaySyncUrl,
  placeholderSyncUrl,
  hasValidSyncKey,
  copiedSyncUrl,
  isBusy,
  isRegeneratingKey,
  onCopySyncUrl,
  onRegenerateSyncKey,
  accentColorClass = "text-music-accent",
  focusBorderClass = "focus-within:border-music-accent",
  hoverColorClass = "hover:text-music-accent",
}) => {
  return (
    <div className="pt-3 border-t border-[#1F1F1A] space-y-2.5">
      <div className="flex items-center justify-between font-mono text-[11px] text-[#6A6A64]">
        <span>Scheduled sync (cron)</span>
        <button
          type="button"
          onClick={onRegenerateSyncKey}
          disabled={isBusy || isRegeneratingKey}
          className="text-[#6A6A64] hover:text-[#EDEDE8] transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
          title="Regenerate scheduled sync key"
        >
          {isRegeneratingKey ? (
            <>
              <Loader2 className={`w-3.5 h-3.5 animate-spin ${accentColorClass}`} />
              <span>Rotating...</span>
            </>
          ) : (
            <span>Regenerate</span>
          )}
        </button>
      </div>

      <div className={`flex items-center bg-[#141413] border border-[#26261F] ${focusBorderClass}`}>
        <code className={`flex-1 font-mono text-[12px] ${accentColorClass} px-3 py-2 overflow-x-auto whitespace-nowrap select-all scrollbar-hidden`}>
          {displaySyncUrl || placeholderSyncUrl}
        </code>
        <button
          type="button"
          onClick={onCopySyncUrl}
          disabled={!hasValidSyncKey || isBusy || isRegeneratingKey}
          className={`px-3 py-2 border-l border-[#26261F] font-mono text-[11px] text-[#EDEDE8] ${hoverColorClass} hover:bg-[#1A1A18] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-40`}
          title="Copy Scheduled Sync URL"
        >
          {copiedSyncUrl ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-bold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy URL</span>
            </>
          )}
        </button>
      </div>

      <div className="font-mono text-[11px] text-[#6A6A64] leading-relaxed">
        Scheduled sync URL for cron-job.org or Vercel Cron every 30 minutes.
      </div>
    </div>
  );
};
