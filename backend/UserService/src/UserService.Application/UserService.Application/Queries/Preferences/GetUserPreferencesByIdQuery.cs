using MediatR;
using UserService.Application.DTOs;

namespace UserService.Application.Queries.Preferences;

public class GetUserPreferencesByIdQuery : IRequest<UserPreferencesResponse>
{
    public Guid UserId { get; }

    public GetUserPreferencesByIdQuery(Guid userId)
    {
        UserId = userId;
    }
}

// UserService.Application.Queries.Preferences.GetUserPreferencesByUsernameQuery.cs