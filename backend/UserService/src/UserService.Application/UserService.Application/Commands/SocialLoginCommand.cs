using MediatR;
using UserService.Application.DTOs;

namespace UserService.Application.Commands;

public class SocialLoginCommand : IRequest<LoginResponseDto>
{
    public string Code { get; }
    public string Provider { get; }
    public string RedirectUri { get; }

    public SocialLoginCommand(string code, string provider, string redirectUri)
    {
        Code = code;
        Provider = provider;
        RedirectUri = redirectUri;
    }
}