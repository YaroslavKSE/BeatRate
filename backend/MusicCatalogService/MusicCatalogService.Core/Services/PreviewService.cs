using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MusicCatalogService.Core.DTOs;
using MusicCatalogService.Core.Interfaces;
using MusicCatalogService.Core.Models.Spotify;

namespace MusicCatalogService.Core.Services;

public class PreviewService : IPreviewService
{
    private readonly ICatalogRepository _catalogRepository;
    private readonly ICacheService _cacheService;
    private readonly ISpotifyApiClient _spotifyApiClient;
    private readonly ILogger<PreviewService> _logger;
    private readonly SpotifySettings _spotifySettings;

    public PreviewService(
        ICatalogRepository catalogRepository,
        ICacheService cacheService,
        ISpotifyApiClient spotifyApiClient,
        ILogger<PreviewService> logger,
        IOptions<SpotifySettings> spotifySettings)
    {
        _catalogRepository = catalogRepository;
        _cacheService = cacheService;
        _spotifyApiClient = spotifyApiClient;
        _logger = logger;
        _spotifySettings = spotifySettings.Value;
    }

    public async Task<MultiTypePreviewResultDto> GetMultiTypePreviewItemsAsync(IEnumerable<string> spotifyIds,
        IEnumerable<string> types)
    {
        if (spotifyIds == null || !spotifyIds.Any())
            throw new ArgumentException("Spotify IDs cannot be null or empty", nameof(spotifyIds));

        if (types == null || !types.Any()) throw new ArgumentException("Types cannot be null or empty", nameof(types));

        // Validate types
        foreach (var type in types)
            if (type != "track" && type != "album" && type != "artist")
                throw new ArgumentException($"Invalid type: {type}. Must be 'track', 'album', or 'artist'",
                    nameof(types));

        var result = new MultiTypePreviewResultDto();
        var uniqueIds = spotifyIds.Distinct().ToList();
        var uniqueTypes = types.Distinct().ToList();

        try
        {
            // First try to get from cache
            var cacheKey = $"preview:multi:{string.Join(",", uniqueTypes)}:{string.Join(",", uniqueIds)}";
            var cachedResult = await _cacheService.GetAsync<MultiTypePreviewResultDto>(cacheKey);

            // Check if cached result exists AND contains all requested IDs
            var cacheComplete = false;
            if (cachedResult != null && cachedResult.Results.Any())
            {
                // Get all IDs from cached results
                var cachedIds = new HashSet<string>();
                foreach (var resultGroup in cachedResult.Results)
                foreach (var item in resultGroup.Items)
                    cachedIds.Add(item.SpotifyId);

                // Check if all requested IDs are in the cache
                cacheComplete = uniqueIds.All(id => cachedIds.Contains(id));

                if (cacheComplete)
                {
                    _logger.LogInformation(
                        "Complete multi-type preview items retrieved from cache, total count: {Count}",
                        cachedResult.TotalCount);
                    return cachedResult;
                }

                _logger.LogInformation(
                    "Incomplete cache result found ({CachedCount}/{RequestedCount} IDs). Fetching all data.",
                    cachedIds.Count, uniqueIds.Count);
            }

            // Not in cache or incomplete, process each type separately
            foreach (var type in uniqueTypes)
            {
                _logger.LogInformation("Processing type {Type} for {Count} IDs", type, uniqueIds.Count);

                // Get items for this type
                var typeItems = await GetItemsFromDatabaseAsync(uniqueIds, type);

                if (typeItems.Any())
                    result.Results.Add(new PreviewItemsResultDto
                    {
                        Type = type,
                        Items = typeItems
                    });
            }

            // Cache the results if we found anything
            if (result.Results.Any())
                await _cacheService.SetAsync(
                    cacheKey,
                    result,
                    TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

            _logger.LogInformation("Retrieved multi-type preview items, total count: {Count}", result.TotalCount);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving multi-type preview items");
            throw;
        }
    }

    private async Task<List<PreviewItemDto>> GetItemsFromDatabaseAsync(List<string> spotifyIds, string type)
    {
        var previewItems = new List<PreviewItemDto>();

        switch (type)
        {
            case "track":
                var tracks = await _catalogRepository.GetBatchTracksBySpotifyIdsAsync(spotifyIds);
                foreach (var track in tracks.Where(t => t != null))
                    previewItems.Add(new PreviewItemDto
                    {
                        SpotifyId = track.SpotifyId,
                        Name = track.Name,
                        ImageUrl = track.ThumbnailUrl,
                        ArtistName = track.ArtistName
                    });
                break;

            case "album":
                var albums = await _catalogRepository.GetBatchAlbumsBySpotifyIdsAsync(spotifyIds);
                foreach (var album in albums.Where(a => a != null))
                    previewItems.Add(new PreviewItemDto
                    {
                        SpotifyId = album.SpotifyId,
                        Name = album.Name,
                        ImageUrl = album.ThumbnailUrl,
                        ArtistName = album.ArtistName
                    });
                break;

            case "artist":
                var artists = await _catalogRepository.GetBatchArtistsBySpotifyIdsAsync(spotifyIds);
                foreach (var artist in artists.Where(a => a != null))
                    previewItems.Add(new PreviewItemDto
                    {
                        SpotifyId = artist.SpotifyId,
                        Name = artist.Name,
                        ImageUrl = artist.ThumbnailUrl,
                        ArtistName = artist.Name
                    });
                break;
        }

        return previewItems;
    }
}