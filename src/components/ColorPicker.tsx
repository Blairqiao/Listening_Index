"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  HSV,
  PRESET_COLORS,
  hsvToHex,
  hexToHsv,
  isValidHex,
  normalizeHex,
} from "@/lib/color-utils";

interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
  className?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  className = "",
}) => {
  const normalizedColor = normalizeHex(color);
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(normalizedColor));
  const [hexInput, setHexInput] = useState<string>(() => normalizedColor.replace(/^#/, ""));

  // Ref to track latest HSV to avoid stale closures in window event listeners
  const hsvRef = useRef<HSV>(hsv);
  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  // Sync internal state when external color prop changes (e.g. from preset or parent reset)
  useEffect(() => {
    const currentHex = hsvToHex(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v);
    if (normalizedColor !== currentHex) {
      const newHsv = hexToHsv(normalizedColor);
      setHsv(newHsv);
      setHexInput(normalizedColor.replace(/^#/, ""));
    }
  }, [normalizedColor]);

  // Container refs for coordinate calculation
  const satValRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // 2D Saturation / Value (Brightness) Drag Handler
  // ---------------------------------------------------------------------------
  const updateSatValFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!satValRef.current) return;
      const rect = satValRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

      const s = Math.round((x / rect.width) * 100);
      const v = Math.round((1 - y / rect.height) * 100);

      const nextHsv = { ...hsvRef.current, s, v };
      setHsv(nextHsv);
      const hex = hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v);
      setHexInput(hex.replace(/^#/, ""));
      onChange(hex);
    },
    [onChange]
  );

  const handleSatValPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      updateSatValFromPointer(e.clientX, e.clientY);

      const onPointerMove = (moveEvent: PointerEvent) => {
        updateSatValFromPointer(moveEvent.clientX, moveEvent.clientY);
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [updateSatValFromPointer]
  );

  // ---------------------------------------------------------------------------
  // 1D Hue Spectrum Slider Drag Handler
  // ---------------------------------------------------------------------------
  const updateHueFromPointer = useCallback(
    (clientX: number) => {
      if (!hueRef.current) return;
      const rect = hueRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));

      let h = Math.round((x / rect.width) * 360);
      if (h >= 360) h = 0;

      const nextHsv = { ...hsvRef.current, h };
      setHsv(nextHsv);
      const hex = hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v);
      setHexInput(hex.replace(/^#/, ""));
      onChange(hex);
    },
    [onChange]
  );

  const handleHuePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      updateHueFromPointer(e.clientX);

      const onPointerMove = (moveEvent: PointerEvent) => {
        updateHueFromPointer(moveEvent.clientX);
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [updateHueFromPointer]
  );

  // ---------------------------------------------------------------------------
  // Manual Hex Input Handler
  // ---------------------------------------------------------------------------
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 8);
    setHexInput(rawVal.toUpperCase());

    if (rawVal.length === 3 || rawVal.length === 6 || rawVal.length === 8) {
      const fullHex = `#${rawVal}`;
      if (isValidHex(fullHex)) {
        const normalized = normalizeHex(fullHex);
        const newHsv = hexToHsv(normalized);
        setHsv(newHsv);
        onChange(normalized);
      }
    }
  };

  const handleHexInputBlur = () => {
    // If invalid or incomplete on blur, restore currently confirmed color
    const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);
    setHexInput(currentHex.replace(/^#/, ""));
  };

  // ---------------------------------------------------------------------------
  // Preset Swatch Selection
  // ---------------------------------------------------------------------------
  const handleSelectPreset = (presetHex: string) => {
    const normalized = normalizeHex(presetHex);
    const newHsv = hexToHsv(normalized);
    setHsv(newHsv);
    setHexInput(normalized.replace(/^#/, ""));
    onChange(normalized);
  };

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <div className={`flex flex-col gap-3.5 select-none ${className}`}>
      {/* 1. 2D Saturation / Value Grid (Photo-App Saturation-Brightness Plane) */}
      <div
        ref={satValRef}
        onPointerDown={handleSatValPointerDown}
        className="relative w-full h-44 sm:h-48 border border-[#26261F] cursor-crosshair touch-none overflow-hidden"
        style={{
          backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
          backgroundImage: `
            linear-gradient(to top, #000000 0%, transparent 100%),
            linear-gradient(to right, #FFFFFF 0%, transparent 100%)
          `,
        }}
        title="Click or drag to adjust Saturation and Brightness"
      >
        {/* Reticle / Crosshair handle */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-[0_0_2px_rgba(0,0,0,0.9),inset_0_0_1px_rgba(0,0,0,0.9)]"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: currentHex,
          }}
        />
      </div>

      {/* 2. 1D Hue Spectrum Slider Bar */}
      <div className="flex flex-col gap-1 py-1">
        <div
          ref={hueRef}
          onPointerDown={handleHuePointerDown}
          className="relative w-full h-3 sm:h-4 border border-[#26261F] cursor-ew-resize touch-none"
          style={{
            background:
              "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
          }}
          title="Click or drag to shift Hue"
        >
          {/* Thin precision indicator needle matching hardware tuner aesthetic */}
          <div
            className="absolute -top-1 -bottom-1 w-[2px] -translate-x-1/2 bg-[#EDEDE8] shadow-[0_0_0_1px_#080808,0_1px_3px_rgba(0,0,0,0.9)] pointer-events-none"
            style={{
              left: `${(hsv.h / 360) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* 3. Readout, Preview Swatch & Direct Hex Input */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        {/* Swatch preview */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 border border-[#26261F] shadow-inner flex-shrink-0"
            style={{ backgroundColor: currentHex }}
            title={`Active Accent: ${currentHex}`}
          />
          <div className="flex flex-col">
            <span className="font-mono text-[9px] tracking-[0.12em] text-[#6A6A64]">
              COLOR
            </span>
            <div className="flex items-center font-mono text-[13px] tracking-[0.08em] text-[#EDEDE8] bg-[#141413] border border-[#26261F] px-2 py-0.5">
              <span className="text-[#6A6A64] mr-1 select-none">#</span>
              <input
                type="text"
                value={hexInput}
                onChange={handleHexInputChange}
                onBlur={handleHexInputBlur}
                maxLength={8}
                spellCheck={false}
                className="w-16 bg-transparent border-0 text-[#EDEDE8] font-mono text-[13px] tracking-[0.08em] uppercase focus:outline-none"
                placeholder="76FF49"
              />
            </div>
          </div>
        </div>

        {/* HSV Coordinate Readout */}
        <div className="flex flex-col items-end">
          <span className="font-mono text-[9px] tracking-[0.12em] text-[#6A6A64]">
            COORDINATES
          </span>
          <span className="font-mono text-[11px] tracking-[0.06em] text-[#8A8A82]">
            H:{Math.round(hsv.h)}° S:{Math.round(hsv.s)}% V:{Math.round(hsv.v)}%
          </span>
        </div>
      </div>

      {/* 4. Curated Presets Palette */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="font-mono text-[9px] tracking-[0.14em] text-[#6A6A64] uppercase">
          [ PRESET COLORS ]
        </span>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5" role="group" aria-label="Color presets">
          {PRESET_COLORS.map((preset) => {
            const isSelected = normalizedColor === normalizeHex(preset.hex);
            return (
              <button
                key={preset.hex}
                type="button"
                onClick={() => handleSelectPreset(preset.hex)}
                title={`${preset.name} (${preset.hex})`}
                className={`h-6 w-full border cursor-pointer transition-transform hover:scale-105 focus:outline-none ${
                  isSelected
                    ? "border-white ring-1 ring-white"
                    : "border-[#26261F] hover:border-[#4A4A42]"
                }`}
                style={{ backgroundColor: preset.hex }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
