"use client";

import React from "react";
import { SyncStatus, type SyncStatusProps } from "./SyncStatus";

type ListeningFooterProps = Omit<SyncStatusProps, "compact">;

/** System status line. The mini-player carries the same status while it shows. */
export const ListeningFooter: React.FC<ListeningFooterProps> = (props) => {
  return (
    <footer className="h-10 sm:h-11 md:h-12 flex items-center justify-between border-t border-[#1C1C1A] bg-[#080808] select-none mt-4 md:mt-3">
      <div />
      <div className="flex items-center font-mono text-[12px]">
        <SyncStatus {...props} />
      </div>
    </footer>
  );
};
