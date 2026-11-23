import React from "react";
import type { ProfileTarget } from "@/lib/search-types";
import type { PlayerProfileLinks } from "./player-profile-links";

const LINK_CLASS =
  "bg-transparent border-0 p-0 font-[inherit] text-inherit cursor-pointer hover:text-music-accent focus-visible:outline-none focus-visible:text-music-accent";

const KIND_LABEL: Record<ProfileTarget["kind"], string> = {
  track: "Track",
  artist: "Artist",
  album: "Album",
};

function ProfileLink({
  label,
  target,
  onOpenProfile,
  className = "",
}: {
  label: string;
  target: ProfileTarget | null;
  onOpenProfile?: (target: ProfileTarget) => void;
  className?: string;
}) {
  if (!target || !onOpenProfile) return <span className={className}>{label}</span>;
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(target)}
      aria-label={`Open ${KIND_LABEL[target.kind]} profile: ${label}`}
      title={`Open ${KIND_LABEL[target.kind]} profile`}
      className={`${LINK_CLASS} ${className}`}
    >
      {label}
    </button>
  );
}

/** Track, Artist and Album lines on the player deck, each linking to its profile. */
export function PlayerTrackMeta({
  name,
  album,
  links,
  onOpenProfile,
}: {
  name: string;
  album: string;
  links: PlayerProfileLinks;
  onOpenProfile?: (target: ProfileTarget) => void;
}) {
  return (
    <>
      <div className="text-[16px] sm:text-[18px] text-[#EDEDE8] truncate font-bold mt-0.5">
        <ProfileLink
          label={name}
          target={links.track}
          onOpenProfile={onOpenProfile}
          className="max-w-full truncate text-left align-bottom"
        />
      </div>
      <div className="text-[13px] text-[#8A8A82] truncate mt-0.5">
        {links.artists.map((artist, index) => (
          <React.Fragment key={`${artist.name}-${index}`}>
            {index > 0 && ", "}
            <ProfileLink label={artist.name} target={artist.target} onOpenProfile={onOpenProfile} />
          </React.Fragment>
        ))}
      </div>
      <div className="text-[12px] text-[#5A5A55] truncate mt-0.5">
        <ProfileLink
          label={album}
          target={links.album}
          onOpenProfile={onOpenProfile}
          className="max-w-full truncate text-left align-bottom"
        />
      </div>
    </>
  );
}
