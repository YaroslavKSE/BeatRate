namespace UserService.API.Models.Responses;

public class UserProfileResponse
{
    public Guid Id { get; set; }
    public string Email { get; set; }
    public string Name { get; set; }
    public string Surname { get; set; }

    public string Username { get; set; }

    public string AvatarUrl { get; set; }
    public string Bio { get; set; }

    public DateTime CreatedAt { get; set; }
}