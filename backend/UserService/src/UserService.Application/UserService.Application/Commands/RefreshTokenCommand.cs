using MediatR;
using UserService.Application.DTOs;

namespace UserService.Application.Commands;

public class RefreshTokenCommand : IRequest<LoginResponseDto>
{
    public string RefreshToken { get; }

    public RefreshTokenCommand(string refreshToken)
    {
        RefreshToken = refreshToken;
    }
}