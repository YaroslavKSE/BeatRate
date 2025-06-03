using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MusicInteraction.Infrastructure.Auth0;
using MusicInteraction.Infrastructure.Extensions;
using MusicInteraction.Infrastructure.MongoDB;
using MusicInteraction.Infrastructure.PostgreSQL;

// Add services to the container.
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Music Interaction API",
        Version = "v1",
        Description = "API for managing music interactions"
    });

    // Add JWT authentication to Swagger
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Authorization header using the Bearer scheme."
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            []
        }
    });
});

// Register MongoDB services for grading methods
builder.Services.AddMongoDbServices();

// Register PostgreSQL services for interactions
builder.Services.AddPostgreSQLServices();

// Register external services (User Service, etc.)
builder.Services.AddExternalServices(builder.Configuration);

// Register MediatR services
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(PostInteractionCommand).Assembly));

// Auth0 Configuration
builder.Services.Configure<Auth0Settings>(
    builder.Configuration.GetSection("Auth0"));

// JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.Authority = $"https://{builder.Configuration["Auth0:Domain"]}/";
    options.Audience = builder.Configuration["Auth0:Audience"];

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        NameClaimType = ClaimTypes.NameIdentifier,
        RoleClaimType = "permissions"
    };

    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = context =>
        {
            var identity = context.Principal.Identity as ClaimsIdentity;
            var nameIdClaim = context.Principal.FindFirst(ClaimTypes.NameIdentifier);

            if (nameIdClaim != null && !context.Principal.HasClaim(c => c.Type == "sub"))
                identity?.AddClaim(new Claim("sub", nameIdClaim.Value));

            return Task.CompletedTask;
        },
        OnAuthenticationFailed = context =>
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogError($"Authentication failed: {context.Exception}");
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        
        var logger = builder.Services.BuildServiceProvider().GetRequiredService<ILogger<Program>>();
        logger.LogInformation("Environment: {Environment}", builder.Environment.EnvironmentName);
        logger.LogInformation("CORS configured with allowed origins: {Origins}", 
            allowedOrigins.Length > 0 ? string.Join(", ", allowedOrigins) : "none");
        
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

builder.Services.AddAuthorization();
builder.Services.AddHealthChecks();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("CorsPolicy");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();