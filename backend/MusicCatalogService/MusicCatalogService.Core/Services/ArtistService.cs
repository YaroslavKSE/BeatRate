using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MusicCatalogService.Core.DTOs;
using MusicCatalogService.Core.Interfaces;
using MusicCatalogService.Core.Mappers;
using MusicCatalogService.Core.Models.Spotify;

namespace MusicCatalogService.Core.Services;

public class ArtistService : IArtistService
{
    private readonly ISpotifyApiClient _spotifyApiClient;
    private readonly ICatalogRepository _catalogRepository;
    private readonly ICacheService _cacheService;
    private readonly ISpotifyPreviewExtractor _previewExtractor;
    private readonly ILogger<ArtistService> _logger;
    private readonly SpotifySettings _spotifySettings;

    public ArtistService(
        ISpotifyApiClient spotifyApiClient,
        ICatalogRepository catalogRepository,
        ICacheService cacheService,
        ISpotifyPreviewExtractor previewExtractor,
        ILogger<ArtistService> logger,
        IOptions<SpotifySettings> spotifySettings)
    {
        _spotifyApiClient = spotifyApiClient;
        _catalogRepository = catalogRepository;
        _cacheService = cacheService;
        _previewExtractor = previewExtractor;
        _logger = logger;
        _spotifySettings = spotifySettings.Value;
    }

