using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using MusicInteraction.Application.Services;
using MusicInteraction.Application.DTOs.UserServiceDTOs;

namespace MusicInteraction.Infrastructure.Services;

public class UserService : IUserService, IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<UserService> _logger;

    public UserService(HttpClient httpClient, ILogger<UserService> logger)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        
        _logger.LogDebug("UserService initialized with BaseAddress: {BaseAddress}", _httpClient.BaseAddress);
    }

    public async Task<FollowingResponse> GetFollowingUsersAsync(string userId, int page, int pageSize, CancellationToken cancellationToken)
    {
        try
        {
            _logger.LogInformation("Fetching following users for userId: {UserId}, page: {Page}, pageSize: {PageSize}", 
                userId, page, pageSize);

            var relativePath = $"api/v1/internal/following?userId={userId}&page={page}&pageSize={pageSize}";
            
            if (_httpClient.BaseAddress == null)
            {
                _logger.LogError("HttpClient BaseAddress is null!");
                return new FollowingResponse { FollowingIds = new List<string>() };
            }

            var response = await _httpClient.GetAsync(relativePath, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch following users. Status code: {StatusCode}, Reason: {Reason}", 
                    response.StatusCode, response.ReasonPhrase);
                
                return new FollowingResponse { FollowingIds = new List<string>() };
            }

            var result = await response.Content.ReadFromJsonAsync<FollowingResponse>(cancellationToken: cancellationToken);
            
            _logger.LogInformation("Successfully fetched {Count} following users for userId: {UserId}", 
                result?.FollowingIds?.Count ?? 0, userId);

            return result ?? new FollowingResponse { FollowingIds = new List<string>() };
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Request cancelled for userId: {UserId}", userId);
            return new FollowingResponse { FollowingIds = new List<string>() };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error fetching following users for userId: {UserId}", userId);
            return new FollowingResponse { FollowingIds = new List<string>() };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error fetching following users for userId: {UserId}", userId);
            return new FollowingResponse { FollowingIds = new List<string>() };
        }
    }

    public void Dispose()
    {
        _httpClient?.Dispose();
    }
}