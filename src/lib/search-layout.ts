import {
  SEARCH_SIDE_ROWS,
  SEARCH_SINGLE_TYPE_ROWS,
  SEARCH_TRACK_ROWS,
  type SearchFilter,
} from "./search-types";

export interface SideColumnSlice {
  artistOffset: number;
  artistLimit: number;
  albumOffset: number;
  albumLimit: number;
}

function allocateSideStep({
  artistsLeft,
  albumsLeft,
  sideRows,
}: {
  artistsLeft: number;
  albumsLeft: number;
  sideRows: number;
}): { artistLimit: number; albumLimit: number } {
  const artistRows = Math.ceil(sideRows / 2);
  const albumRows = Math.floor(sideRows / 2);

  let artistLimit = Math.min(artistRows, artistsLeft);
  let albumLimit = Math.min(albumRows, albumsLeft);
  const spareRows = sideRows - artistLimit - albumLimit;
  const extraArtistRows = Math.min(spareRows, artistsLeft - artistLimit);
  artistLimit += extraArtistRows;
  albumLimit += Math.min(spareRows - extraArtistRows, albumsLeft - albumLimit);

  // An empty group has no heading, so the other group can use that row.
  if (albumLimit === 0 && artistLimit > 0) artistLimit = Math.min(artistLimit + 1, artistsLeft);
  if (artistLimit === 0 && albumLimit > 0) albumLimit = Math.min(albumLimit + 1, albumsLeft);

  return { artistLimit, albumLimit };
}

export function planSideColumn({
  artistTotal,
  albumTotal,
  sideRows,
  page,
}: {
  artistTotal: number;
  albumTotal: number;
  sideRows: number;
  page: number;
}): SideColumnSlice {
  let artistOffset = 0;
  let albumOffset = 0;

  for (let currentPage = 1; currentPage <= page; currentPage += 1) {
    const artistsLeft = artistTotal - artistOffset;
    const albumsLeft = albumTotal - albumOffset;
    if (artistsLeft === 0 && albumsLeft === 0) break;

    const { artistLimit, albumLimit } = allocateSideStep({ artistsLeft, albumsLeft, sideRows });

    if (currentPage === page) return { artistOffset, artistLimit, albumOffset, albumLimit };

    artistOffset += artistLimit;
    albumOffset += albumLimit;
  }

  return { artistOffset, artistLimit: 0, albumOffset, albumLimit: 0 };
}

function countSidePages({
  artistTotal,
  albumTotal,
  sideRows,
}: {
  artistTotal: number;
  albumTotal: number;
  sideRows: number;
}): number {
  let pages = 0;
  let artistOffset = 0;
  let albumOffset = 0;

  while (true) {
    const artistsLeft = artistTotal - artistOffset;
    const albumsLeft = albumTotal - albumOffset;
    if (artistsLeft === 0 && albumsLeft === 0) break;

    const { artistLimit, albumLimit } = allocateSideStep({ artistsLeft, albumsLeft, sideRows });
    if (artistLimit === 0 && albumLimit === 0) break;

    pages += 1;
    artistOffset += artistLimit;
    albumOffset += albumLimit;
  }

  return pages;
}

export function computeSearchTotalPages({
  filter,
  trackTotal,
  artistTotal,
  albumTotal,
}: {
  filter: SearchFilter;
  trackTotal: number;
  artistTotal: number;
  albumTotal: number;
}): number {
  if (filter === "tracks") {
    return Math.max(1, Math.ceil(trackTotal / SEARCH_SINGLE_TYPE_ROWS));
  }
  if (filter === "artists") {
    return Math.max(1, Math.ceil(artistTotal / SEARCH_SINGLE_TYPE_ROWS));
  }
  if (filter === "albums") {
    return Math.max(1, Math.ceil(albumTotal / SEARCH_SINGLE_TYPE_ROWS));
  }

  const sidePages = countSidePages({
    artistTotal,
    albumTotal,
    sideRows: SEARCH_SIDE_ROWS,
  });

  return Math.max(1, Math.ceil(trackTotal / SEARCH_TRACK_ROWS), sidePages);
}
