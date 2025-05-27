using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using UserService.Application.Commands;
using UserService.Application.DTOs;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Domain.Interfaces;

namespace UserService.Application.Handlers.Auth;

public class SocialLoginCommandHandler : IRequestHandler<SocialLoginCommand, LoginResponseDto>
{
    private readonly IAuth0Service _auth0Service;
    private readonly IUserRepository _userRepository;
    private readonly ILogger<SocialLoginCommandHandler> _logger;
    private readonly IValidator<SocialLoginCommand> _validator;

    public SocialLoginCommandHandler(
        IAuth0Service auth0Service,
        IUserRepository userRepository,
        ILogger<SocialLoginCommandHandler> logger,
        IValidator<SocialLoginCommand> validator)
    {
        _auth0Service = auth0Service;
        _userRepository = userRepository;
        _logger = logger;
        _validator = validator;
    }

    public async Task<LoginResponseDto> Handle(SocialLoginCommand request, CancellationToken cancellationToken)
    {
        // Validate the request
        var validationResult = await _validator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid) throw new ValidationException(validationResult.Errors);

        // Exchange authorization code for tokens
        var authTokenResponse = await _auth0Service.ExchangeCodeForTokensAsync(request.Code, request.RedirectUri);
        
        _logger.LogInformation("Successfully exchanged authorization code for tokens, refresh token present: {HasRefreshToken}", 
            !string.IsNullOrEmpty(authTokenResponse.RefreshToken));

        // Get user info from the access token
        var userInfo = await _auth0Service.GetUserInfoAsync(authTokenResponse.AccessToken);

        // Check if the user already exists in our database
        var existingUser = await _userRepository.GetByAuth0IdAsync(userInfo.UserId);

        if (existingUser == null)
        {
            // Extract name and surname from user info
            var name = string.IsNullOrEmpty(userInfo.Name) ? "User" : userInfo.Name;
            var surname = string.IsNullOrEmpty(userInfo.Surname) ? "" : userInfo.Surname;

            // Use the username from userInfo (already processed for uniqueness in Auth0Service)
            var username = userInfo.Username;

            // Ensure username is unique in our database
            var attempt = 1;
            var candidateUsername = username;
            while (await _userRepository.GetByUsernameAsync(candidateUsername) != null)
                candidateUsername = $"{username}{attempt++}";
            username = candidateUsername;

            // Create new user
            var newUser = User.Create(
                userInfo.Email,
                username,
                name,
                surname,
                userInfo.UserId,
                userInfo.Picture); // Set avatar URL from social provider

            await _userRepository.AddAsync(newUser);
            await _userRepository.SaveChangesAsync();

            // Assign default role to the user in Auth0
            await _auth0Service.AssignDefaultRoleAsync(userInfo.UserId);

            _logger.LogInformation(
                "New user created from social login: {Provider}, Email: {Email}, Username: {Username}",
                request.Provider, userInfo.Email, username);
        }
        else
        {
            // Update avatar if it's provided and different
            if (!string.IsNullOrEmpty(userInfo.Picture) && userInfo.Picture != existingUser.AvatarUrl)
            {
                existingUser.UpdateAvatar(userInfo.Picture);
                await _userRepository.SaveChangesAsync();
                _logger.LogInformation("Updated avatar for existing user: {Email}", userInfo.Email);
            }

            _logger.LogInformation("Existing user logged in via social login: {Provider}, Email: {Email}",
                request.Provider, userInfo.Email);
        }

        return new LoginResponseDto
        {
            AccessToken = authTokenResponse.AccessToken,
            RefreshToken = authTokenResponse.RefreshToken,
            ExpiresIn = authTokenResponse.ExpiresIn,
            TokenType = authTokenResponse.TokenType
        };
    }
}