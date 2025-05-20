using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FluentValidation;
using UserService.API.Models.Requests;
using UserService.API.Models.Responses;
using UserService.Application.Commands;
using UserService.Domain.Exceptions;
using UserService.Infrastructure.Models.Auth0.Exceptions;

namespace UserService.API.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IMediator mediator,
        ILogger<AuthController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(RegisterSuccessResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Register(RegisterUserRequest request)
    {
        try
        {
            _logger.LogInformation("Registering new user with email: {Email} and username: {Username}",
                request.Email, request.Username);

            var command = new RegisterUserCommand(
                request.Email,
                request.Password,
                request.Username,
                request.Name,
                request.Surname);

            var result = await _mediator.Send(command);

            _logger.LogInformation("User successfully registered: {Id}, Username: {Username}",
                result.UserId, result.Username);

            var response = new RegisterSuccessResponse
            {
                UserId = result.UserId,
                Message = "User created successfully"
            };

            return CreatedAtAction(
                nameof(Register),
                new {id = result.UserId},
                response);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning("Validation failed during registration: {Errors}",
                string.Join(", ", ex.Errors.Select(e => e.ErrorMessage)));

            return BadRequest(new ErrorResponse
            {
                Code = "ValidationError",
                Message = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage)),
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (UserAlreadyExistsException ex)
        {
            _logger.LogWarning("Registration failed - user already exists: {Message}", ex.Message);

            return Conflict(new ErrorResponse
            {
                Code = "UserAlreadyExists",
                Message = ex.Message,
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (UsernameAlreadyTakenException ex)
        {
            _logger.LogWarning("Registration failed - username already taken: {Message}", ex.Message);

            return Conflict(new ErrorResponse
            {
                Code = "UsernameAlreadyTaken",
                Message = ex.Message,
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (Auth0Exception ex)
        {
            _logger.LogError(ex, "Auth0 error during registration");

            return BadRequest(new ErrorResponse
            {
                Code = ex.Error.Code ?? "Auth0Error",
                Message = ex.Error.Message,
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during user registration");

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new ErrorResponse
                {
                    Code = "InternalServerError",
                    Message = "An unexpected error occurred during registration",
                    TraceId = HttpContext.TraceIdentifier
                });
        }
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        try
        {
            _logger.LogInformation("Login attempt for email: {Email}", request.Email);

            var command = new LoginCommand(
                request.Email,
                request.Password);

            var result = await _mediator.Send(command);

            _logger.LogInformation("User successfully logged in: {Email}", request.Email);

            var response = new LoginResponse
            {
                AccessToken = result.AccessToken,
                RefreshToken = result.RefreshToken,
                ExpiresIn = result.ExpiresIn,
                TokenType = result.TokenType
            };

            return Ok(response);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning("Validation failed during login: {Errors}",
                string.Join(", ", ex.Errors.Select(e => e.ErrorMessage)));

            return BadRequest(new ErrorResponse
            {
                Code = "ValidationError",
                Message = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage)),
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (Auth0Exception ex)
        {
            _logger.LogWarning("Auth0 error during login: {Error}", ex.Error.Message);

            return Unauthorized(new ErrorResponse
            {
                Code = "AuthenticationError",
                Message = ex.Message,
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during login");

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new ErrorResponse
                {
                    Code = "InternalServerError",
                    Message = "An unexpected error occurred during login",
                    TraceId = HttpContext.TraceIdentifier
                });
        }
    }

    [HttpPost("logout")]
    [ProducesResponseType(typeof(LogoutResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Logout(LogoutRequest request)
    {
        try
        {
            _logger.LogInformation("Processing logout request");

            var command = new LogoutCommand(request.RefreshToken);
            var result = await _mediator.Send(command);

            var response = new LogoutResponse
            {
                Success = result,
                Message = "Logout successful"
            };

            return Ok(response);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning("Validation failed during logout: {Errors}",
                string.Join(", ", ex.Errors.Select(e => e.ErrorMessage)));

            return BadRequest(new ErrorResponse
            {
                Code = "ValidationError",
                Message = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage)),
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during logout");

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new ErrorResponse
                {
                    Code = "InternalServerError",
                    Message = "An unexpected error occurred during logout",
                    TraceId = HttpContext.TraceIdentifier
                });
        }
    }

    [HttpPost("social-login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> SocialLogin(SocialLoginRequest request)
    {
        try
        {
            _logger.LogInformation("Processing social login for provider: {Provider}", request.Provider);

            var command = new SocialLoginCommand(
                request.AccessToken,
                request.Provider);

            var result = await _mediator.Send(command);

            _logger.LogInformation("User successfully logged in via social login: {Provider}", request.Provider);

            var response = new LoginResponse
            {
                AccessToken = result.AccessToken,
                RefreshToken = result.RefreshToken,
                ExpiresIn = result.ExpiresIn,
                TokenType = result.TokenType
            };

            return Ok(response);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning("Validation failed during social login: {Errors}",
                string.Join(", ", ex.Errors.Select(e => e.ErrorMessage)));

            return BadRequest(new ErrorResponse
            {
                Code = "ValidationError",
                Message = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage)),
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (Auth0Exception ex)
        {
            _logger.LogWarning("Auth0 error during social login: {Error}", ex.Error.Message);

            return Unauthorized(new ErrorResponse
            {
                Code = "AuthenticationError",
                Message = ex.Message,
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during social login");

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new ErrorResponse
                {
                    Code = "InternalServerError",
                    Message = "An unexpected error occurred during social login",
                    TraceId = HttpContext.TraceIdentifier
                });
        }
    }

    [HttpPost("refresh-token")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        try
        {
            _logger.LogInformation("Processing refresh token request");

            var command = new RefreshTokenCommand(request.RefreshToken);
            var result = await _mediator.Send(command);

            var response = new LoginResponse
            {
                AccessToken = result.AccessToken,
                RefreshToken = result.RefreshToken,
                ExpiresIn = result.ExpiresIn,
                TokenType = result.TokenType
            };

            return Ok(response);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning("Validation failed during token refresh: {Errors}",
                string.Join(", ", ex.Errors.Select(e => e.ErrorMessage)));

            return BadRequest(new ErrorResponse
            {
                Code = "ValidationError",
                Message = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage)),
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (Auth0Exception ex)
        {
            _logger.LogWarning("Auth0 error during token refresh: {Error}", ex.Error.Message);

            return Unauthorized(new ErrorResponse
            {
                Code = "AuthenticationError",
                Message = ex.Message,
                TraceId = HttpContext.TraceIdentifier
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during token refresh");

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new ErrorResponse
                {
                    Code = "InternalServerError",
                    Message = "An unexpected error occurred during token refresh",
                    TraceId = HttpContext.TraceIdentifier
                });
        }
    }
}