    // Get artist from Spotify or cache
    public async Task<ArtistDetailDto> GetArtistAsync(string spotifyId)
    {
        // Generate cache key for this artist
        var cacheKey = $"artist:{spotifyId}";

        // Try to get from cache first
        var cachedArtist = await _cacheService.GetAsync<ArtistDetailDto>(cacheKey);
        if (cachedArtist != null)
        {
            _logger.LogInformation("Artist {SpotifyId} retrieved from cache", spotifyId);
            return cachedArtist;
        }

        // Try to get from database
        var artist = await _catalogRepository.GetArtistBySpotifyIdAsync(spotifyId);

        // If we have a valid database entry, use it - even if expired
        // This allows working with data when Spotify is unavailable
        if (artist != null)
        {
            _logger.LogInformation("Artist {SpotifyId} retrieved from database (valid: {IsValid})",
                spotifyId, DateTime.UtcNow < artist.CacheExpiresAt);

            // Map entity to DTO directly
            var artistDto = ArtistMapper.MapArtistEntityToDto(artist);

            // Store in cache, regardless of expiration
            // This ensures we have something in cache for next time
            await _cacheService.SetAsync(
                cacheKey,
                artistDto,
                TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

            // If artist is not expired, return it
            if (DateTime.UtcNow < artist.CacheExpiresAt) return artistDto;

            // If artist is expired, try to refresh from Spotify
            // But we already have the data to return as fallback
            try
            {
                _logger.LogInformation("Attempting to refresh expired artist {SpotifyId} from Spotify", spotifyId);
                // Continue to the Spotify API call below
            }
            catch (Exception ex)
            {
                // If any error occurs during refresh, still use the stale data
                _logger.LogWarning(ex, "Error refreshing artist {SpotifyId} from Spotify, using expired data",
                    spotifyId);
                return artistDto;
            }
        }

        // Fetch from Spotify API
        _logger.LogInformation("Fetching artist {SpotifyId} from Spotify API", spotifyId);
        var spotifyArtist = await _spotifyApiClient.GetArtistAsync(spotifyId);

        // If Spotify API returns null (which could be due to token failure or other issues),
        // and we already have data (even if expired), return it
        if (spotifyArtist == null)
        {
            if (artist != null)
            {
                _logger.LogWarning("Spotify API returned null for {SpotifyId}, using existing data from database",
                    spotifyId);
                return ArtistMapper.MapArtistEntityToDto(artist);
            }

            _logger.LogWarning("Artist {SpotifyId} not found in Spotify and no local data available", spotifyId);
            return null;
        }

        // Create or update artist entity
        var artistEntity = ArtistMapper.MapToArtistEntity(spotifyArtist, artist);
        artistEntity.CacheExpiresAt = DateTime.UtcNow.AddMinutes(_spotifySettings.CacheExpirationMinutes);

        // Save to database as a cached item (not permanent)
        await _catalogRepository.AddOrUpdateArtistAsync(artistEntity);

        // Map to DTO
        var result = ArtistMapper.MapToArtistDetailDto(spotifyArtist, artistEntity.Id);

        // Cache the result
        await _cacheService.SetAsync(
            cacheKey,
            result,
            TimeSpan.FromMinutes(_spotifySettings.CacheExpirationMinutes));

        return result;
    }

    // Get by catalog ID
    public async Task<ArtistDetailDto> GetArtistByCatalogIdAsync(Guid catalogId)
    {
        try
        {
            _logger.LogInformation("Retrieving artist with catalog ID: {CatalogId}", catalogId);

            // Get artist by catalog ID directly from database
            var artist = await _catalogRepository.GetArtistByIdAsync(catalogId);

            if (artist == null)
            {
                _logger.LogWarning("Artist with catalog ID {CatalogId} not found", catalogId);
                return null;
            }

            // For catalog ID lookups, we still try to refresh expired data
            // but we'll return what we have regardless
            if (DateTime.UtcNow > artist.CacheExpiresAt)
            {
                _logger.LogInformation("Artist with catalog ID {CatalogId} is expired, attempting refresh from Spotify",
                    catalogId);

                try
                {
                    // Try to refresh from Spotify
                    var refreshedArtist = await GetArtistAsync(artist.SpotifyId);
                    if (refreshedArtist != null) return refreshedArtist;
                }
                catch (Exception ex)
                {
                    // If refresh fails, log and continue with existing data
                    _logger.LogWarning(ex, "Failed to refresh expired artist {SpotifyId}, using existing data",
                        artist.SpotifyId);
                }
            }

            // Map entity to DTO directly and return what we have
            return ArtistMapper.MapArtistEntityToDto(artist);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving artist with catalog ID {CatalogId}", catalogId);
            throw;
        }
    }

    public async Task<ArtistAlbumsResultDto> GetArtistAlbumsAsync(string spotifyId, int limit = 20, int offset = 0,
        string? market = null, string? includeGroups = "album")
    {
        try
        {
            // Generate cache key for this request
            var cacheKey = $"artist:{spotifyId}:albums:{limit}:{offset}:{market ?? "none"}:{includeGroups ?? "album"}";

            // Try to get from cache first
            var cachedResult = await _cacheService.GetAsync<ArtistAlbumsResultDto>(cacheKey);

            // Check if cached result is complete (has expected number of items)
            var cacheComplete = false;
            if (cachedResult != null)
            {
                // If this is a paged request (offset > 0), check if we have all items up to limit
                // If this is the first page, we should have at least the requested limit or all available items
                cacheComplete = cachedResult.Albums.Count == limit ||
                                (cachedResult.Albums.Count < limit &&
                                 cachedResult.Albums.Count == cachedResult.TotalResults - offset);

                if (cacheComplete)
                {
                    _logger.LogInformation("Complete artist albums for {SpotifyId} retrieved from cache", spotifyId);
                    return cachedResult;
                }
                else
                {
                    _logger.LogInformation(
                        "Incomplete cache result found for artist albums. Expected: {Limit}, Found: {CachedCount}",
                        limit, cachedResult.Albums.Count);
                }
            }

            // Get the artist to ensure it exists and to get the name and stored albums
            var artist = await _catalogRepository.GetArtistBySpotifyIdAsync(spotifyId);
            var artistName = "Unknown Artist";
            List<string> storedAlbumIds = new List<string>();

            if (artist != null)
            {
                artistName = artist.Name;
                storedAlbumIds = artist.AlbumIds;

                // If we have album IDs stored and Spotify API is unavailable,
                // we can still return something useful
                if (storedAlbumIds.Any())
                {
                    _logger.LogInformation("Using stored album IDs for artist {SpotifyId}", spotifyId);

                    // Apply paging logic
                    var pagedAlbumIds = storedAlbumIds
                        .Skip(offset)
                        .Take(limit)
                        .ToList();

                    // Try to get album details from our database
                    var albums = await _catalogRepository.GetBatchAlbumsBySpotifyIdsAsync(pagedAlbumIds);

                    // Check if we got enough albums
                    var databaseComplete = albums.Count() == pagedAlbumIds.Count;

                    if (albums.Any() && databaseComplete)
                    {
                        var albumSummaries = albums
                            .Where(a => a != null)
                            .Select(album => AlbumMapper.MapToAlbumSummaryDto(album))
                            .ToList();

                        var result = new ArtistAlbumsResultDto
                        {
                            ArtistId = spotifyId,
                            ArtistName = artistName,
                            Limit = limit,
                            Offset = offset,
                            TotalResults = storedAlbumIds.Count,
                            Albums = albumSummaries
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
                // Try to fetch artist from Spotify
                var artistResponse = await _spotifyApiClient.GetArtistAsync(spotifyId);
                if (artistResponse != null) artistName = artistResponse.Name;
            }

            // Fetch albums from Spotify API
            _logger.LogInformation(
                "Fetching albums for artist {SpotifyId} from Spotify API with include_groups={IncludeGroups}",
                spotifyId, includeGroups);
            var albumsResponse =
                await _spotifyApiClient.GetArtistAlbumsAsync(spotifyId, limit, offset, market, includeGroups);

            // If Spotify API is unavailable and we have no stored data, return a minimal result
            if (albumsResponse == null)
            {
                _logger.LogWarning("No albums found for artist {SpotifyId} from Spotify API", spotifyId);
                return new ArtistAlbumsResultDto
                {
                    ArtistId = spotifyId,
                    ArtistName = artistName,
                    Limit = limit,
                    Offset = offset,
                    TotalResults = storedAlbumIds.Count
                };
            }

            // Map the response to our DTO
            var mappedResult =
                ArtistMapper.MapToArtistAlbumsResultDto(albumsResponse, spotifyId, artistName, limit, offset);

            // Update artist entity with album IDs if available
            if (artist != null && albumsResponse.Items != null && albumsResponse.Items.Any())
            {
                var albumIds = albumsResponse.Items.Select(a => a.Id).ToList();

                // Add new album IDs to the artist's collection - avoiding duplicates
                var existingIds = new HashSet<string>(artist.AlbumIds ?? new List<string>());
                foreach (var albumId in albumIds.Where(id => !existingIds.Contains(id))) existingIds.Add(albumId);

                artist.AlbumIds = existingIds.ToList();

                // Update the artist entity in the database
                await _catalogRepository.AddOrUpdateArtistAsync(artist);
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
            _logger.LogError(ex, "Error retrieving albums for artist {SpotifyId}", spotifyId);
            throw;
        }
    }

    public async Task<ArtistTopTracksResultDto> GetArtistTopTracksAsync(string spotifyId, string? market = null)
    {
        try
        {
            // Use a default market if none provided
            market = string.IsNullOrEmpty(market) ? "US" : market;

            // Generate cache key for this request
            var cacheKey = $"artist:{spotifyId}:top-tracks:{market}";

            // Try to get from cache first
            var cachedResult = await _cacheService.GetAsync<ArtistTopTracksResultDto>(cacheKey);

            // Check if cached result is valid (typically should have 10 tracks for top tracks)
            var cacheComplete = false;
            if (cachedResult != null)
            {
                // For top tracks, Spotify typically returns 10 tracks
                // But we'll be more flexible and just check if there are any tracks
                cacheComplete = cachedResult.Tracks.Count > 0;

                if (cacheComplete)
                {
                    _logger.LogInformation("Complete artist top tracks for {SpotifyId} retrieved from cache",
                        spotifyId);

                    // IMPORTANT: Refresh preview URLs from database even when cached
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

                _logger.LogInformation(
                    "Incomplete cache result found for artist top tracks. Found only: {CachedCount} tracks",
                    cachedResult.Tracks.Count);
            }

            // Get the artist to ensure it exists and to get the name
            var artist = await _catalogRepository.GetArtistBySpotifyIdAsync(spotifyId);
            var artistName = "Unknown Artist";
            List<string> storedTrackIds = new List<string>();

            if (artist != null)
            {
                artistName = artist.Name;
                storedTrackIds = artist.TopTrackIds ?? new List<string>();

                // If we have track IDs stored and Spotify API is unavailable,
                // we can still return something useful
                if (storedTrackIds.Any())
                {
                    _logger.LogInformation("Using stored top track IDs for artist {SpotifyId}", spotifyId);

                    // Try to get track details from our database
                    var tracks = await _catalogRepository.GetBatchTracksBySpotifyIdsAsync(storedTrackIds);

                    // Check if we got enough tracks (typically 10 for top tracks)
                    var databaseComplete = tracks.Count() == storedTrackIds.Count;

                    if (tracks.Any() && databaseComplete)
                    {
                        var trackSummaries = tracks
                            .Where(t => t != null)
                            .Select(TrackMapper.MapToTrackSummaryDto) // This will include preview URLs
                            .ToList();

                        var result = new ArtistTopTracksResultDto
                        {
                            ArtistId = spotifyId,
                            ArtistName = artistName,
                            Market = market,
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
                // Try to fetch artist from Spotify
                var artistResponse = await _spotifyApiClient.GetArtistAsync(spotifyId);
                if (artistResponse != null) artistName = artistResponse.Name;
            }

            // Fetch top tracks from Spotify API
            _logger.LogInformation("Fetching top tracks for artist {SpotifyId} from Spotify API", spotifyId);
            var topTracksResponse = await _spotifyApiClient.GetArtistTopTracksAsync(spotifyId, market);

            // If Spotify API is unavailable and we have no stored data, return a minimal result
            if (topTracksResponse == null || topTracksResponse.Tracks == null || !topTracksResponse.Tracks.Any())
            {
                _logger.LogWarning("No top tracks found for artist {SpotifyId} from Spotify API", spotifyId);
                return new ArtistTopTracksResultDto
                {
                    ArtistId = spotifyId,
                    ArtistName = artistName,
                    Market = market
                };
            }

            // Extract preview URLs for top tracks 
            List<string> extractedPreviewUrls = null;
            try
            {
                _logger.LogInformation("Extracting preview URLs for {Count} top tracks of artist {SpotifyId}",
                    topTracksResponse.Tracks.Count, spotifyId);

                // Extract preview URLs for all top tracks in parallel
                var previewTasks = topTracksResponse.Tracks
                    .Select(async track => await _previewExtractor.GetTrackPreviewUrlAsync(track.Id));

                extractedPreviewUrls = (await Task.WhenAll(previewTasks)).ToList();

                _logger.LogInformation(
                    "Successfully extracted {Count} preview URLs for top tracks of artist {SpotifyId}",
                    extractedPreviewUrls.Count(url => !string.IsNullOrEmpty(url)), spotifyId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to extract preview URLs for top tracks of artist {SpotifyId}",
                    spotifyId);
                extractedPreviewUrls = new List<string>();
            }

            // Update tracks in database with preview URLs if we extracted any
            var trackUpdateTasks = new List<Task>();
            for (var i = 0; i < Math.Min(topTracksResponse.Tracks.Count, extractedPreviewUrls?.Count ?? 0); i++)
            {
                var track = topTracksResponse.Tracks[i];
                var previewUrl = extractedPreviewUrls?[i];

                if (!string.IsNullOrEmpty(previewUrl))
                {
                    var updateTask = UpdateTrackWithPreviewUrlAsync(track.Id, previewUrl);
                    trackUpdateTasks.Add(updateTask);
                }
            }

            // Execute track updates in parallel (fire and forget)
            _ = Task.WhenAll(trackUpdateTasks).ContinueWith(t =>
            {
                if (t.IsFaulted)
                    _logger.LogWarning(t.Exception, "Some top track preview URL updates failed for artist {SpotifyId}",
                        spotifyId);
                else
                    _logger.LogDebug("Successfully updated preview URLs for top tracks of artist {SpotifyId}",
                        spotifyId);
            });

            // Map the response to our DTO
            var mappedResult =
                ArtistMapper.MapToArtistTopTracksResultDto(topTracksResponse, spotifyId, artistName, market);

            // Update the track summaries with extracted preview URLs
            if (extractedPreviewUrls != null && extractedPreviewUrls.Any())
                for (var i = 0; i < Math.Min(mappedResult.Tracks.Count, extractedPreviewUrls.Count); i++)
                    if (!string.IsNullOrEmpty(extractedPreviewUrls[i]))
                        mappedResult.Tracks[i].PreviewUrl = extractedPreviewUrls[i];

            // Update artist entity with top track IDs
            if (artist != null && topTracksResponse.Tracks != null)
            {
                // Store top track IDs in the artist entity
                artist.TopTrackIds = topTracksResponse.Tracks.Select(t => t.Id).ToList();

                // Update the artist entity in the database
                await _catalogRepository.AddOrUpdateArtistAsync(artist);
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
            _logger.LogError(ex, "Error retrieving top tracks for artist {SpotifyId}", spotifyId);
            throw;
        }
    }

    // Save artist permanently
    public async Task<ArtistDetailDto> SaveArtistAsync(string spotifyId)
    {
        try
        {
            _logger.LogInformation("Permanently saving artist with Spotify ID: {SpotifyId}", spotifyId);

            // First, ensure we have the artist (either from cache, database or Spotify)
            var artistDto = await GetArtistAsync(spotifyId);
            if (artistDto == null)
            {
                _logger.LogWarning("Cannot save artist with Spotify ID {SpotifyId}: not found", spotifyId);
                return null;
            }

            // Retrieve the entity from the database
            var artist = await _catalogRepository.GetArtistBySpotifyIdAsync(spotifyId);
            if (artist == null)
            {
                _logger.LogError("Unexpected error: artist entity not found after GetArtistAsync succeeded");
                throw new InvalidOperationException($"Artist entity with Spotify ID {spotifyId} not found");
            }

            // Permanently save to database with extended expiration
            artist.CacheExpiresAt = DateTime.UtcNow.AddDays(1); // Extended cache time for saved items
            await _catalogRepository.SaveArtistAsync(artist);

            // Return the artist DTO for the API response
            return artistDto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving artist with Spotify ID {SpotifyId}", spotifyId);
            throw;
        }
    }

    private async Task UpdateTrackWithPreviewUrlAsync(string trackId, string previewUrl)
    {
        try
        {
            var existingTrack = await _catalogRepository.GetTrackBySpotifyIdAsync(trackId);
            if (existingTrack != null)
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
}