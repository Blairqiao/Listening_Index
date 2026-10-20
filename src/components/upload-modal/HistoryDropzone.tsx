"use client";

import React, { useState } from "react";
import { Upload, FileArchive } from "lucide-react";

export interface HistoryDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

export const HistoryDropzone: React.FC<HistoryDropzoneProps> = ({
  onFilesSelected,
  isProcessing,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed p-8 sm:p-10 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 select-none ${
          isDragOver
            ? "border-music-accent bg-music-accent/5 text-music-accent"
            : "border-[#26261F] hover:border-[#3A3A32] bg-[#0F0F0E]"
        }`}
        onClick={() => document.getElementById("spotify-history-input")?.click()}
      >
        <input
          id="spotify-history-input"
          type="file"
          multiple
          accept=".zip,.json"
          className="hidden"
          onChange={handleFileInput}
        />
        <div className="w-10 h-10 border border-[#26261F] flex items-center justify-center bg-[#141413]">
          <Upload className="w-5 h-5 text-music-accent" />
        </div>
        <div>
          <p className="text-[12px] font-bold text-[#EDEDE8] uppercase tracking-[0.08em]">
            Click or drop Spotify history files here
          </p>
          <p className="text-[#6A6A64] text-[10px] mt-1">
            Accepts official Spotify export <code className="text-[#A8A8A2]">.zip</code> or raw{" "}
            <code className="text-[#A8A8A2]">Streaming_History_Audio_*.json</code> files
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="border border-[#1C1C1A] bg-[#0E0E0D] p-3 text-[#6A6A64] text-[10px] space-y-1.5">
        <div className="flex items-center gap-1.5 text-[#EDEDE8] font-bold uppercase tracking-[0.08em]">
          <FileArchive className="w-3.5 h-3.5 text-music-accent" />
          <span>How to request your export from Spotify</span>
        </div>
        <p>
          1. Visit{" "}
          <a
            href="https://www.spotify.com/account/privacy/"
            target="_blank"
            rel="noreferrer"
            className="text-music-accent underline underline-offset-2 hover:opacity-80"
          >
            spotify.com/account/privacy
          </a>
          .
        </p>
        <p>
          2. Select <strong className="text-[#EDEDE8]">Extended streaming history</strong> and
          request download.
        </p>
        <p>
          3. Upload the resulting <code className="text-music-accent">.zip</code> or JSON files directly above.
        </p>
      </div>
    </div>
  );
};
