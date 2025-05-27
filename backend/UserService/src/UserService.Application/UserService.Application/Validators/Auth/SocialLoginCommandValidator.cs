using FluentValidation;
using UserService.Application.Commands;

namespace UserService.Application.Validators.Auth;

public class SocialLoginCommandValidator : AbstractValidator<SocialLoginCommand>
{
    public SocialLoginCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty()
            .WithMessage("Authorization code is required");

        RuleFor(x => x.Provider)
            .NotEmpty()
            .WithMessage("Provider is required");

        RuleFor(x => x.RedirectUri)
            .NotEmpty()
            .WithMessage("Redirect URI is required")
            .Must(BeValidUri)
            .WithMessage("Redirect URI must be a valid URL");
    }

    private bool BeValidUri(string uri)
    {
        return Uri.TryCreate(uri, UriKind.Absolute, out _);
    }
}