using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using UserService.Application.Commands;
using UserService.Application.DTOs;
using UserService.Application.Interfaces;
using UserService.Domain.Exceptions;
using UserService.Domain.Interfaces;

namespace UserService.Application.Handlers.Avatars;

public class DeleteUserAvatarCommandHandler : IRequestHandler<DeleteUserAvatarCommand, UserResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IS3StorageService _s3Service;
    private readonly ILogger<DeleteUserAvatarCommandHandler> _logger;
    private readonly IValidator<DeleteUserAvatarCommand> _validator;

    public DeleteUserAvatarCommandHandler(
        IUserRepository userRepository,
        IS3StorageService s3Service,
        ILogger<DeleteUserAvatarCommandHandler> logger,
        IValidator<DeleteUserAvatarCommand> validator)
    {
        _userRepository = userRepository;
        _s3Service = s3Service;
        _logger = logger;
        _validator = validator;
    }

    public async Task<UserResponse> Handle(DeleteUserAvatarCommand command, CancellationToken cancellationToken)
    {
        // Validate the command
        var validationResult = await _validator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
            throw new ValidationException(validationResult.Errors);

        // Get the user
        var user = await _userRepository.GetByAuth0IdAsync(command.Auth0UserId);
        if (user == null)
            throw new NotFoundException($"User with Auth0 ID '{command.Auth0UserId}' not found");

        // Delete from S3 if it's a custom avatar from our S3
        if (!string.IsNullOrEmpty(user.AvatarUrl) && IsCustomS3Avatar(user.AvatarUrl))
        {
            var deleted = await _s3Service.DeleteUserAvatarAsync(user.Id);
            if (!deleted)
                _logger.LogWarning("Failed to delete avatar from S3 for user {UserId}", user.Id);
            else
                _logger.LogInformation("Deleted avatar from S3 for user {UserId}: {AvatarUrl}",
                    user.Id, user.AvatarUrl);
        }

        // Clear avatar in our database
        //  is the source of truth for avatars
        user.UpdateAvatar(null);
        await _userRepository.SaveChangesAsync();

        _logger.LogInformation("Deleted avatar for user {UserId} with Auth0 ID {Auth0UserId}. " +
                               "Next Google login will restore Google profile picture if available.",
            user.Id, command.Auth0UserId);

        // Return updated user
        return new UserResponse
        {
            Id = user.Id,
            Email = user.Email,
            Username = user.Username,
            Name = user.Name,
            Surname = user.Surname,
            AvatarUrl = user.AvatarUrl, // Should be null now
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }

    /// <summary>
    /// Checks if avatar is from our S3 bucket (to decide if we should delete it)
    /// </summary>
    private bool IsCustomS3Avatar(string avatarUrl)
    {
        return !string.IsNullOrEmpty(avatarUrl) &&
               avatarUrl.Contains("beatrate-avatar-s3.s3.amazonaws.com", StringComparison.OrdinalIgnoreCase);
    }
}