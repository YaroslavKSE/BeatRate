using System.Text.Json.Serialization;

namespace UserService.Infrastructure.Models.Auth0.Requests;

public class Auth0RefreshTokenRequest
{
    [JsonPropertyName("client_id")] public string ClientId { get; set; }
    [JsonPropertyName("client_secret")] public string ClientSecret { get; set; }
    [JsonPropertyName("refresh_token")] public string RefreshToken { get; set; }
    [JsonPropertyName("grant_type")] public string GrantType { get; set; }
}