namespace MusicCatalogService.Core.Interfaces;

public interface ISpotifyPreviewExtractor
{
    /// <summary>
    /// Get preview URL for a single track by fetching and parsing Spotify embed page
    /// </summary>
    /// <param name="spotifyTrackId">Spotify track ID</param>
    /// <returns>Preview URL if found, null otherwise</returns>
    Task<string?> GetTrackPreviewUrlAsync(string spotifyTrackId);

    /// <summary>
    /// Get preview URLs for all tracks in an album by fetching and parsing Spotify embed page
    /// </summary>
    /// <param name="spotifyAlbumId">Spotify album ID</param>
    /// <returns>List of preview URLs if found, null or empty list otherwise</returns>
    Task<List<string>?> GetAlbumPreviewUrlsAsync(string spotifyAlbumId);
}