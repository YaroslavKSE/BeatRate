namespace UserService.API.Models.Requests;

public class SocialLoginRequest
{
    public string Code { get; set; }
    public string Provider { get; set; }
    public string RedirectUri { get; set; }
}