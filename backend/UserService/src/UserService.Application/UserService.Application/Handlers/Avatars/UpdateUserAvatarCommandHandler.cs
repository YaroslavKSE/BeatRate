using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using UserService.Application.Commands;
using UserService.Application.DTOs;
using UserService.Application.Interfaces;
using UserService.Domain.Exceptions;
using UserService.Domain.Interfaces;

namespace UserService.Application.Handlers.Avatars;

public class UpdateUserAvatarCommandHandler : IRequestHandler<UpdateUserAvatarCommand, UserResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IS3StorageService _s3Service;
    private readonly ILogger<UpdateUserAvatarCommandHandler> _logger;
    private readonly IValidator<UpdateUserAvatarCommand> _validator;

    public UpdateUserAvatarCommandHandler(
        IUserRepository userRepository,
        IS3StorageService s3Service,
        ILogger<UpdateUserAvatarCommandHandler> logger,
        IValidator<UpdateUserAvatarCommand> validator)
    {
        _userRepository = userRepository;
        _s3Service = s3Service;
        _logger = logger;
        _validator = validator;
    }

    public async Task<UserResponse> Handle(UpdateUserAvatarCommand command, CancellationToken cancellationToken)
    {
        // Validate the command
        var validationResult = await _validator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
            throw new ValidationException(validationResult.Errors);

        // Get the user
        var user = await _userRepository.GetByAuth0IdAsync(command.Auth0UserId);
        if (user == null)
            throw new NotFoundException($"User with Auth0 ID '{command.Auth0UserId}' not found");

        // If user already has a custom avatar, delete it from S3 first
        if (!string.IsNullOrEmpty(user.AvatarUrl) && IsCustomS3Avatar(user.AvatarUrl))
        {
            await _s3Service.DeleteUserAvatarAsync(user.Id);
            _logger.LogInformation("Deleted previous custom avatar from S3 for user {UserId}", user.Id);
        }

        // Upload the new avatar to S3
        var avatarUrl = await _s3Service.UploadUserAvatarAsync(command.File, user.Id);
        _logger.LogInformation("Uploaded new avatar to S3 for user {UserId}: {AvatarUrl}", user.Id, avatarUrl);

        // Update our database with the new avatar URL
        // Our database is the source of truth for avatars
        user.UpdateAvatar(avatarUrl);
        await _userRepository.SaveChangesAsync();

        _logger.LogInformation("Updated avatar for user {UserId} with Auth0 ID {Auth0UserId}: {AvatarUrl}",
            user.Id, command.Auth0UserId, avatarUrl);

        // Return updated user
        return new UserResponse
        {
            Id = user.Id,
            Email = user.Email,
            Username = user.Username,
            Name = user.Name,
            Surname = user.Surname,
            AvatarUrl = user.AvatarUrl,
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