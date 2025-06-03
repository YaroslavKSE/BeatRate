namespace MusicInteraction.Application.DTOs.UserServiceDTOs;

public class FollowingResponse
{
    public List<string> FollowingIds { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
    public bool HasPreviousPage { get; set; }
    public bool HasNextPage { get; set; }
}