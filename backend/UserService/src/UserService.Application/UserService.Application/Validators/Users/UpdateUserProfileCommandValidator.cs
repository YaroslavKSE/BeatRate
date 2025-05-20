using FluentValidation;
using UserService.Application.Commands;

namespace UserService.Application.Validators.Users;

public class UpdateUserProfileCommandValidator : AbstractValidator<UpdateUserProfileCommand>
{
    public UpdateUserProfileCommandValidator()
    {
        RuleFor(x => x.Auth0UserId)
            .NotEmpty();

        When(x => !string.IsNullOrEmpty(x.Username), () =>
        {
            RuleFor(x => x.Username)
                .MinimumLength(3)
                .MaximumLength(50)
                .Matches("^[a-zA-Z0-9_-]+$")
                .WithMessage("Username can only contain letters, numbers, underscores and hyphens")
                .WithMessage(
                    "Username must be between 3 and 50 characters and can only contain letters, numbers, underscores and hyphens");
        });

        When(x => !string.IsNullOrEmpty(x.Name), () =>
        {
            RuleFor(x => x.Name)
                .MaximumLength(100);
        });

        When(x => !string.IsNullOrEmpty(x.Surname), () =>
        {
            RuleFor(x => x.Surname)
                .MaximumLength(100);
        });

        // Add validation for the bio field
        When(x => x.Bio != null, () =>
        {
            RuleFor(x => x.Bio)
                .MaximumLength(500)
                .WithMessage("Bio must not exceed 500 characters");
        });
    }
}