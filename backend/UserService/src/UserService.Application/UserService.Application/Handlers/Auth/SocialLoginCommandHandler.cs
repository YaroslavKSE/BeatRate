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

        _logger.LogInformation(
            "Successfully exchanged authorization code for tokens, refresh token present: {HasRefreshToken}",
            !string.IsNullOrEmpty(authTokenResponse.RefreshToken));

        // Get user info from the access token
        var userInfo = await _auth0Service.GetUserInfoAsync(authTokenResponse.AccessToken);

        // Check if the user already exists in our database
        var existingUser = await _userRepository.GetByAuth0IdAsync(userInfo.UserId);

        if (existingUser == null)
        {
            // New user - create with Google avatar
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

            // Create new user with Google avatar
            var newUser = User.Create(
                userInfo.Email,
                username,
                name,
                surname,
                userInfo.UserId,
                userInfo.Picture); // Use Google avatar for new users

            await _userRepository.AddAsync(newUser);
            await _userRepository.SaveChangesAsync();

            // Assign default role to the user in Auth0
            await _auth0Service.AssignDefaultRoleAsync(userInfo.UserId);

            _logger.LogInformation(
                "New user created from Google login: Email: {Email}, Username: {Username}, Avatar: {Avatar}",
                userInfo.Email, username, userInfo.Picture);
        }
        else
        {
            // Existing user - preserve custom avatar if it exists
            // Our database is the source of truth for avatars
            var shouldUpdateAvatar = ShouldUpdateAvatarFromGoogle(existingUser.AvatarUrl, userInfo.Picture);

            if (shouldUpdateAvatar)
            {
                existingUser.UpdateAvatar(userInfo.Picture);
                await _userRepository.SaveChangesAsync();
                _logger.LogInformation("Updated avatar for existing user from Google: {Email}, New Avatar: {Avatar}",
                    userInfo.Email, userInfo.Picture);
            }
            else
            {
                _logger.LogInformation("Preserving existing custom avatar for user: {Email}, Current Avatar: {Avatar}",
                    userInfo.Email, existingUser.AvatarUrl);
            }

            _logger.LogInformation("Existing user logged in via Google: Email: {Email}", userInfo.Email);
        }

        return new LoginResponseDto
        {
            AccessToken = authTokenResponse.AccessToken,
            RefreshToken = authTokenResponse.RefreshToken,
            ExpiresIn = authTokenResponse.ExpiresIn,
            TokenType = authTokenResponse.TokenType
        };
    }

    /// <summary>
    /// Determines if the avatar should be updated from Google login.
    /// Only updates if user doesn't have a custom avatar (uploaded to our S3).
    /// </summary>
    /// <param name="currentAvatarUrl">Current avatar URL in our database</param>
    /// <param name="googleAvatarUrl">Avatar URL from Google</param>
    /// <returns>True if avatar should be updated, false otherwise</returns>
    private bool ShouldUpdateAvatarFromGoogle(string currentAvatarUrl, string googleAvatarUrl)
    {
        // If Google doesn't have an avatar, don't update
        if (string.IsNullOrEmpty(googleAvatarUrl))
            return false;

        // If user doesn't have any avatar, use the Google one
        if (string.IsNullOrEmpty(currentAvatarUrl))
            return true;

        // If user has a custom avatar (from our S3), preserve it
        if (IsCustomS3Avatar(currentAvatarUrl))
        {
            _logger.LogInformation("User has custom S3 avatar, preserving it: {AvatarUrl}", currentAvatarUrl);
            return false;
        }

        // If current avatar is from Google but different from the new one, update it
        // This handles cases where user changed their Google profile picture
        if (IsGoogleAvatar(currentAvatarUrl) && currentAvatarUrl != googleAvatarUrl)
        {
            _logger.LogInformation("Updating Google avatar from {OldUrl} to {NewUrl}",
                currentAvatarUrl, googleAvatarUrl);
            return true;
        }

        // Same Google avatar, no need to update
        return false;
    }

    /// <summary>
    /// Checks if avatar is from our S3 bucket
    /// </summary>
    private bool IsCustomS3Avatar(string avatarUrl)
    {
        return !string.IsNullOrEmpty(avatarUrl) &&
               avatarUrl.Contains("beatrate-avatar-s3.s3.amazonaws.com", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Checks if avatar is from Google
    /// </summary>
    private bool IsGoogleAvatar(string avatarUrl)
    {
        return !string.IsNullOrEmpty(avatarUrl) &&
               avatarUrl.Contains("googleusercontent.com", StringComparison.OrdinalIgnoreCase);
    }
}