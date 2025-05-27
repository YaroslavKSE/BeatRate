using UserService.Application.DTOs;

namespace UserService.Application.Interfaces;

public interface IAuth0Service
{
    Task<string> CreateUserAsync(string email, string password);
    Task<AuthTokenResponse> LoginAsync(string email, string password);
    Task<bool> LogoutAsync(string refreshToken);
    Task<UserInfoDto> GetUserInfoAsync(string accessToken);
    Task AssignDefaultRoleAsync(string userId);
    Task<bool> UpdateUserPictureAsync(string auth0UserId, string pictureUrl);
    Task<AuthTokenResponse> RefreshTokenAsync(string refreshToken);
    Task<AuthTokenResponse> ExchangeCodeForTokensAsync(string code, string redirectUri);
}