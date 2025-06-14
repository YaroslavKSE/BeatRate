using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using UserService.Application.DTOs;
using UserService.Application.Interfaces;
using UserService.Infrastructure.Configuration;
using UserService.Infrastructure.Models.Auth0.Exceptions;
using UserService.Infrastructure.Models.Auth0.Requests;
using UserService.Infrastructure.Models.Auth0.Responses;

namespace UserService.Infrastructure.Services;

public class Auth0Service : IAuth0Service
{
    private readonly HttpClient _httpClient;
    private readonly Auth0Settings _settings;
    private readonly ILogger<Auth0Service> _logger;
    private string _managementApiToken;
    private DateTime _tokenExpirationTime;

    public Auth0Service(
        HttpClient httpClient,
        IOptions<Auth0Settings> settings,
        ILogger<Auth0Service> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<string> CreateUserAsync(string email, string password)
    {
        try
        {
            await EnsureManagementApiToken();

            var createUserRequest = new Auth0CreateUserRequest
            {
                Email = email,
                Password = password,
                Connection = "Username-Password-Authentication",
                VerifyEmail = true
            };

            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _managementApiToken);

            var response = await _httpClient.PostAsJsonAsync(
                $"https://{_settings.Domain}/api/v2/users",
                createUserRequest);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to create Auth0 user. Status: {Status}, Error: {Error}",
                    response.StatusCode, error);
                throw new Auth0Exception(error);
            }

            var result = await response.Content.ReadFromJsonAsync<Auth0UserResponse>();

