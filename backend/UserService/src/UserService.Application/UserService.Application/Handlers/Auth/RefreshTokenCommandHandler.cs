using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using UserService.Application.Commands;
using UserService.Application.DTOs;
using UserService.Application.Interfaces;

namespace UserService.Application.Handlers.Auth;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, LoginResponseDto>
{
    private readonly IAuth0Service _auth0Service;
    private readonly ILogger<RefreshTokenCommandHandler> _logger;
    private readonly IValidator<RefreshTokenCommand> _validator;

    public RefreshTokenCommandHandler(
        IAuth0Service auth0Service,
        ILogger<RefreshTokenCommandHandler> logger,
        IValidator<RefreshTokenCommand> validator)
    {
        _auth0Service = auth0Service;
        _logger = logger;
        _validator = validator;
    }

    public async Task<LoginResponseDto> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        // Validate the request
        var validationResult = await _validator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid) throw new ValidationException(validationResult.Errors);

        // Call Auth0 to refresh the token
        var authTokenResponse = await _auth0Service.RefreshTokenAsync(request.RefreshToken);

        _logger.LogInformation("Token refreshed successfully");

        // Map the auth token response to our response DTO
        return new LoginResponseDto
        {
            AccessToken = authTokenResponse.AccessToken,
            RefreshToken = authTokenResponse.RefreshToken,
            ExpiresIn = authTokenResponse.ExpiresIn,
            TokenType = authTokenResponse.TokenType
        };
    }
}