using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using UserService.Application.DTOs;
using UserService.Application.Queries.Preferences;
using UserService.Domain.Entities;
using UserService.Domain.Exceptions;
using UserService.Domain.Interfaces;

namespace UserService.Application.Handlers.Preferences;

public class GetUserPreferencesByUsernameQueryHandler :
    IRequestHandler<GetUserPreferencesByUsernameQuery, UserPreferencesResponse>
{
    private readonly IUserRepository _userRepository;
    private readonly IUserPreferenceRepository _preferenceRepository;
    private readonly ILogger<GetUserPreferencesByUsernameQueryHandler> _logger;
    private readonly IValidator<GetUserPreferencesByUsernameQuery> _validator;

    public GetUserPreferencesByUsernameQueryHandler(
        IUserRepository userRepository,
        IUserPreferenceRepository preferenceRepository,
        ILogger<GetUserPreferencesByUsernameQueryHandler> logger,
        IValidator<GetUserPreferencesByUsernameQuery> validator)
    {
        _userRepository = userRepository;
        _preferenceRepository = preferenceRepository;
        _logger = logger;
        _validator = validator;
    }

    public async Task<UserPreferencesResponse> Handle(GetUserPreferencesByUsernameQuery request,
        CancellationToken cancellationToken)
    {
        // Validate the query
        var validationResult = await _validator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
            throw new ValidationException(validationResult.Errors);

        // Get user by username
        var user = await _userRepository.GetByUsernameAsync(request.Username);
        if (user == null)
        {
            _logger.LogWarning("User not found with username: {Username}", request.Username);
            throw new NotFoundException($"User with username {request.Username} not found");
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
            "Retrieved preferences for user {Username}: {ArtistCount} artists, {AlbumCount} albums, {TrackCount} tracks",
            user.Username, response.Artists.Count, response.Albums.Count, response.Tracks.Count);

        return response;
    }
}