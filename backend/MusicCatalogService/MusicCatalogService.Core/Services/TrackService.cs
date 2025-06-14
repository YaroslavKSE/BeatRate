using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MusicCatalogService.Core.DTOs;
using MusicCatalogService.Core.Interfaces;
using MusicCatalogService.Core.Mappers;
using MusicCatalogService.Core.Models;
using MusicCatalogService.Core.Models.Spotify;
using MusicCatalogService.Core.Spotify;

namespace MusicCatalogService.Core.Services;

public class TrackService : ITrackService
{
    private readonly ISpotifyApiClient _spotifyApiClient;
    private readonly ICatalogRepository _catalogRepository;
    private readonly ICacheService _cacheService;
    private readonly ISpotifyPreviewExtractor _previewExtractor;
    private readonly ILogger<TrackService> _logger;
    private readonly SpotifySettings _spotifySettings;

    public TrackService(
        ISpotifyApiClient spotifyApiClient,
        ICatalogRepository catalogRepository,
        ICacheService cacheService,
        ISpotifyPreviewExtractor previewExtractor,
        ILogger<TrackService> logger,
        IOptions<SpotifySettings> spotifySettings)
    {
        _spotifyApiClient = spotifyApiClient;
        _catalogRepository = catalogRepository;
        _cacheService = cacheService;
        _previewExtractor = previewExtractor;
        _logger = logger;
        _spotifySettings = spotifySettings.Value;
    }

