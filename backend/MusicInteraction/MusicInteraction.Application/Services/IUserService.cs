using MusicInteraction.Application.DTOs.UserServiceDTOs;

namespace MusicInteraction.Application.Services;

public interface IUserService
{
    Task<FollowingResponse> GetFollowingUsersAsync(string userId, int page, int pageSize, CancellationToken cancellationToken);
}