using System.Text.Json.Serialization;

namespace UserService.Infrastructure.Models.Auth0.Requests;

public class Auth0CodeExchangeRequest
{
    [JsonPropertyName("client_id")] public string ClientId { get; set; }

    [JsonPropertyName("client_secret")] public string ClientSecret { get; set; }

    [JsonPropertyName("code")] public string Code { get; set; }

    [JsonPropertyName("grant_type")] public string GrantType { get; set; } = "authorization_code";

    [JsonPropertyName("redirect_uri")] public string RedirectUri { get; set; }
    [JsonPropertyName("scope")] public string Scope { get; set; }
}