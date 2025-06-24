using Microsoft.Extensions.Logging;
using MusicCatalogService.Core.DTOs;
using MusicCatalogService.Core.Interfaces;
using MusicCatalogService.Core.Models.Spotify;
using MusicCatalogService.Core.Spotify;

namespace MusicCatalogService.Core.Services;

public class SearchService : ISearchService
{
    private readonly ISpotifyApiClient _spotifyApiClient;
    private readonly ILocalSearchRepository _localSearchRepository;
    private readonly ICacheService _cacheService;
    private readonly ILogger<SearchService> _logger;

    public SearchService(
        ISpotifyApiClient spotifyApiClient,
        ILocalSearchRepository localSearchRepository,
        ICacheService cacheService,
        ILogger<SearchService> logger)
    {
        _spotifyApiClient = spotifyApiClient;
        _localSearchRepository = localSearchRepository;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<SearchResultDto> SearchAsync(string query, string type, int limit = 20, int offset = 0,
        string? market = null)
    {
        // Validate parameters
        if (string.IsNullOrWhiteSpace(query))
            throw new ArgumentException("Search query cannot be empty", nameof(query));

        if (string.IsNullOrWhiteSpace(type))
            throw new ArgumentException("Search type cannot be empty", nameof(type));

        // Ensure limit is within acceptable range
        limit = Math.Clamp(limit, 1, 50);

        // Generate cache key based on search parameters
        var cacheKey = $"search:{query}:{type}:{limit}:{offset}:{market ?? "none"}";

        // Try to get from cache first
        var cachedResult = await _cacheService.GetAsync<SearchResultDto>(cacheKey);
        if (cachedResult != null)
        {
            _logger.LogInformation("Search results for query '{Query}' retrieved from cache", query);
            return cachedResult;
        }

        // Try Spotify API first
        try
        {
            // Attempt to search via Spotify API
            var searchResponse = await _spotifyApiClient.SearchAsync(query, type, limit, offset);

            if (searchResponse != null)
            {
                // If Spotify API returns results, process and cache them
                var result = MapToSearchResultDto(searchResponse, query, type, limit, offset);

                // Cache the result for a short period 
                await _cacheService.SetAsync(cacheKey, result, TimeSpan.FromMinutes(5));

                return result;
            }
        }
        catch (Exception ex)
        {
            // Log the Spotify API error but continue to local search
            _logger.LogWarning(ex, "Spotify API search failed. Falling back to local catalog search.");
        }

        // Fallback to local catalog search
        _logger.LogInformation("Performing local catalog search for query '{Query}'", query);
        var localResult = await _localSearchRepository.SearchLocalCatalogAsync(query, type, limit, offset);

        // Cache local results as well
        await _cacheService.SetAsync(cacheKey, localResult, TimeSpan.FromMinutes(5));

        return localResult;
    }

    private SearchResultDto MapToSearchResultDto(SpotifySearchResponse response, string query, string type, int limit,
        int offset)
    {
        var result = new SearchResultDto
        {
            Query = query,
            Type = type,
            Limit = limit,
            Offset = offset,
            TotalResults = 0
        };

        // Helper method to get optimal image
        string GetOptimalImage(List<SpotifyImage> images)
        {
            if (images == null || !images.Any())
                return null;

            // Try to find a 640x640 image
            var optimalImage = images.FirstOrDefault(img => img.Width == 640 && img.Height == 640);

            // If no 640x640 image exists, take the largest available
            if (optimalImage == null) optimalImage = images.OrderByDescending(img => img.Width * img.Height).First();

            return optimalImage.Url;
        }

        // Map albums if present
        if (response.Albums != null)
        {
            result.Albums = response.Albums.Items.Select(album => new AlbumSummaryDto
            {
                SpotifyId = album.Id,
                Name = album.Name,
                ArtistName = album.Artists.FirstOrDefault()?.Name ?? "Unknown Artist",
                ReleaseDate = album.ReleaseDate,
                AlbumType = album.AlbumType,
                TotalTracks = album.TotalTracks,
                ImageUrl = GetOptimalImage(album.Images),
                Images = album.Images.Select(img => new ImageDto
                {
                    Url = img.Url,
                    Height = img.Height,
                    Width = img.Width
                }).ToList(),
                ExternalUrls = album.ExternalUrls != null ? new List<string> {album.ExternalUrls.Spotify} : null
            }).ToList();

            result.TotalResults += response.Albums.Total;
        }

        // Map artists if present
        if (response.Artists != null)
        {
            result.Artists = response.Artists.Items.Select(artist => new ArtistSummaryDto
            {
                SpotifyId = artist.Id,
                Name = artist.Name,
                Popularity = artist.Popularity,
                ImageUrl = GetOptimalImage(artist.Images),
                Images = artist.Images?.Select(img => new ImageDto
                {
                    Url = img.Url,
                    Height = img.Height,
                    Width = img.Width
                }).ToList() ?? new List<ImageDto>(),
                ExternalUrls = artist.ExternalUrls != null ? new List<string> {artist.ExternalUrls.Spotify} : null
            }).ToList();

            result.TotalResults += response.Artists.Total;
        }

        // Map tracks if present
        if (response.Tracks != null)
        {
            result.Tracks = response.Tracks.Items.Select(track => new TrackSummaryDto
            {
                SpotifyId = track.Id,
                Name = track.Name,
                ArtistName = track.Artists.FirstOrDefault()?.Name ?? "Unknown Artist",
                DurationMs = track.DurationMs,
                IsExplicit = track.Explicit,
                TrackNumber = track.TrackNumber,
                AlbumId = track.Album.Id,
                ImageUrl = GetOptimalImage(track.Album?.Images),
                Images = track.Album?.Images.Select(img => new ImageDto
                {
                    Url = img.Url,
                    Height = img.Height,
                    Width = img.Width
                }).ToList() ?? new List<ImageDto>(),
                Popularity = track.Popularity,
                ExternalUrls = track.ExternalUrls != null ? new List<string> {track.ExternalUrls.Spotify} : null
            }).ToList();

            result.TotalResults += response.Tracks.Total;
        }

        return result;
    }

    public async Task<NewReleasesResultDto> GetNewReleasesAsync(int limit = 20, int offset = 0, string? market = null)
    {
        // Ensure limit is within acceptable range
        limit = Math.Clamp(limit, 1, 50);

        // Generate cache key based on parameters
        var cacheKey = $"new-releases:{limit}:{offset}:{market ?? "none"}";

        // Try to get from cache first
        var cachedResult = await _cacheService.GetAsync<NewReleasesResultDto>(cacheKey);
        if (cachedResult != null)
        {
            _logger.LogInformation("New releases results retrieved from cache");
            return cachedResult;
        }

        // Fetch new releases via Spotify API
        _logger.LogInformation("Fetching new releases with limit {Limit} and offset {Offset}", limit, offset);
        var newReleasesResponse = await _spotifyApiClient.GetNewReleasesAsync(limit, offset);

        if (newReleasesResponse == null || newReleasesResponse.Albums == null)
        {
            _logger.LogWarning("No new releases found or empty response");
            return new NewReleasesResultDto
            {
                Limit = limit,
                Offset = offset,
                TotalResults = 0
            };
        }

        // Map the response to our DTO
        var result = MapToNewReleasesResultDto(newReleasesResponse, limit, offset);

        // Cache the result for a day
        await _cacheService.SetAsync(cacheKey, result, TimeSpan.FromHours(24));

        return result;
    }

    private NewReleasesResultDto MapToNewReleasesResultDto(SpotifyNewReleasesResponse response, int limit, int offset)
    {
        var result = new NewReleasesResultDto
        {
            Limit = limit,
            Offset = offset,
            TotalResults = response.Albums?.Total ?? 0,
            Next = response.Albums?.Next,
            Previous = response.Albums?.Previous
        };

        // Helper method to get optimal image
        string GetOptimalImage(List<SpotifyImage> images)
        {
            if (images == null || !images.Any())
                return null;

            // Try to find a 640x640 image
            var optimalImage = images.FirstOrDefault(img => img.Width == 640 && img.Height == 640);

            // If no 640x640 image exists, take the largest available
            if (optimalImage == null) optimalImage = images.OrderByDescending(img => img.Width * img.Height).First();

            return optimalImage.Url;
        }

        // Map albums
        if (response.Albums?.Items != null)
            result.Albums = response.Albums.Items.Select(album => new AlbumSummaryDto
            {
                SpotifyId = album.Id,
                Name = album.Name,
                ArtistName = album.Artists.FirstOrDefault()?.Name ?? "Unknown Artist",
                ReleaseDate = album.ReleaseDate,
                AlbumType = album.AlbumType,
                TotalTracks = album.TotalTracks,
                ImageUrl = GetOptimalImage(album.Images),
                Images = album.Images.Select(img => new ImageDto
                {
                    Url = img.Url,
                    Height = img.Height,
                    Width = img.Width
                }).ToList(),
                ExternalUrls = album.ExternalUrls != null ? new List<string> {album.ExternalUrls.Spotify} : null
            }).ToList();

        return result;
    }
}