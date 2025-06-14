using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MusicCatalogService.Core.DTOs;
using MusicCatalogService.Core.Interfaces;
using MusicCatalogService.Core.Mappers;
using MusicCatalogService.Core.Models;
using MusicCatalogService.Core.Models.Spotify;

namespace MusicCatalogService.Core.Services;

public class AlbumService : IAlbumService
{
    private readonly ISpotifyApiClient _spotifyApiClient;
    private readonly ICatalogRepository _catalogRepository;
    private readonly ICacheService _cacheService;
    private readonly ISpotifyPreviewExtractor _previewExtractor;
    private readonly ILogger<AlbumService> _logger;
    private readonly SpotifySettings _spotifySettings;

    public AlbumService(
        ISpotifyApiClient spotifyApiClient,
        ICatalogRepository catalogRepository,
        ICacheService cacheService,
        ISpotifyPreviewExtractor previewExtractor,
        ILogger<AlbumService> logger,
        IOptions<SpotifySettings> spotifySettings)
    {
        _spotifyApiClient = spotifyApiClient;
        _catalogRepository = catalogRepository;
        _cacheService = cacheService;
        _previewExtractor = previewExtractor;
        _logger = logger;
        _spotifySettings = spotifySettings.Value;
    }

    // Get album from Spotify or cache
    public async Task<AlbumDetailDto> GetAlbumAsync(string spotifyId)
    {
        // Generate cache key for this album
        var cacheKey = $"album:{spotifyId}";

        // Try to get from cache first
        var cachedAlbum = await _cacheService.GetAsync<AlbumDetailDto>(cacheKey);
        if (cachedAlbum != null)
        {
            _logger.LogInformation("Album {SpotifyId} retrieved from cache", spotifyId);

            // IMPORTANT: Refresh preview URLs for tracks from database even when cached
            if (cachedAlbum.Tracks != null && cachedAlbum.Tracks.Any())
            {
                var trackIds = cachedAlbum.Tracks.Select(t => t.SpotifyId).ToList();
                var tracksFromDb = await _catalogRepository.GetBatchTracksBySpotifyIdsAsync(trackIds);

                // Update cached tracks with preview URLs from database
                foreach (var track in cachedAlbum.Tracks)
                {
                    var dbTrack = tracksFromDb.FirstOrDefault(t => t?.SpotifyId == track.SpotifyId);
                    if (dbTrack != null && !string.IsNullOrEmpty(dbTrack.PreviewUrl))
                        track.PreviewUrl = dbTrack.PreviewUrl;
                }
            }

            return cachedAlbum;
        }

        // Try to get from database
        var album = await _catalogRepository.GetAlbumBySpotifyIdAsync(spotifyId);

        // If we have a valid database entry, use it - even if expired
        // This allows working with data when Spotify is unavailable
        if (album != null)
        {
            _logger.LogInformation("Album {SpotifyId} retrieved from database (valid: {IsValid})",
                spotifyId, DateTime.UtcNow < album.CacheExpiresAt);

            // Map entity to DTO directly
            var albumDto = AlbumMapper.MapAlbumEntityToDto(album);

            // Load track details with preview URLs
            if (album.TrackIds != null && album.TrackIds.Any())
            {
                var tracksFromDb = await _catalogRepository.GetBatchTracksBySpotifyIdsAsync(album.TrackIds);
                albumDto.Tracks = tracksFromDb
                    .Where(t => t != null)
                    .Select(TrackMapper.MapToTrackSummaryDto)
                    .ToList();
            }

            // Store in cache, regardless of expiration
            // This ensures we have something in cache for next time
            await _cacheService.SetAsync(
                cacheKey,
                albumDto,
                TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

            // If album is not expired, return it
            if (DateTime.UtcNow < album.CacheExpiresAt) return albumDto;

            // If album is expired, try to refresh from Spotify
            // But we already have the data to return as fallback
            try
            {
                _logger.LogInformation("Attempting to refresh expired album {SpotifyId} from Spotify", spotifyId);
                // Continue to the Spotify API call below
            }
            catch (Exception ex)
            {
                // If any error occurs during refresh, still use the stale data
                _logger.LogWarning(ex, "Error refreshing album {SpotifyId} from Spotify, using expired data",
                    spotifyId);
                return albumDto;
            }
        }

        // Fetch from Spotify API
        _logger.LogInformation("Fetching album {SpotifyId} from Spotify API", spotifyId);
        var spotifyAlbum = await _spotifyApiClient.GetAlbumAsync(spotifyId);

        // If Spotify API returns null (which could be due to token failure or other issues),
        // and we already have data (even if expired), return it
        if (spotifyAlbum == null)
        {
            if (album != null)
            {
                _logger.LogWarning("Spotify API returned null for {SpotifyId}, using existing data from database",
                    spotifyId);
                return AlbumMapper.MapAlbumEntityToDto(album);
            }

            _logger.LogWarning("Album {SpotifyId} not found in Spotify and no local data available", spotifyId);
            return null;
        }

        // Extract preview URLs for album tracks
        List<string> extractedPreviewUrls = null;
        try
        {
            _logger.LogInformation("Extracting preview URLs for album {SpotifyId} tracks", spotifyId);
            extractedPreviewUrls = await _previewExtractor.GetAlbumPreviewUrlsAsync(spotifyId);
            _logger.LogInformation("Successfully extracted {Count} preview URLs for album {SpotifyId}",
                extractedPreviewUrls?.Count ?? 0, spotifyId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to extract preview URLs for album {SpotifyId}", spotifyId);
            extractedPreviewUrls = new List<string>();
        }

        // Create or update album entity
        var albumEntity = AlbumMapper.MapToAlbumEntity(spotifyAlbum, album);
        albumEntity.CacheExpiresAt = DateTime.UtcNow.AddMinutes(_spotifySettings.CacheExpirationMinutes);

        // Save to database as a cached item 
        await _catalogRepository.AddOrUpdateAlbumAsync(albumEntity);

        // Map to DTO directly from Spotify response and entity
        var result = AlbumMapper.MapToAlbumDetailDto(spotifyAlbum, albumEntity.Id);


        if (result.Tracks != null && result.Tracks.Any() && extractedPreviewUrls != null && extractedPreviewUrls.Any())
            // Match preview URLs to tracks by index (assuming same order)
            for (var i = 0; i < Math.Min(result.Tracks.Count, extractedPreviewUrls.Count); i++)
                if (!string.IsNullOrEmpty(extractedPreviewUrls[i]))
                    result.Tracks[i].PreviewUrl = extractedPreviewUrls[i];

        // Update individual tracks in database with preview URLs
        if (spotifyAlbum.Tracks?.Items != null && extractedPreviewUrls != null && extractedPreviewUrls.Any())
        {
            var trackUpdateTasks = new List<Task>();

            for (var i = 0; i < Math.Min(spotifyAlbum.Tracks.Items.Count, extractedPreviewUrls.Count); i++)
            {
                var trackItem = spotifyAlbum.Tracks.Items[i];
                var previewUrl = extractedPreviewUrls[i];

                if (!string.IsNullOrEmpty(previewUrl))
                {
                    // Update the track in database with preview URL
                    var updateTask = UpdateTrackWithPreviewUrlAsync(trackItem.Id, previewUrl);
                    trackUpdateTasks.Add(updateTask);
                }
            }

            // Execute all track updates in parallel (fire and forget)
            _ = Task.WhenAll(trackUpdateTasks).ContinueWith(t =>
            {
                if (t.IsFaulted)
                    _logger.LogWarning(t.Exception, "Some track preview URL updates failed for album {SpotifyId}",
                        spotifyId);
                else
                    _logger.LogDebug("Successfully updated preview URLs for tracks in album {SpotifyId}", spotifyId);
            });
        }

        // Cache the result
        await _cacheService.SetAsync(
            cacheKey,
            result,
            TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

        return result;
    }

    public async Task<AlbumTracksResultDto> GetAlbumTracksAsync(string spotifyId, int limit = 20, int offset = 0,
        string? market = null)
    {
        try
        {
            // Generate cache key for this request
            var cacheKey = $"album:{spotifyId}:tracks:{limit}:{offset}:{market ?? "none"}";

            // Try to get from cache first
            var cachedResult = await _cacheService.GetAsync<AlbumTracksResultDto>(cacheKey);

            // Check if cached result is complete (has expected number of tracks)
            bool cacheComplete;
            if (cachedResult != null)
            {
                // A complete cache should either:
                // 1. Have exactly the requested limit number of tracks, or
                // 2. Have fewer tracks than the limit but equal to total results minus offset
                //    (meaning we've reached the end of available tracks)
                cacheComplete = cachedResult.Tracks.Count == limit ||
                                (cachedResult.Tracks.Count < limit &&
                                 cachedResult.Tracks.Count == cachedResult.TotalResults - offset);

                if (cacheComplete)
                {
                    _logger.LogInformation("Complete album tracks for {SpotifyId} retrieved from cache", spotifyId);

                    // Refresh preview URLs from database even when cached
                    if (cachedResult.Tracks != null && cachedResult.Tracks.Any())
                    {
                        var trackIds = cachedResult.Tracks.Select(t => t.SpotifyId).ToList();
                        var tracksFromDb = await _catalogRepository.GetBatchTracksBySpotifyIdsAsync(trackIds);

                        // Update cached tracks with preview URLs from database
                        foreach (var track in cachedResult.Tracks)
                        {
                            var dbTrack = tracksFromDb.FirstOrDefault(t => t?.SpotifyId == track.SpotifyId);
                            if (dbTrack != null && !string.IsNullOrEmpty(dbTrack.PreviewUrl))
                                track.PreviewUrl = dbTrack.PreviewUrl;
                        }
                    }

                    return cachedResult;
                }

                _logger.LogInformation("Incomplete cache result found for album {SpotifyId}. " +
                                       "Expected: up to {Limit}, Found: {CachedCount}, Total: {Total}",
                    spotifyId, limit, cachedResult.Tracks.Count, cachedResult.TotalResults);
            }

            // Get the album to ensure it exists and to get the name
            var album = await _catalogRepository.GetAlbumBySpotifyIdAsync(spotifyId);
            var albumName = "Unknown Album";
            var albumTrackIds = new List<string>();

            if (album != null)
            {
                albumName = album.Name;
                albumTrackIds = album.TrackIds;

                // If we have track IDs stored
                if (albumTrackIds.Any())
                {
                    _logger.LogInformation("Found {Count} stored track IDs for album {SpotifyId}",
                        albumTrackIds.Count, spotifyId);

                    // Apply paging logic
                    var pagedTrackIds = albumTrackIds
                        .Skip(offset)
                        .Take(limit)
                        .ToList();

                    // Try to get track details from our database
                    var tracks = await _catalogRepository.GetBatchTracksBySpotifyIdsAsync(pagedTrackIds);

                    // Check if we got all the tracks we need from the database
                    var databaseComplete = tracks.Count() == pagedTrackIds.Count;

                    if (tracks.Any() && databaseComplete)
                    {
                        _logger.LogInformation("Retrieved all {Count} tracks from database for album {SpotifyId}",
                            tracks.Count(), spotifyId);

                        var trackSummaries = tracks
                            .Where(t => t != null)
                            .Select(track => TrackMapper.MapToTrackSummaryDto(track)) // This will include preview URLs
                            .ToList();

                        var result = new AlbumTracksResultDto
                        {
                            AlbumId = spotifyId,
                            AlbumName = albumName,
                            Limit = limit,
                            Offset = offset,
                            TotalResults = albumTrackIds.Count,
                            Tracks = trackSummaries
                        };

                        // Cache the result
                        await _cacheService.SetAsync(
                            cacheKey,
                            result,
                            TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

                        return result;
                    }
                }
            }
            else
            {
                // Try to fetch album from Spotify to get the name
                var albumResponse = await _spotifyApiClient.GetAlbumAsync(spotifyId);
                if (albumResponse != null) albumName = albumResponse.Name;
            }

            // Fetch tracks from Spotify API
            _logger.LogInformation("Fetching tracks for album {SpotifyId} from Spotify API", spotifyId);
            var tracksResponse = await _spotifyApiClient.GetAlbumTracksAsync(spotifyId, limit, offset, market);

            // If Spotify API is unavailable and we have a partial cached result, return it
            if (tracksResponse == null)
            {
                _logger.LogWarning("Spotify API returned no tracks for album {SpotifyId}", spotifyId);

                // If we have ANY cached result, use it even if incomplete
                if (cachedResult != null)
                {
                    _logger.LogInformation(
                        "Using incomplete cached result for album {SpotifyId} due to Spotify API failure",
                        spotifyId);
                    return cachedResult;
                }

                // Otherwise return a minimal result
                return new AlbumTracksResultDto
                {
                    AlbumId = spotifyId,
                    AlbumName = albumName,
                    Limit = limit,
                    Offset = offset,
                    TotalResults = albumTrackIds.Count
                };
            }

            // Extract preview URLs for the tracks in this page (Spotify API rarely provides them)
            List<string> extractedPreviewUrls = null;
            if (tracksResponse.Items != null && tracksResponse.Items.Any())
                try
                {
                    _logger.LogInformation("Extracting preview URLs for {Count} tracks from album {SpotifyId}",
                        tracksResponse.Items.Count, spotifyId);

                    // Get all album preview URLs (this gives us all tracks, not just the current page)
                    var allPreviewUrls = await _previewExtractor.GetAlbumPreviewUrlsAsync(spotifyId);

                    // Extract only the preview URLs for the current page
                    if (allPreviewUrls != null && allPreviewUrls.Any())
                    {
                        extractedPreviewUrls = allPreviewUrls
                            .Skip(offset)
                            .Take(limit)
                            .ToList();

                        _logger.LogInformation(
                            "Successfully extracted {Count} preview URLs for current page of album {SpotifyId}",
                            extractedPreviewUrls.Count, spotifyId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to extract preview URLs for album {SpotifyId} tracks", spotifyId);
                    extractedPreviewUrls = new List<string>();
                }

            // Map the response to our DTO
            var mappedResult =
                AlbumMapper.MapToAlbumTracksResultDto(tracksResponse, spotifyId, albumName, limit, offset);

            // Update the track summaries with extracted preview URLs
            if (extractedPreviewUrls != null && extractedPreviewUrls.Any())
                for (var i = 0; i < Math.Min(mappedResult.Tracks.Count, extractedPreviewUrls.Count); i++)
                    if (!string.IsNullOrEmpty(extractedPreviewUrls[i]))
                        mappedResult.Tracks[i].PreviewUrl = extractedPreviewUrls[i];

            // Update individual tracks in database with preview URLs if we have them
            if (tracksResponse.Items != null && extractedPreviewUrls != null && extractedPreviewUrls.Any())
            {
                var trackUpdateTasks = new List<Task>();

                for (var i = 0; i < Math.Min(tracksResponse.Items.Count, extractedPreviewUrls.Count); i++)
                {
                    var trackItem = tracksResponse.Items[i];
                    var previewUrl = extractedPreviewUrls[i];

                    if (!string.IsNullOrEmpty(previewUrl))
                    {
                        // Update the track in database with preview URL
                        var updateTask = UpdateTrackWithPreviewUrlAsync(trackItem.Id, previewUrl);
                        trackUpdateTasks.Add(updateTask);
                    }
                }

                // Execute all track updates in parallel (fire and forget)
                _ = Task.WhenAll(trackUpdateTasks).ContinueWith(t =>
                {
                    if (t.IsFaulted)
                        _logger.LogWarning(t.Exception, "Some track preview URL updates failed for album {SpotifyId}",
                            spotifyId);
                    else
                        _logger.LogDebug("Successfully updated preview URLs for tracks in album {SpotifyId}",
                            spotifyId);
                });
            }

            // Update album entity with track IDs if needed
            if (album != null && tracksResponse.Items != null && tracksResponse.Items.Any())
            {
                // Get the track IDs from the response
                var newTrackIds = tracksResponse.Items.Select(t => t.Id).ToList();

                // If this is the first page (offset == 0), we can calculate how many total tracks to expect
                if (offset == 0)
                {
                    // Create a new list with expected capacity
                    var allTrackIds = new List<string>(tracksResponse.Total);

                    // Add all track IDs we already have that aren't in the current response
                    // (this preserves any track IDs beyond the current page)
                    if (album.TrackIds != null && album.TrackIds.Count > newTrackIds.Count)
                        // Add tracks from beyond the current page
                        for (var i = newTrackIds.Count; i < album.TrackIds.Count; i++)
                            if (i < album.TrackIds.Count)
                                allTrackIds.Add(album.TrackIds[i]);

                    // Add all new track IDs from the current page
                    allTrackIds.AddRange(newTrackIds);

                    // Update album's track IDs
                    album.TrackIds = allTrackIds;
                }
                else
                {
                    // If this is not the first page, we need to merge the new track IDs at the right position
                    var allTrackIds = new List<string>(album.TrackIds ?? new List<string>());

                    // Make sure our list is long enough
                    while (allTrackIds.Count < offset + newTrackIds.Count) allTrackIds.Add(null); // Placeholder

                    // Replace or add the new track IDs at the correct position
                    for (var i = 0; i < newTrackIds.Count; i++)
                    {
                        var position = offset + i;
                        if (position < allTrackIds.Count)
                            allTrackIds[position] = newTrackIds[i];
                        else
                            allTrackIds.Add(newTrackIds[i]);
                    }

                    // Remove any null placeholders
                    allTrackIds = allTrackIds.Where(id => id != null).ToList();

                    // Update album's track IDs
                    album.TrackIds = allTrackIds;
                }

                // Save updated album to database
                await _catalogRepository.AddOrUpdateAlbumAsync(album);
            }

            // Cache the result
            await _cacheService.SetAsync(
                cacheKey,
                mappedResult,
                TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

            return mappedResult;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving tracks for album {SpotifyId}", spotifyId);
            throw;
        }
    }

    private async Task UpdateTrackWithPreviewUrlAsync(string trackId, string previewUrl)
    {
        try
        {
            var existingTrack = await _catalogRepository.GetTrackBySpotifyIdAsync(trackId);
            if (existingTrack != null && string.IsNullOrEmpty(existingTrack.PreviewUrl))
            {
                existingTrack.PreviewUrl = previewUrl;
                await _catalogRepository.AddOrUpdateTrackAsync(existingTrack);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to update track {TrackId} with preview URL", trackId);
        }
    }

    // Implementation for GetMultipleAlbumsOverviewAsync - returns simplified album information
    public async Task<MultipleAlbumsOverviewDto> GetMultipleAlbumsOverviewAsync(IEnumerable<string> spotifyIds)
    {
        if (spotifyIds == null || !spotifyIds.Any())
            throw new ArgumentException("Album IDs cannot be null or empty", nameof(spotifyIds));

        var result = new MultipleAlbumsOverviewDto();

        try
        {
            // Deduplicate IDs
            var uniqueIds = spotifyIds.Distinct().ToList();

            // Handle Spotify's 20 album limit per request by chunking if needed
            const int spotifyMaxBatchSize = 20;
            var batches = uniqueIds.Chunk(spotifyMaxBatchSize);

            foreach (var batch in batches)
            {
                // Create batch cache key - use a different key prefix to indicate this is overview data
                var batchCacheKey = $"albums:overview:{string.Join(",", batch)}";

                // Try to get batch from cache
                var cachedBatch = await _cacheService.GetAsync<List<AlbumSummaryDto>>(batchCacheKey);

                if (cachedBatch != null && cachedBatch.Any())
                {
                    _logger.LogInformation("Album overview batch retrieved from cache for {Count} albums",
                        cachedBatch.Count);
                    result.Albums.AddRange(cachedBatch);
                    continue;
                }

                // Try to get from database first
                var databaseAlbums = await _catalogRepository.GetBatchAlbumsBySpotifyIdsAsync(batch);

                // Keep track of which IDs we need to fetch from Spotify
                var missingIds = new List<string>();
                var existingDbAlbums = new Dictionary<string, Album>();
                var albumSummaries = new List<AlbumSummaryDto>();

                // Process database results first and identify missing albums
                // When Spotify is unavailable, we'll use ANY albums we have, even expired ones
                foreach (var spotifyId in batch)
                {
                    var dbAlbum = databaseAlbums.FirstOrDefault(a => a != null && a.SpotifyId == spotifyId);

                    if (dbAlbum != null)
                    {
                        // Valid album from database - add to result directly
                        existingDbAlbums[spotifyId] = dbAlbum;

                        // Map to summary DTO
                        albumSummaries.Add(AlbumMapper.MapToAlbumSummaryDto(dbAlbum));

                        // If album is expired, we'll still try to refresh it
                        if (DateTime.UtcNow > dbAlbum.CacheExpiresAt) missingIds.Add(spotifyId);
                    }
                    else
                    {
                        // Album not in database - need to fetch from Spotify
                        missingIds.Add(spotifyId);
                    }
                }

                // If we got all VALID albums from the database, no need to call Spotify API
                if (!missingIds.Any())
                {
                    _logger.LogInformation("Retrieved all {Count} album overviews from database with valid data",
                        albumSummaries.Count);

                    // Add to result
                    result.Albums.AddRange(albumSummaries);

                    // Cache this batch
                    await _cacheService.SetAsync(
                        batchCacheKey,
                        albumSummaries,
                        TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

                    continue;
                }

                // Fetch missing albums from Spotify API
                _logger.LogInformation("Fetching {Count} missing/expired albums from Spotify API", missingIds.Count);

                var spotifyResponse = missingIds.Count > 0
                    ? await _spotifyApiClient.GetMultipleAlbumsAsync(missingIds)
                    : null;

                // If Spotify API call fails completely, use whatever we have from database
                if (spotifyResponse?.Albums == null || !spotifyResponse.Albums.Any())
                {
                    _logger.LogWarning("Spotify API returned no albums. Using only database results.");
                    result.Albums.AddRange(albumSummaries);

                    // Cache what we have, even if incomplete
                    if (albumSummaries.Any())
                        await _cacheService.SetAsync(
                            batchCacheKey,
                            albumSummaries,
                            TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

                    continue;
                }

                if (spotifyResponse?.Albums != null && spotifyResponse.Albums.Any())
                    // Process each album from Spotify
                    foreach (var spotifyAlbum in spotifyResponse.Albums)
                    {
                        if (spotifyAlbum == null) continue;

                        // Get existing album entity if available
                        Album existingAlbum = null;
                        existingDbAlbums.TryGetValue(spotifyAlbum.Id, out existingAlbum);

                        // Create or update album entity
                        var albumEntity = AlbumMapper.MapToAlbumEntity(spotifyAlbum, existingAlbum);
                        albumEntity.CacheExpiresAt =
                            DateTime.UtcNow.AddMinutes(_spotifySettings.CacheExpirationMinutes);

                        // Save to database
                        await _catalogRepository.AddOrUpdateAlbumAsync(albumEntity);

                        // Add to albumSummaries if not already there from DB
                        if (!albumSummaries.Any(a => a.SpotifyId == spotifyAlbum.Id))
                        {
                            var albumSummary = AlbumMapper.MapToAlbumSummaryDto(albumEntity);
                            albumSummaries.Add(albumSummary);
                        }
                    }

                // Add all album summaries to the result (both from DB and Spotify)
                result.Albums.AddRange(albumSummaries.Where(summary =>
                    !result.Albums.Any(a => a.SpotifyId == summary.SpotifyId)));

                // Cache this batch
                await _cacheService.SetAsync(
                    batchCacheKey,
                    albumSummaries,
                    TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving multiple album overviews");
            throw;
        }
    }

    // Get by catalog ID
    public async Task<AlbumDetailDto> GetAlbumByCatalogIdAsync(Guid catalogId)
    {
        try
        {
            _logger.LogInformation("Retrieving album with catalog ID: {CatalogId}", catalogId);

            // Get album by catalog ID directly from database
            var album = await _catalogRepository.GetAlbumByIdAsync(catalogId);

            if (album == null)
            {
                _logger.LogWarning("Album with catalog ID {CatalogId} not found", catalogId);
                return null;
            }

            // For catalog ID lookups, we still try to refresh expired data
            // but we'll return what we have regardless
            if (DateTime.UtcNow > album.CacheExpiresAt)
            {
                _logger.LogInformation("Album with catalog ID {CatalogId} is expired, attempting refresh from Spotify",
                    catalogId);

                try
                {
                    // Try to refresh from Spotify
                    var refreshedAlbum = await GetAlbumAsync(album.SpotifyId);
                    if (refreshedAlbum != null) return refreshedAlbum;
                }
                catch (Exception ex)
                {
                    // If refresh fails, log and continue with existing data
                    _logger.LogWarning(ex, "Failed to refresh expired album {SpotifyId}, using existing data",
                        album.SpotifyId);
                }
            }

            // Map entity to DTO directly and return what we have
            return AlbumMapper.MapAlbumEntityToDto(album);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving album with catalog ID {CatalogId}", catalogId);
            throw;
        }
    }

    // Save album permanently
    public async Task<AlbumDetailDto> SaveAlbumAsync(string spotifyId)
    {
        try
        {
            _logger.LogInformation("Permanently saving album with Spotify ID: {SpotifyId}", spotifyId);

            // First, ensure we have the album (either from cache, database or Spotify)
            var albumDto = await GetAlbumAsync(spotifyId);
            if (albumDto == null)
            {
                _logger.LogWarning("Cannot save album with Spotify ID {SpotifyId}: not found", spotifyId);
                return null;
            }

            // Retrieve the entity from the database
            var album = await _catalogRepository.GetAlbumBySpotifyIdAsync(spotifyId);
            if (album == null)
            {
                _logger.LogError("Unexpected error: album entity not found after GetAlbumAsync succeeded");
                throw new InvalidOperationException($"Album entity with Spotify ID {spotifyId} not found");
            }

            // Permanently save to database with extended expiration
            album.CacheExpiresAt = DateTime.UtcNow.AddDays(1); // Extended cache time for saved items
            await _catalogRepository.SaveAlbumAsync(album);

            // Return the album DTO for the API response
            return albumDto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving album with Spotify ID {SpotifyId}", spotifyId);
            throw;
        }
    }
}