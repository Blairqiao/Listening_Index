export interface SideColumnSlice {
  artistOffset: number;
  artistLimit: number;
  albumOffset: number;
  albumLimit: number;
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
  const artistRows = Math.ceil(sideRows / 2);
  const albumRows = Math.floor(sideRows / 2);
  let artistOffset = 0;
  let albumOffset = 0;

  for (let currentPage = 1; currentPage <= page; currentPage += 1) {
    const artistsLeft = artistTotal - artistOffset;
    const albumsLeft = albumTotal - albumOffset;
    if (artistsLeft === 0 && albumsLeft === 0) break;

    let artistLimit = Math.min(artistRows, artistsLeft);
    let albumLimit = Math.min(albumRows, albumsLeft);
    const spareRows = sideRows - artistLimit - albumLimit;
    const extraArtistRows = Math.min(spareRows, artistsLeft - artistLimit);
    artistLimit += extraArtistRows;
    albumLimit += Math.min(spareRows - extraArtistRows, albumsLeft - albumLimit);

    // An empty group has no heading, so the other group can use that row.
    if (albumLimit === 0 && artistLimit > 0) artistLimit = Math.min(artistLimit + 1, artistsLeft);
    if (artistLimit === 0 && albumLimit > 0) albumLimit = Math.min(albumLimit + 1, albumsLeft);

    if (currentPage === page) return { artistOffset, artistLimit, albumOffset, albumLimit };

    artistOffset += artistLimit;
    albumOffset += albumLimit;
  }

  return { artistOffset, artistLimit: 0, albumOffset, albumLimit: 0 };
}
