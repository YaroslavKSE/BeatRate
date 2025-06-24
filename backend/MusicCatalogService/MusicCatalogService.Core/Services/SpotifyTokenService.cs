using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MusicCatalogService.Core.Interfaces;
using MusicCatalogService.Core.Models.Spotify;
using MusicCatalogService.Core.Spotify;

namespace MusicCatalogService.Core.Services;

public class SpotifyTokenService : ISpotifyTokenService
{
    private readonly SpotifySettings _settings;
    private readonly ILogger<SpotifyTokenService> _logger;
    private string _accessToken;
    private DateTime _tokenExpiryTime = DateTime.MinValue;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private DateTime _lastFailureTime = DateTime.MinValue;
    private TimeSpan _retryBackoffPeriod = TimeSpan.FromMinutes(5);
    private bool _isInFailureMode = false;

    public SpotifyTokenService(IOptions<SpotifySettings> settings, ILogger<SpotifyTokenService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<TokenResult> GetAccessTokenAsync()
    {
        // Check if we're in failure mode and if we should attempt a retry
        if (_isInFailureMode)
        {
            var timeSinceLastFailure = DateTime.UtcNow - _lastFailureTime;
            if (timeSinceLastFailure < _retryBackoffPeriod)
            {
                _logger.LogWarning("Spotify token service in failure mode. Next retry in {TimeRemaining} seconds",
                    (_retryBackoffPeriod - timeSinceLastFailure).TotalSeconds);
                return TokenResult.Failure();
            }
            else
            {
                _logger.LogInformation("Retry period elapsed, attempting to get Spotify token again");
                // Reset failure mode to attempt a retry
                _isInFailureMode = false;
            }
        }

        // Check if token is valid
        if (DateTime.UtcNow < _tokenExpiryTime && !string.IsNullOrEmpty(_accessToken))
        {
            _logger.LogDebug("Using existing token, expires in {TimeRemaining} seconds",
                (_tokenExpiryTime - DateTime.UtcNow).TotalSeconds);
            return TokenResult.Success(_accessToken);
        }

        // Prevent concurrent token requests
        await _semaphore.WaitAsync();
        try
        {
            // Double-check in case another thread already refreshed the token
            if (DateTime.UtcNow < _tokenExpiryTime && !string.IsNullOrEmpty(_accessToken))
                return TokenResult.Success(_accessToken);

            _logger.LogInformation("Requesting new Spotify access token");

            try
            {
                // Request new token
                using var tokenClient = new HttpClient();
                var request = new HttpRequestMessage(HttpMethod.Post, "https://accounts.spotify.com/api/token")
                {
                    Content = new FormUrlEncodedContent(new Dictionary<string, string>
                    {
                        {"grant_type", "client_credentials"},
                        {"client_id", _settings.ClientId},
                        {"client_secret", _settings.ClientSecret}
                    })
                };

                var response = await tokenClient.SendAsync(request);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Failed to get Spotify token. Status: {Status}, Response: {Response}",
                        response.StatusCode, responseContent);

                    // Set failure mode and record the time
                    _isInFailureMode = true;
                    _lastFailureTime = DateTime.UtcNow;

                    return TokenResult.Failure();
                }

                _logger.LogInformation("Successfully obtained new Spotify token");

                var tokenResponse = JsonSerializer.Deserialize<SpotifyTokenResponse>(responseContent,
                    new JsonSerializerOptions {PropertyNamingPolicy = JsonNamingPolicy.CamelCase});

                if (tokenResponse != null)
                {
                    _accessToken = tokenResponse.AccessToken;
                    _tokenExpiryTime = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn - 60);
                    _logger.LogDebug("Token will expire at {ExpiryTime}", _tokenExpiryTime);

                    // Reset failure mode
                    _isInFailureMode = false;

                    return TokenResult.Success(_accessToken);
                }

                // If we get here, something went wrong with token response
                _isInFailureMode = true;
                _lastFailureTime = DateTime.UtcNow;
                return TokenResult.Failure();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception occurred when getting Spotify token");
                _isInFailureMode = true;
                _lastFailureTime = DateTime.UtcNow;
                return TokenResult.Failure();
            }
        }
        finally
        {
            _semaphore.Release();
        }
    }
}