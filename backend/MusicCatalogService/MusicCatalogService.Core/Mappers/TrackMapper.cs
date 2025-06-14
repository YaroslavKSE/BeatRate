using MusicCatalogService.Core.DTOs;
using MusicCatalogService.Core.Helpers;
using MusicCatalogService.Core.Models;
using MusicCatalogService.Core.Spotify;

namespace MusicCatalogService.Core.Mappers;

/// <summary>
/// Maps track data between different representations: Entity, DTO, and Spotify responses
/// </summary>
public static class TrackMapper
{
    /// <summary>
    /// Maps a Track entity to a TrackDetailDto
    /// </summary>
    /// <param name="track">The track entity from the database</param>
    /// <returns>A TrackDetailDto representation</returns>
    public static TrackDetailDto MapTrackEntityToDto(Track track)
    {
        // Create a list of artist DTOs
        var artistDtos = track.Artists.Select(a => new ArtistSummaryDto
        {
            SpotifyId = a.SpotifyId,
            Name = a.Name,
            ExternalUrls = a.SpotifyUrl != null ? new List<string> { a.SpotifyUrl } : null
        }).ToList();
    
        // Create image DTOs (we'll only have the thumbnail URL in the entity)
        var imageDtos = new List<ImageDto>();
        if (!string.IsNullOrEmpty(track.ThumbnailUrl))
        {
            imageDtos.Add(new ImageDto
            {
                Url = track.ThumbnailUrl,
                // These will be null since we only store the URL
                Height = null,
                Width = null
            });
        }
    
        // Create album DTO
        var albumDto = new AlbumSummaryDto
        {
            SpotifyId = track.AlbumId,
            Name = track.AlbumName,
            ArtistName = track.ArtistName,
            ReleaseDate = track.ReleaseDate,
            AlbumType = track.AlbumType,
            ImageUrl = track.ThumbnailUrl,
            ExternalUrls = track.SpotifyUrl != null ? new List<string> { track.SpotifyUrl } : null
        };

        // Create and return TrackDetailDto
        return new TrackDetailDto
        {
            CatalogItemId = track.Id,
            SpotifyId = track.SpotifyId,
            Name = track.Name,
            ArtistName = track.ArtistName,
            ImageUrl = track.ThumbnailUrl,
            Images = imageDtos,
            Popularity = track.Popularity,
            DurationMs = track.DurationMs,
            IsExplicit = track.IsExplicit,
            TrackNumber = track.TrackNumber,
            DiscNumber = track.DiscNumber,
            Isrc = track.Isrc,
            PreviewUrl = track.PreviewUrl,
            Artists = artistDtos,
            Album = albumDto,
            ExternalUrls = track.SpotifyUrl != null ? new List<string> { track.SpotifyUrl } : null
        };
    }

    /// <summary>
    /// Maps a Spotify track response to a TrackDetailDto
    /// </summary>
    /// <param name="track">The Spotify track response</param>
    /// <param name="catalogItemId">The internal catalog ID</param>
    /// <returns>A TrackDetailDto representation</returns>
    public static TrackDetailDto MapToTrackDetailDto(SpotifyTrackResponse track, Guid catalogItemId)
    {
        var artistSummaries = track.Artists.Select(artist => new ArtistSummaryDto
        {
            SpotifyId = artist.Id,
            Name = artist.Name,
            ExternalUrls = artist.ExternalUrls?.Spotify != null
                ? new List<string> {artist.ExternalUrls.Spotify}
                : null
        }).ToList();

        // Get primary artist
        var primaryArtist = track.Artists.FirstOrDefault()?.Name ?? "Unknown Artist";

        // Get thumbnail URL (optimized for 640x640)
        var thumbnailUrl = ImageHelper.GetOptimalImage(track.Album.Images);

        // Get all images
        var images = track.Album.Images.Select(img => new ImageDto
        {
            Url = img.Url,
            Height = img.Height,
            Width = img.Width
        }).ToList();

        var albumDto = new AlbumSummaryDto
        {
            SpotifyId = track.Album.Id,
            Name = track.Album.Name,
            ArtistName = primaryArtist,
            ReleaseDate = track.Album.ReleaseDate,
            AlbumType = track.Album.AlbumType,
            TotalTracks = track.Album.TotalTracks,
            ImageUrl = thumbnailUrl,
            Images = images,
            ExternalUrls = track.Album.ExternalUrls?.Spotify != null
                ? new List<string> {track.Album.ExternalUrls.Spotify}
                : null
        };

        return new TrackDetailDto
        {
            CatalogItemId = catalogItemId,
            SpotifyId = track.Id,
            Name = track.Name,
            ArtistName = primaryArtist,
            ImageUrl = thumbnailUrl,
            Images = images,
            Popularity = track.Popularity,
            DurationMs = track.DurationMs,
            IsExplicit = track.Explicit,
            TrackNumber = track.TrackNumber,
            DiscNumber = track.DiscNumber,
            Isrc = track.ExternalIds?.Isrc,
            PreviewUrl = track.PreviewUrl, // This will be updated by the service layer
            Artists = artistSummaries,
            Album = albumDto,
            ExternalUrls = track.ExternalUrls?.Spotify != null
                ? new List<string> {track.ExternalUrls.Spotify}
                : null
        };
    }

