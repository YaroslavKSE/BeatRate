using MusicCatalogService.Core.DTOs;
using MusicCatalogService.Core.Helpers;
using MusicCatalogService.Core.Models;
using MusicCatalogService.Core.Spotify;

namespace MusicCatalogService.Core.Mappers;

/// <summary>
/// Maps album data between different representations: Entity, DTO, and Spotify responses
/// </summary>
public static class AlbumMapper
{
    /// <summary>
    /// Maps an Album entity to an AlbumDetailDto
    /// </summary>
    /// <param name="album">The album entity from the database</param>
    /// <returns>An AlbumDetailDto representation</returns>
    public static AlbumDetailDto MapAlbumEntityToDto(Album album)
    {
        // Create a list of artist DTOs
        var artistDtos = album.Artists.Select(a => new ArtistSummaryDto
        {
            SpotifyId = a.SpotifyId,
            Name = a.Name,
            ExternalUrls = a.SpotifyUrl != null ? new List<string> { a.SpotifyUrl } : null
        }).ToList();
        
        // Create image DTOs (we'll only have the thumbnail URL in the entity)
        var imageDtos = new List<ImageDto>();
        if (!string.IsNullOrEmpty(album.ThumbnailUrl))
        {
            imageDtos.Add(new ImageDto
            {
                Url = album.ThumbnailUrl,
                // These will be null since we only store the URL
                Height = null,
                Width = null
            });
        }
        
        // Create a simple track list (if we have track IDs available)
        var trackDtos = new List<TrackSummaryDto>();
        
        // Create the AlbumDetailDto
        return new AlbumDetailDto
        {
            CatalogItemId = album.Id,
            SpotifyId = album.SpotifyId,
            Name = album.Name,
            ArtistName = album.ArtistName,
            ImageUrl = album.ThumbnailUrl,
            Images = imageDtos,
            Popularity = album.Popularity,
            ReleaseDate = album.ReleaseDate,
            ReleaseDatePrecision = album.ReleaseDatePrecision,
            AlbumType = album.AlbumType,
            TotalTracks = album.TotalTracks,
            Label = album.Label,
            Copyright = album.Copyright,
            Artists = artistDtos,
            Tracks = trackDtos,
            ExternalUrls = album.SpotifyUrl != null ? new List<string> { album.SpotifyUrl } : null
        };
    }

    /// <summary>
    /// Maps a Spotify album response to an AlbumDetailDto
    /// </summary>
    /// <param name="album">The Spotify album response</param>
    /// <param name="catalogItemId">The internal catalog ID</param>
    /// <returns>An AlbumDetailDto representation</returns>
    public static AlbumDetailDto MapToAlbumDetailDto(SpotifyAlbumResponse album, Guid catalogItemId)
    {
        // Get all artists
        var artistSummaries = album.Artists.Select(artist => new ArtistSummaryDto
        {
            SpotifyId = artist.Id,
            Name = artist.Name,
            ExternalUrls = artist.ExternalUrls?.Spotify != null
                ? new List<string> {artist.ExternalUrls.Spotify}
                : null
        }).ToList();

        // Get primary artist
        var primaryArtist = album.Artists.FirstOrDefault()?.Name ?? "Unknown Artist";

        // Get thumbnail URL (optimized for 640x640)
        var thumbnailUrl = ImageHelper.GetOptimalImage(album.Images);

        // Get all images (we'll still provide all available sizes in the DTO)
        var images = album.Images.Select(img => new ImageDto
        {
            Url = img.Url,
            Height = img.Height,
            Width = img.Width
        }).ToList();

        // Map tracks if available
        var tracks = new List<TrackSummaryDto>();
        if (album.Tracks?.Items != null)
            tracks = album.Tracks.Items.Select(track => new TrackSummaryDto
            {
                SpotifyId = track.Id,
                Name = track.Name,
                ArtistName = track.Artists.FirstOrDefault()?.Name ?? "Unknown Artist",
                DurationMs = track.DurationMs,
                IsExplicit = track.Explicit,
                TrackNumber = track.TrackNumber,
                PreviewUrl = null, // Will be populated by service layer
                ExternalUrls = track.ExternalUrls?.Spotify != null
                    ? new List<string> {track.ExternalUrls.Spotify}
                    : null
            }).ToList();

        return new AlbumDetailDto
        {
            CatalogItemId = catalogItemId,
            SpotifyId = album.Id,
            Name = album.Name,
            ArtistName = primaryArtist,
            ImageUrl = thumbnailUrl,
            Images = images,
            Popularity = album.Popularity,
            ReleaseDate = album.ReleaseDate,
            ReleaseDatePrecision = album.ReleaseDatePrecision,
            AlbumType = album.AlbumType,
            TotalTracks = album.TotalTracks,
            Label = album.Label,
            Copyright = album.Copyright,
            Artists = artistSummaries,
            Tracks = tracks,
            ExternalUrls = album.ExternalUrls?.Spotify != null
                ? new List<string> {album.ExternalUrls.Spotify}
                : null
        };
    }

