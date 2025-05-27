namespace UserService.Infrastructure.Configuration;

public class Auth0Settings
{
    public string Domain { get; set; }
    public string ClientId { get; set; }
    public string ClientSecret { get; set; }
    public string Audience { get; set; }

    public string ManagementApiAudience { get; set; }

    // Base OpenID scopes
    public string BaseScopes { get; set; } = "openid profile email offline_access";

    // API permissions
    public string ApiPermissions { get; set; } =
        "read:profiles write:profiles read:reviews write:reviews read:playlists write:playlists read:ratings write:ratings";

    // Combined scopes for token requests
    public string FullScopes => $"{BaseScopes} {ApiPermissions}";
    
    public List<string> AllowedRedirectUris { get; set; } = new();
}