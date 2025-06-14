using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using MusicCatalogService.Core.Interfaces;

namespace MusicCatalogService.Core.Services;

public class SpotifyPreviewExtractor : ISpotifyPreviewExtractor
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<SpotifyPreviewExtractor> _logger;

    public SpotifyPreviewExtractor(HttpClient httpClient, ILogger<SpotifyPreviewExtractor> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        
        // Configure HttpClient for Spotify embed requests
        _httpClient.DefaultRequestHeaders.Add("User-Agent", 
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
    }

    public async Task<string?> GetTrackPreviewUrlAsync(string spotifyTrackId)
    {
        try
        {
            var embedUrl = $"https://open.spotify.com/embed/track/{spotifyTrackId}";
            _logger.LogDebug("Fetching track preview from: {EmbedUrl}", embedUrl);
            
            var response = await _httpClient.GetAsync(embedUrl);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch Spotify embed page for track {TrackId}. Status: {StatusCode}", 
                    spotifyTrackId, response.StatusCode);
                return null;
            }

            var html = await response.Content.ReadAsStringAsync();

            // Extract preview URL using regex pattern
            var regex = new Regex(@"""audioPreview"":\s*{\s*""url"":\s*""([^""]+)""", RegexOptions.IgnoreCase);
            var match = regex.Match(html);

            if (match.Success && match.Groups.Count > 1)
            {
                var previewUrl = match.Groups[1].Value;
                _logger.LogDebug("Found preview URL for track {TrackId}: {PreviewUrl}", spotifyTrackId, previewUrl);
                return previewUrl;
            }

            _logger.LogDebug("No preview URL found for track {TrackId}", spotifyTrackId);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting preview URL for track {TrackId}", spotifyTrackId);
            return null;
        }
    }

    public async Task<List<string>> GetAlbumPreviewUrlsAsync(string spotifyAlbumId)
    {
        try
        {
            var embedUrl = $"https://open.spotify.com/embed/album/{spotifyAlbumId}";
            _logger.LogDebug("Fetching album previews from: {EmbedUrl}", embedUrl);
            
            var response = await _httpClient.GetAsync(embedUrl);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch Spotify embed page for album {AlbumId}. Status: {StatusCode}", 
                    spotifyAlbumId, response.StatusCode);
                return new List<string>();
            }

            var html = await response.Content.ReadAsStringAsync();

            // Extract JSON data from __NEXT_DATA__ script tag
            var scriptRegex = new Regex(@"<script id=""__NEXT_DATA__"" type=""application\/json"">(.+?)<\/script>", 
                RegexOptions.Singleline | RegexOptions.IgnoreCase);
            var scriptMatch = scriptRegex.Match(html);

            if (!scriptMatch.Success)
            {
                _logger.LogWarning("Could not find embedded JSON in album page for {AlbumId}", spotifyAlbumId);
                return new List<string>();
            }

            var jsonContent = scriptMatch.Groups[1].Value;
            
            using var jsonDoc = JsonDocument.Parse(jsonContent);
            var root = jsonDoc.RootElement;

            // Navigate to trackList: props.pageProps.state.data.entity.trackList
            if (!root.TryGetProperty("props", out var props) ||
                !props.TryGetProperty("pageProps", out var pageProps) ||
                !pageProps.TryGetProperty("state", out var state) ||
                !state.TryGetProperty("data", out var data) ||
                !data.TryGetProperty("entity", out var entity) ||
                !entity.TryGetProperty("trackList", out var trackList))
            {
                _logger.LogWarning("Could not navigate to trackList in JSON data for album {AlbumId}", spotifyAlbumId);
                return new List<string>();
            }

            var previewUrls = new List<string>();

            if (trackList.ValueKind == JsonValueKind.Array)
            {
                foreach (var track in trackList.EnumerateArray())
                {
                    if (track.TryGetProperty("audioPreview", out var audioPreview) &&
                        audioPreview.TryGetProperty("url", out var urlElement) &&
                        urlElement.ValueKind == JsonValueKind.String)
                    {
                        var url = urlElement.GetString();
                        if (!string.IsNullOrEmpty(url))
                        {
                            previewUrls.Add(url);
                        }
                    }
                }
            }

            _logger.LogDebug("Found {Count} preview URLs for album {AlbumId}", previewUrls.Count, spotifyAlbumId);
            return previewUrls;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting preview URLs for album {AlbumId}", spotifyAlbumId);
            return new List<string>();
        }
    }
}