            await AssignRoleToUserAsync(result.UserId);
            return result.UserId;
        }
        catch (Exception ex) when (ex is not Auth0Exception)
        {
            _logger.LogError(ex, "Error creating Auth0 user for email {Email}", email);
            throw new Auth0Exception("Failed to create Auth0 user", ex);
        }
    }

    private async Task AssignRoleToUserAsync(string userId)
    {
        try
        {
            // The role ID for your default user role - use the one from your screenshot
            var defaultRoleId = "rol_ELrBo6tr0kx7blQ9";

            var roleAssignmentRequest = new
            {
                roles = new[] {defaultRoleId}
            };

            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _managementApiToken);

            var response = await _httpClient.PostAsJsonAsync(
                $"https://{_settings.Domain}/api/v2/users/{userId}/roles",
                roleAssignmentRequest);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to assign role to user. Status: {Status}, Error: {Error}",
                    response.StatusCode, error);

                // Log but don't throw - user is created but role assignment failed
                _logger.LogWarning("User created but role assignment failed for userId: {UserId}", userId);
            }
            else
            {
                _logger.LogInformation("Default role assigned successfully to user: {UserId}", userId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning role to user {UserId}", userId);
            // Log but don't throw - the user is created but role assignment failed
        }
    }

    public async Task<AuthTokenResponse> LoginAsync(string email, string password)
    {
        try
        {
            var tokenRequest = new Auth0PasswordTokenRequest
            {
                ClientId = _settings.ClientId,
                ClientSecret = _settings.ClientSecret,
                Audience = _settings.Audience,
                Username = email,
                Password = password,
                Realm = "Username-Password-Authentication",
                Scope = _settings.FullScopes
            };

            var response = await _httpClient.PostAsJsonAsync(
                $"https://{_settings.Domain}/oauth/token",
                tokenRequest);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Login failed. Status: {Status}, Error: {Error}",
                    response.StatusCode, error);
                throw new Auth0Exception(error);
            }

            var auth0Response = await response.Content.ReadFromJsonAsync<Auth0TokenResponse>();

            // Map to application layer DTO
            return new AuthTokenResponse
            {
                AccessToken = auth0Response.AccessToken,
                RefreshToken = auth0Response.RefreshToken,
                ExpiresIn = auth0Response.ExpiresIn,
                TokenType = auth0Response.TokenType
            };
        }
        catch (Exception ex) when (ex is not Auth0Exception)
        {
            _logger.LogError(ex, "Error during login for email {Email}", email);
            throw new Auth0Exception("Login failed", ex);
        }
    }

    private async Task EnsureManagementApiToken()
    {
        if (_managementApiToken != null && DateTime.UtcNow < _tokenExpirationTime) return;

        var tokenRequest = new Auth0TokenRequest
        {
            ClientId = _settings.ClientId,
            ClientSecret = _settings.ClientSecret,
            Audience = _settings.ManagementApiAudience,
            GrantType = "client_credentials"
        };

        var response = await _httpClient.PostAsJsonAsync(
            $"https://{_settings.Domain}/oauth/token",
            tokenRequest);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError("Failed to obtain management API token. Status: {Status}, Error: {Error}",
                response.StatusCode, error);
            throw new Auth0Exception("Failed to obtain management API token");
        }

        var result = await response.Content.ReadFromJsonAsync<Auth0TokenResponse>();
        _managementApiToken = result.AccessToken;
        _tokenExpirationTime = DateTime.UtcNow.AddSeconds(result.ExpiresIn - 60); // Buffer of 60 seconds
    }

    public async Task<bool> LogoutAsync(string refreshToken)
    {
        try
        {
            // Auth0 requires revoking the refresh token
            var revokeRequest = new Auth0RevokeTokenRequest
            {
                ClientId = _settings.ClientId,
                ClientSecret = _settings.ClientSecret,
                Token = refreshToken
            };

            var response = await _httpClient.PostAsJsonAsync(
                $"https://{_settings.Domain}/oauth/revoke",
                revokeRequest);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to revoke refresh token. Status: {Status}, Error: {Error}",
                    response.StatusCode, error);

                // Even if token revocation fails, we'll still consider this a successful logout
                // The token might be invalid or already expired
                _logger.LogWarning("Continuing with logout despite token revocation failure");
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during logout");
            // Return true even if there's an error, as we want the frontend to clear tokens regardless
            return true;
        }
    }

    public async Task<UserInfoDto> GetUserInfoAsync(string accessToken)
    {
        try
        {
            // Set the Authorization header to use the provided token
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", accessToken);

            var response = await _httpClient.GetAsync($"https://{_settings.Domain}/userinfo");

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to get user info. Status: {Status}, Error: {Error}",
                    response.StatusCode, error);
                throw new Auth0Exception(error);
            }

            var userInfo = await response.Content.ReadFromJsonAsync<Auth0UserInfoResponse>();

            // Use nickname from Auth0 as username
            var username = userInfo.Nickname;

            // Fallback options if nickname is empty
            if (string.IsNullOrEmpty(username))
            {
                if (!string.IsNullOrEmpty(userInfo.Email) && userInfo.Email.Contains('@'))
                    username = userInfo.Email.Split('@')[0];
                else if (!string.IsNullOrEmpty(userInfo.Name))
                    username = userInfo.Name.Replace(" ", "").ToLower();
                else
                    username = "user";
            }

            // Ensure username is valid by removing special characters
            username = System.Text.RegularExpressions.Regex.Replace(username, "[^a-zA-Z0-9_-]", "");

            // Parse name and surname properly
            var firstName = "";
            var lastName = "";

            if (!string.IsNullOrEmpty(userInfo.GivenName))
            {
                firstName = userInfo.GivenName.Trim();
            }
            
            if (!string.IsNullOrEmpty(userInfo.FamilyName))
            {
                lastName = userInfo.FamilyName.Trim();
            }

            // If given_name/family_name are not available, try to parse the full name
            if (string.IsNullOrEmpty(firstName) && string.IsNullOrEmpty(lastName) && !string.IsNullOrEmpty(userInfo.Name))
            {
                var nameParts = userInfo.Name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (nameParts.Length > 0)
                {
                    firstName = nameParts[0];
                    if (nameParts.Length > 1)
                    {
                        lastName = string.Join(" ", nameParts.Skip(1));
                    }
                }
            }

            // Fallback values
            if (string.IsNullOrEmpty(firstName))
            {
                firstName = "User";
            }

            return new UserInfoDto
            {
                UserId = userInfo.Sub,
                Email = userInfo.Email,
                Username = username,
                Name = firstName,
                Surname = lastName,
                Picture = null // Don't use Google avatars to avoid 429 errors
            };
        }
        catch (Exception ex) when (ex is not Auth0Exception)
        {
            _logger.LogError(ex, "Error getting user info with access token");
            throw new Auth0Exception("Failed to get user info", ex);
        }
    }

    public async Task<bool> UpdateUserPictureAsync(string auth0UserId, string pictureUrl)
    {
        try
        {
            await EnsureManagementApiToken();

            // Prepare update request
            var updateRequest = new
            {
                picture = pictureUrl
            };

            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _managementApiToken);

            var response = await _httpClient.PatchAsJsonAsync(
                $"https://{_settings.Domain}/api/v2/users/{auth0UserId}",
                updateRequest);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to update Auth0 user picture. Status: {Status}, Error: {Error}",
                    response.StatusCode, error);
                return false;
            }

            _logger.LogInformation("Successfully updated picture for Auth0 user: {Auth0UserId}", auth0UserId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating picture for Auth0 user: {Auth0UserId}", auth0UserId);
            return false;
        }
    }

    public async Task AssignDefaultRoleAsync(string userId)
    {
        try
        {
            await EnsureManagementApiToken();
            await AssignRoleToUserAsync(userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning default role to user {UserId}", userId);
            // Don't throw, as role assignment is secondary to authentication
        }
    }

    public async Task<AuthTokenResponse> RefreshTokenAsync(string refreshToken)
    {
        try
        {
            var tokenRequest = new Auth0RefreshTokenRequest
            {
                ClientId = _settings.ClientId,
                ClientSecret = _settings.ClientSecret,
                RefreshToken = refreshToken,
                GrantType = "refresh_token"
            };

            var response = await _httpClient.PostAsJsonAsync(
                $"https://{_settings.Domain}/oauth/token",
                tokenRequest);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Token refresh failed. Status: {Status}, Error: {Error}",
                    response.StatusCode, error);
                throw new Auth0Exception(error);
            }

            var auth0Response = await response.Content.ReadFromJsonAsync<Auth0TokenResponse>();

            // Map to application layer DTO
            return new AuthTokenResponse
            {
                AccessToken = auth0Response.AccessToken,
                RefreshToken = auth0Response.RefreshToken,
                ExpiresIn = auth0Response.ExpiresIn,
                TokenType = auth0Response.TokenType
            };
        }
        catch (Exception ex) when (ex is not Auth0Exception)
        {
            _logger.LogError(ex, "Error during token refresh");
            throw new Auth0Exception("Token refresh failed", ex);
        }
    }

    public async Task<AuthTokenResponse> ExchangeCodeForTokensAsync(string code, string redirectUri)
    {
        try
        {
            var tokenRequest = new Auth0CodeExchangeRequest
            {
                ClientId = _settings.ClientId,
                ClientSecret = _settings.ClientSecret,
                Code = code,
                RedirectUri = redirectUri,
                Scope = _settings.FullScopes
            };

            _logger.LogInformation(
                "Token exchange request: ClientId={ClientId}, RedirectUri={RedirectUri}, CodeLength={CodeLength}",
                _settings.ClientId, redirectUri, code.Length);

            var response = await _httpClient.PostAsJsonAsync(
                $"https://{_settings.Domain}/oauth/token",
                tokenRequest);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Code exchange failed. Status: {Status}, Error: {Error}",
                    response.StatusCode, error);
                throw new Auth0Exception(error);
            }

            await response.Content.ReadAsStringAsync();
            var auth0Response = await response.Content.ReadFromJsonAsync<Auth0TokenResponse>();

            _logger.LogInformation("Successfully exchanged authorization code for tokens");

            // Map to application layer DTO
            return new AuthTokenResponse
            {
                AccessToken = auth0Response.AccessToken,
                RefreshToken = auth0Response.RefreshToken,
                ExpiresIn = auth0Response.ExpiresIn,
                TokenType = auth0Response.TokenType
            };
        }
        catch (Exception ex) when (ex is not Auth0Exception)
        {
            _logger.LogError(ex, "Error exchanging authorization code for tokens");
            throw new Auth0Exception("Failed to exchange authorization code for tokens", ex);
        }
    }
}