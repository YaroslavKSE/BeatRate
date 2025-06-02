using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using UserService.Application.Commands;
using UserService.Application.DTOs;
using UserService.Domain.Exceptions;
using UserService.Domain.Interfaces;

namespace UserService.Application.Handlers.Avatars;

public class CompleteAvatarUploadCommandHandler : IRequestHandler<CompleteAvatarUploadCommand, UserResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<CompleteAvatarUploadCommandHandler> _logger;
    private readonly IValidator<CompleteAvatarUploadCommand> _validator;

    public CompleteAvatarUploadCommandHandler(
        IUserRepository userRepository,
        ILogger<CompleteAvatarUploadCommandHandler> logger,
        IValidator<CompleteAvatarUploadCommand> validator)
    {
        _userRepository = userRepository;
        _logger = logger;
        _validator = validator;
    }

    public async Task<UserResponse> Handle(CompleteAvatarUploadCommand command, CancellationToken cancellationToken)
    {
        // Validate the command
        var validationResult = await _validator.ValidateAsync(command, cancellationToken);
        if (!validationResult.IsValid)
            throw new ValidationException(validationResult.Errors);

        // Get the user
        var user = await _userRepository.GetByAuth0IdAsync(command.Auth0UserId);
        if (user == null)
            throw new NotFoundException($"User with Auth0 ID '{command.Auth0UserId}' not found");

        // Update our database with the new avatar URL
        // Our database is now the source of truth for avatars
        user.UpdateAvatar(command.AvatarUrl);
        await _userRepository.SaveChangesAsync();

        _logger.LogInformation("Completed avatar upload for user {UserId}: {AvatarUrl}",
            user.Id, command.AvatarUrl);

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
}