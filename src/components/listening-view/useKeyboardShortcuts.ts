import { useEffect } from "react";
import type { Mode, RangeKey } from "@/lib/types";

export function getAllowedShortcutKeys(isAuthenticated: boolean): string[] {
  return isAuthenticated ? ["1", "2", "3", "4"] : ["1", "2", "3"];
}

export interface UseKeyboardShortcutsParams {
  activeMode: Mode;
  activeRange: RangeKey;
  rangeKeys: RangeKey[];
  handleSelectMode: (mode: Mode) => void;
  handleSelectRange: (range: RangeKey) => void;
  isSyncing: boolean;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  isUploadModalOpen: boolean;
  setIsUploadModalOpen: (open: boolean) => void;
  isUploadProcessing: boolean;
  isAuthenticated: boolean;
  isAdminLoginModalOpen: boolean;
  openAdminLoginModal: () => void;
  closeAdminLoginModal: () => void;
  isAdminSpotifyModalOpen: boolean;
  openAdminSpotifyModal: () => void;
  logout: () => void | Promise<void>;
}

export function useKeyboardShortcuts({
  activeMode,
  activeRange,
  rangeKeys,
  handleSelectMode,
  handleSelectRange,
  isSyncing,
  isModalOpen,
  openModal,
  closeModal,
  isUploadModalOpen,
  setIsUploadModalOpen,
  isUploadProcessing,
  isAuthenticated,
  isAdminLoginModalOpen,
  openAdminLoginModal,
  closeAdminLoginModal,
  isAdminSpotifyModalOpen,
  openAdminSpotifyModal,
  logout,
}: UseKeyboardShortcutsParams) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Suppress if syncing or inside input, textarea, or contentEditable
      if (
        isSyncing ||
        (document.activeElement &&
          (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) ||
            (document.activeElement as HTMLElement).isContentEditable))
      ) {
        return;
      }

      // If any modal is open, strictly isolate shortcut handling
      if (isUploadModalOpen || isModalOpen || isAdminLoginModalOpen || isAdminSpotifyModalOpen) {
        if (isAdminSpotifyModalOpen) {
          // Let AdminSpotifyModal manage its own Escape key behavior to preserve its !isBusy guard
          return;
        }
        if (isAdminLoginModalOpen && (e.key === "l" || e.key === "L" || e.key === "Escape")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          closeAdminLoginModal();
          return;
        }
        if (isUploadModalOpen && (e.key === "u" || e.key === "U")) {
          if (!isUploadProcessing) {
            e.preventDefault();
            e.stopImmediatePropagation();
            setIsUploadModalOpen(false);
          }
          return;
        }
        if (isModalOpen && (e.key === "c" || e.key === "C")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          closeModal();
          return;
        }
        // Block all other shortcut keys while a modal is active
        return;
      }

      // Keys 1-3 (or 1-4 for authenticated admin): Modes
      const allowedKeys = getAllowedShortcutKeys(isAuthenticated);
      if (allowedKeys.includes(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        const modeIndex = (parseInt(e.key, 10) - 1) as Mode;
        handleSelectMode(modeIndex);
        return;
      }

      // ArrowLeft / ArrowRight in Overview: Step range clamped at [0, rangeKeys.length - 1]
      if (activeMode === 0) {
        const currentIdx = rangeKeys.indexOf(activeRange);
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          if (currentIdx > 0) {
            handleSelectRange(rangeKeys[currentIdx - 1]);
          }
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          if (currentIdx < rangeKeys.length - 1) {
            handleSelectRange(rangeKeys[currentIdx + 1]);
          }
          return;
        }
      }

      // Key C: Open / Toggle config panel
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        e.stopImmediatePropagation();
        openModal();
        return;
      }

      // Key S: Open / Toggle Spotify connection modal (admin only)
      if ((e.key === "s" || e.key === "S") && isAuthenticated) {
        e.preventDefault();
        e.stopImmediatePropagation();
        openAdminSpotifyModal();
        return;
      }

      // Key U: Open / Toggle upload modal (admin only)
      if ((e.key === "u" || e.key === "U") && isAuthenticated) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIsUploadModalOpen(true);
        return;
      }

      // Key L: Toggle admin authentication modal / logout
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (isAuthenticated) {
          void logout();
        } else {
          openAdminLoginModal();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    activeMode,
    activeRange,
    rangeKeys,
    handleSelectMode,
    handleSelectRange,
    isSyncing,
    isModalOpen,
    openModal,
    closeModal,
    isUploadModalOpen,
    setIsUploadModalOpen,
    isUploadProcessing,
    isAuthenticated,
    isAdminLoginModalOpen,
    openAdminLoginModal,
    closeAdminLoginModal,
    isAdminSpotifyModalOpen,
    openAdminSpotifyModal,
    logout,
  ]);
}