    /// <summary>
    /// Maps a Track entity to a TrackSummaryDto
    /// </summary>
    /// <param name="track">The track entity from the database</param>
    /// <returns>A TrackSummaryDto representation</returns>
    public static TrackSummaryDto MapToTrackSummaryDto(Track track)
    {
        return new TrackSummaryDto
        {
            CatalogItemId = track.Id,
            SpotifyId = track.SpotifyId,
            Name = track.Name,
            ArtistName = track.ArtistName,
            ImageUrl = track.ThumbnailUrl,
            DurationMs = track.DurationMs,
            IsExplicit = track.IsExplicit,
            TrackNumber = track.TrackNumber,
            AlbumId = track.AlbumId,
            Popularity = track.Popularity,
            PreviewUrl = track.PreviewUrl, // Now included in TrackSummaryDto
            ExternalUrls = track.SpotifyUrl != null ? new List<string> {track.SpotifyUrl} : null
        };
    }

    /// <summary>
    /// Maps a SpotifyTrackResponse to a Track entity
    /// </summary>
    /// <param name="spotifyTrack">The Spotify track response</param>
    /// <param name="existingTrack">Optional existing track to update</param>
    /// <returns>A Track entity</returns>
    public static Track MapToTrackEntity(SpotifyTrackResponse spotifyTrack, Track existingTrack = null)
    {
        var trackEntity = existingTrack ?? new Track
        {
            Id = Guid.NewGuid()
        };

        // Update all the properties
        trackEntity.SpotifyId = spotifyTrack.Id;
        trackEntity.Name = spotifyTrack.Name;
        trackEntity.ArtistName = spotifyTrack.Artists.FirstOrDefault()?.Name ?? "Unknown Artist";
        trackEntity.ThumbnailUrl = ImageHelper.GetOptimalImage(spotifyTrack.Album.Images);
        trackEntity.Popularity = spotifyTrack.Popularity;
        trackEntity.LastAccessed = DateTime.UtcNow;
        trackEntity.DurationMs = spotifyTrack.DurationMs;
        trackEntity.IsExplicit = spotifyTrack.Explicit;
        trackEntity.Isrc = spotifyTrack.ExternalIds?.Isrc;
        // PreviewUrl will be set by the service layer after extraction
        trackEntity.TrackNumber = spotifyTrack.TrackNumber;
        trackEntity.DiscNumber = spotifyTrack.DiscNumber;
        trackEntity.AlbumId = spotifyTrack.Album.Id;
        trackEntity.AlbumName = spotifyTrack.Album.Name;
        trackEntity.AlbumType = spotifyTrack.Album.AlbumType;
        trackEntity.ReleaseDate = spotifyTrack.Album.ReleaseDate;
        trackEntity.SpotifyUrl = spotifyTrack.ExternalUrls?.Spotify;
        trackEntity.Artists = spotifyTrack.Artists.Select(a => new SimplifiedArtist
        {
            SpotifyId = a.Id,
            Name = a.Name,
            SpotifyUrl = a.ExternalUrls?.Spotify
        }).ToList();

        return trackEntity;
    }

    /// <summary>
    /// Maps a SpotifyTrackResponse to a TrackSummaryDto (used for quick conversions)
    /// </summary>
    /// <param name="spotifyTrack">The Spotify track response</param>
    /// <param name="previewUrl">Optional extracted preview URL</param>
    /// <returns>A TrackSummaryDto representation</returns>
    public static TrackSummaryDto MapSpotifyTrackToSummaryDto(SpotifyTrackResponse spotifyTrack, string previewUrl = null)
    {
        return new TrackSummaryDto
        {
            SpotifyId = spotifyTrack.Id,
            Name = spotifyTrack.Name,
            ArtistName = spotifyTrack.Artists.FirstOrDefault()?.Name ?? "Unknown Artist",
            ImageUrl = ImageHelper.GetOptimalImage(spotifyTrack.Album?.Images),
            DurationMs = spotifyTrack.DurationMs,
            IsExplicit = spotifyTrack.Explicit,
            TrackNumber = spotifyTrack.TrackNumber,
            AlbumId = spotifyTrack.Album?.Id,
            Popularity = spotifyTrack.Popularity,
            PreviewUrl = previewUrl, // Include extracted preview URL
            ExternalUrls = spotifyTrack.ExternalUrls?.Spotify != null ? new List<string> {spotifyTrack.ExternalUrls.Spotify} : null
        };
    }
}