    /// <summary>
    /// Maps an Album entity to an AlbumSummaryDto
    /// </summary>
    /// <param name="album">The album entity from the database</param>
    /// <returns>An AlbumSummaryDto representation</returns>
    public static AlbumSummaryDto MapToAlbumSummaryDto(Album album)
    {
        return new AlbumSummaryDto
        {
            CatalogItemId = album.Id,
            SpotifyId = album.SpotifyId,
            Name = album.Name,
            ArtistName = album.ArtistName,
            ImageUrl = album.ThumbnailUrl,
            ReleaseDate = album.ReleaseDate,
            AlbumType = album.AlbumType,
            TotalTracks = album.TotalTracks,
            Popularity = album.Popularity,
            ExternalUrls = album.SpotifyUrl != null ? new List<string> { album.SpotifyUrl } : null
        };
    }

    /// <summary>
    /// Maps AlbumTracks from Spotify to an AlbumTracksResultDto
    /// </summary>
    public static AlbumTracksResultDto MapToAlbumTracksResultDto(
        SpotifyPagingObject<SpotifyTrackSimplified> response,
        string albumId,
        string albumName,
        int limit,
        int offset)
    {
        var result = new AlbumTracksResultDto
        {
            AlbumId = albumId,
            AlbumName = albumName,
            Limit = limit,
            Offset = offset,
            TotalResults = response.Total,
            Next = response.Next,
            Previous = response.Previous
        };

        // Map tracks
        if (response.Items != null)
        {
            result.Tracks = response.Items.Select(track => new TrackSummaryDto
            {
                SpotifyId = track.Id,
                Name = track.Name,
                ArtistName = track.Artists.FirstOrDefault()?.Name ?? "Unknown Artist",
                DurationMs = track.DurationMs,
                IsExplicit = track.Explicit,
                TrackNumber = track.TrackNumber,
                AlbumId = albumId,
                PreviewUrl = null, // Will be populated by service layer
                ExternalUrls = track.ExternalUrls?.Spotify != null ? new List<string> { track.ExternalUrls.Spotify } : null
            }).ToList();
        }

        return result;
    }

    /// <summary>
    /// Maps a SpotifyAlbumResponse to an Album entity
    /// </summary>
    /// <param name="spotifyAlbum">The Spotify album response</param>
    /// <param name="existingAlbum">Optional existing album to update</param>
    /// <returns>An Album entity</returns>
    public static Album MapToAlbumEntity(SpotifyAlbumResponse spotifyAlbum, Album existingAlbum = null)
    {
        var albumEntity = existingAlbum ?? new Album
        {
            Id = Guid.NewGuid()
        };

        // Update all the properties
        albumEntity.SpotifyId = spotifyAlbum.Id;
        albumEntity.Name = spotifyAlbum.Name;
        albumEntity.ArtistName = spotifyAlbum.Artists.FirstOrDefault()?.Name ?? "Unknown Artist";
        albumEntity.ThumbnailUrl = ImageHelper.GetOptimalImage(spotifyAlbum.Images);
        albumEntity.Popularity = spotifyAlbum.Popularity;
        albumEntity.LastAccessed = DateTime.UtcNow;
        albumEntity.ReleaseDate = spotifyAlbum.ReleaseDate;
        albumEntity.ReleaseDatePrecision = spotifyAlbum.ReleaseDatePrecision;
        albumEntity.AlbumType = spotifyAlbum.AlbumType;
        albumEntity.TotalTracks = spotifyAlbum.TotalTracks;
        albumEntity.Label = spotifyAlbum.Label;
        albumEntity.Copyright = spotifyAlbum.Copyright;
        albumEntity.SpotifyUrl = spotifyAlbum.ExternalUrls?.Spotify;
        albumEntity.Artists = spotifyAlbum.Artists.Select(a => new SimplifiedArtist
        {
            SpotifyId = a.Id,
            Name = a.Name,
            SpotifyUrl = a.ExternalUrls?.Spotify
        }).ToList();
        albumEntity.TrackIds = spotifyAlbum.Tracks?.Items?.Select(t => t.Id).ToList() ?? new List<string>();

        return albumEntity;
    }
}