    public async Task<TrackDetailDto> GetTrackAsync(string spotifyId)
    {
        // Generate cache key for this track
        var cacheKey = $"track:{spotifyId}";

        // Try to get from cache first
        var cachedTrack = await _cacheService.GetAsync<TrackDetailDto>(cacheKey);
        if (cachedTrack != null)
        {
            _logger.LogInformation("Track {SpotifyId} retrieved from cache", spotifyId);
            return cachedTrack;
        }

        // Try to get from database
        var track = await _catalogRepository.GetTrackBySpotifyIdAsync(spotifyId);
        
        // If we have a valid database entry, use it - even if expired
        // This allows working with data when Spotify is unavailable
        if (track != null)
        {
            _logger.LogInformation("Track {SpotifyId} retrieved from database (valid: {IsValid})", 
                spotifyId, DateTime.UtcNow < track.CacheExpiresAt);

            // Map entity to DTO directly
            var trackDto = TrackMapper.MapTrackEntityToDto(track);

            // Store in cache, regardless of expiration
            // This ensures we have something in cache for next time
            await _cacheService.SetAsync(
                cacheKey,
                trackDto,
                TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

            // If track is not expired, return it
            if (DateTime.UtcNow < track.CacheExpiresAt)
            {
                return trackDto;
            }
            
            // If track is expired, try to refresh from Spotify
            // But we already have the data to return as fallback
            try
            {
                _logger.LogInformation("Attempting to refresh expired track {SpotifyId} from Spotify", spotifyId);
                // Continue to the Spotify API call below
            }
            catch (Exception ex) 
            {
                // If any error occurs during refresh, still use the stale data
                _logger.LogWarning(ex, "Error refreshing track {SpotifyId} from Spotify, using expired data", spotifyId);
                return trackDto;
            }
        }

        // Fetch from Spotify API
        _logger.LogInformation("Fetching track {SpotifyId} from Spotify API", spotifyId);
        var spotifyTrack = await _spotifyApiClient.GetTrackAsync(spotifyId);
        
        // If Spotify API returns null (which could be due to token failure or other issues),
        // and we already have data (even if expired), return it
        if (spotifyTrack == null)
        {
            if (track != null)
            {
                _logger.LogWarning("Spotify API returned null for {SpotifyId}, using existing data from database", spotifyId);
                return TrackMapper.MapTrackEntityToDto(track);
            }
            
            _logger.LogWarning("Track {SpotifyId} not found in Spotify and no local data available", spotifyId);
            return null;
        }

        // Extract preview URL (Spotify API rarely provides preview URLs, so extract directly)
        string extractedPreviewUrl = null;
        _logger.LogInformation("Extracting preview URL for track {SpotifyId}", spotifyId);
        try
        {
            extractedPreviewUrl = await _previewExtractor.GetTrackPreviewUrlAsync(spotifyId);
            if (!string.IsNullOrEmpty(extractedPreviewUrl))
            {
                _logger.LogInformation("Successfully extracted preview URL for track {SpotifyId}", spotifyId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to extract preview URL for track {SpotifyId}", spotifyId);
        }

        // Create or update track entity
        var trackEntity = TrackMapper.MapToTrackEntity(spotifyTrack, track);
        trackEntity.CacheExpiresAt = DateTime.UtcNow.AddMinutes(_spotifySettings.CacheExpirationMinutes);
        
        // Use extracted preview URL (prefer extracted over Spotify API since API rarely provides them)
        if (!string.IsNullOrEmpty(extractedPreviewUrl))
        {
            trackEntity.PreviewUrl = extractedPreviewUrl;
        }

        // Save to database as a cached item (not permanent)
        await _catalogRepository.AddOrUpdateTrackAsync(trackEntity);

        // Map to DTO
        var result = TrackMapper.MapToTrackDetailDto(spotifyTrack, trackEntity.Id);
        
        // Ensure extracted preview URL is included in the result (prefer extracted over Spotify API)
        if (!string.IsNullOrEmpty(extractedPreviewUrl))
        {
            result.PreviewUrl = extractedPreviewUrl;
        }

        // Cache the result
        await _cacheService.SetAsync(
            cacheKey,
            result,
            TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

        return result;
    }

    public async Task<MultipleTracksOverviewDto> GetMultipleTracksOverviewAsync(IEnumerable<string> spotifyIds)
    {
        if (spotifyIds == null || !spotifyIds.Any())
            throw new ArgumentException("Track IDs cannot be null or empty", nameof(spotifyIds));

        var result = new MultipleTracksOverviewDto();

        try
        {
            // Deduplicate IDs
            var uniqueIds = spotifyIds.Distinct().ToList();

            // Handle Spotify's 50 track limit per request by chunking if needed
            const int spotifyMaxBatchSize = 50;
            var batches = uniqueIds.Chunk(spotifyMaxBatchSize);

            foreach (var batch in batches)
            {
                // Create batch cache key - use a different key prefix to indicate this is overview data
                var batchCacheKey = $"tracks:overview:{string.Join(",", batch)}";

                // Try to get batch from cache
                var cachedBatch = await _cacheService.GetAsync<List<TrackSummaryDto>>(batchCacheKey);

                if (cachedBatch != null && cachedBatch.Any())
                {
                    _logger.LogInformation("Track overview batch retrieved from cache for {Count} tracks",
                        cachedBatch.Count);
                    result.Tracks.AddRange(cachedBatch);
                    continue;
                }

                // Try to get from database first
                var databaseTracks = await _catalogRepository.GetBatchTracksBySpotifyIdsAsync(batch);

                // Keep track of which IDs we need to fetch from Spotify
                var missingIds = new List<string>();
                var existingDbTracks = new Dictionary<string, Track>();
                var trackSummaries = new List<TrackSummaryDto>();

                // Process database results first and identify missing tracks
                // When Spotify is unavailable, we'll use ANY tracks we have, even expired ones
                foreach (var spotifyId in batch)
                {
                    var dbTrack = databaseTracks.FirstOrDefault(t => t != null && t.SpotifyId == spotifyId);

                    if (dbTrack != null)
                    {
                        // Valid track from database - add to result directly
                        existingDbTracks[spotifyId] = dbTrack;

                        // Map to summary DTO
                        trackSummaries.Add(TrackMapper.MapToTrackSummaryDto(dbTrack));
                        
                        // If track is expired, we'll still try to refresh from Spotify
                        if (DateTime.UtcNow > dbTrack.CacheExpiresAt)
                        {
                            missingIds.Add(spotifyId);
                        }
                    }
                    else
                    {
                        // Track not in database - need to fetch from Spotify
                        missingIds.Add(spotifyId);
                    }
                }

                // If we got all VALID tracks from the database, no need to call Spotify API
                if (!missingIds.Any())
                {
                    _logger.LogInformation("Retrieved all {Count} track overviews from database with valid data", 
                        trackSummaries.Count);

                    // Add to result
                    result.Tracks.AddRange(trackSummaries);

                    // Cache this batch
                    await _cacheService.SetAsync(
                        batchCacheKey,
                        trackSummaries,
                        TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

                    continue;
                }

                // Fetch missing tracks from Spotify API
                _logger.LogInformation("Fetching {Count} missing/expired tracks from Spotify API", missingIds.Count);

                var spotifyResponse = missingIds.Count > 0
                    ? await _spotifyApiClient.GetMultipleTracksAsync(missingIds)
                    : null;

                // If Spotify API call fails completely, use whatever we have from database
                if (spotifyResponse?.Tracks == null || !spotifyResponse.Tracks.Any())
                {
                    _logger.LogWarning("Spotify API returned no tracks. Using only database results.");
                    result.Tracks.AddRange(trackSummaries);
                    
                    // Cache what we have, even if incomplete
                    if (trackSummaries.Any())
                    {
                        await _cacheService.SetAsync(
                            batchCacheKey,
                            trackSummaries,
                            TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));
                    }
                    
                    continue;
                }

                // Process each track from Spotify and extract preview URLs if needed
                var tracksToProcess = new List<(SpotifyTrackResponse SpotifyTrack, Track ExistingTrack)>();
                
                foreach (var spotifyTrack in spotifyResponse.Tracks)
                {
                    if (spotifyTrack == null) continue;

                    // Get existing track entity if available
                    Track existingTrack = null;
                    existingDbTracks.TryGetValue(spotifyTrack.Id, out existingTrack);
                    
                    tracksToProcess.Add((spotifyTrack, existingTrack));
                }

                // Extract preview URLs for tracks that need them (in parallel for better performance)
                var previewTasks = tracksToProcess
                    .Select(async t =>
                    {
                        var previewUrl = await _previewExtractor.GetTrackPreviewUrlAsync(t.SpotifyTrack.Id);
                        return (t.SpotifyTrack.Id, previewUrl);
                    });

                var previewResults = await Task.WhenAll(previewTasks);
                var previewUrlMap = previewResults.ToDictionary(r => r.Id, r => r.previewUrl);

                // Process each track
                foreach (var (spotifyTrack, existingTrack) in tracksToProcess)
                {
                    // Create or update track entity
                    var trackEntity = TrackMapper.MapToTrackEntity(spotifyTrack, existingTrack);
                    trackEntity.CacheExpiresAt = DateTime.UtcNow.AddMinutes(_spotifySettings.CacheExpirationMinutes);

                    // Use extracted preview URL (prefer extracted over Spotify API)
                    if (previewUrlMap.TryGetValue(spotifyTrack.Id, out var extractedUrl) && 
                        !string.IsNullOrEmpty(extractedUrl))
                    {
                        trackEntity.PreviewUrl = extractedUrl;
                    }

                    // Save to database
                    await _catalogRepository.AddOrUpdateTrackAsync(trackEntity);

                    // Add to track summaries (only if not already there from DB)
                    if (!trackSummaries.Any(t => t.SpotifyId == spotifyTrack.Id))
                    {
                        var trackSummary = TrackMapper.MapToTrackSummaryDto(trackEntity);
                        trackSummaries.Add(trackSummary);
                    }
                }

                // Add all track summaries to the result (both from DB and Spotify)
                result.Tracks.AddRange(trackSummaries.Where(ts => 
                    !result.Tracks.Any(t => t.SpotifyId == ts.SpotifyId)));

                // Cache this batch
                await _cacheService.SetAsync(
                    batchCacheKey,
                    trackSummaries,
                    TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving multiple track overviews");
            throw;
        }
    }

    // Get by catalog ID - always uses local data
    public async Task<TrackDetailDto> GetTrackByCatalogIdAsync(Guid catalogId)
    {
        try
        {
            _logger.LogInformation("Retrieving track with catalog ID: {CatalogId}", catalogId);

            // Get track by catalog ID directly from database
            var track = await _catalogRepository.GetTrackByIdAsync(catalogId);

            if (track == null)
            {
                _logger.LogWarning("Track with catalog ID {CatalogId} not found", catalogId);
                return null;
            }

            // For catalog ID lookups, we still try to refresh expired data
            // but we'll return what we have regardless
            if (DateTime.UtcNow > track.CacheExpiresAt)
            {
                _logger.LogInformation("Track with catalog ID {CatalogId} is expired, attempting refresh from Spotify",
                    catalogId);

                try
                {
                    // Try to refresh from Spotify
                    var refreshedTrack = await GetTrackAsync(track.SpotifyId);
                    if (refreshedTrack != null) 
                    {
                        return refreshedTrack;
                    }
                }
                catch (Exception ex)
                {
                    // If refresh fails, log and continue with existing data
                    _logger.LogWarning(ex, "Failed to refresh expired track {SpotifyId}, using existing data", 
                        track.SpotifyId);
                }
            }

            // Map entity to DTO directly and return what we have
            return TrackMapper.MapTrackEntityToDto(track);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving track with catalog ID {CatalogId}", catalogId);
            throw;
        }
    }

    // Save track permanently
    public async Task<TrackDetailDto> SaveTrackAsync(string spotifyId)
    {
        try
        {
            _logger.LogInformation("Permanently saving track with Spotify ID: {SpotifyId}", spotifyId);

            // First, ensure we have the track (either from cache, database or Spotify)
            var trackDto = await GetTrackAsync(spotifyId);
            if (trackDto == null)
            {
                _logger.LogWarning("Cannot save track with Spotify ID {SpotifyId}: not found", spotifyId);
                return null;
            }

            // Retrieve the entity from the database
            var track = await _catalogRepository.GetTrackBySpotifyIdAsync(spotifyId);
            if (track == null)
            {
                _logger.LogError("Unexpected error: track entity not found after GetTrackAsync succeeded");
                throw new InvalidOperationException($"Track entity with Spotify ID {spotifyId} not found");
            }

            // Permanently save to database with extended expiration
            track.CacheExpiresAt = DateTime.UtcNow.AddDays(1); // Extended cache time for saved items
            await _catalogRepository.SaveTrackAsync(track);

            // Return the track DTO for the API response
            return trackDto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving track with Spotify ID {SpotifyId}", spotifyId);
            throw;
        }
    }
}