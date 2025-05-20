using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using UserService.Application.DTOs;
using UserService.Application.Queries.Preferences;
using UserService.Domain.Entities;
using UserService.Domain.Exceptions;
using UserService.Domain.Interfaces;

namespace UserService.Application.Handlers.Preferences;

public class GetUserPreferencesByIdQueryHandler : IRequestHandler<GetUserPreferencesByIdQuery, UserPreferencesResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IUserPreferenceRepository _preferenceRepository;
    private readonly ILogger<GetUserPreferencesByIdQueryHandler> _logger;
    private readonly IValidator<GetUserPreferencesByIdQuery> _validator;

    public GetUserPreferencesByIdQueryHandler(
        IUserRepository userRepository,
        IUserPreferenceRepository preferenceRepository,
        ILogger<GetUserPreferencesByIdQueryHandler> logger,
        IValidator<GetUserPreferencesByIdQuery> validator)
    {
        _userRepository = userRepository;
        _preferenceRepository = preferenceRepository;
        _logger = logger;
        _validator = validator;
    }

    public async Task<UserPreferencesResponse> Handle(GetUserPreferencesByIdQuery request,
        CancellationToken cancellationToken)
    {
        // Validate the query
        var validationResult = await _validator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
            throw new ValidationException(validationResult.Errors);

        // Get user by ID
        var user = await _userRepository.GetByIdAsync(request.UserId);
        if (user == null)
        {
            _logger.LogWarning("User not found with ID: {UserId}", request.UserId);
            throw new NotFoundException($"User with ID {request.UserId} not found");
        }

        // Get user preferences grouped by type
        var preferences = await _preferenceRepository.GetUserPreferencesAsync(user.Id);

        // Map to response
        var response = new UserPreferencesResponse
        {
            Artists = preferences.TryGetValue(PreferenceType.Artist, out var artists) ? artists : new List<string>(),
            Albums = preferences.TryGetValue(PreferenceType.Album, out var albums) ? albums : new List<string>(),
            Tracks = preferences.TryGetValue(PreferenceType.Track, out var tracks) ? tracks : new List<string>()
        };

        _logger.LogInformation(
            "Retrieved preferences for user {UserId}: {ArtistCount} artists, {AlbumCount} albums, {TrackCount} tracks",
            user.Id, response.Artists.Count, response.Albums.Count, response.Tracks.Count);

        return response;
    }
}