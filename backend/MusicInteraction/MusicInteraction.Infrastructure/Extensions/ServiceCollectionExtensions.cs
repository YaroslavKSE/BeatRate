using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MusicInteraction.Application.Services;
using MusicInteraction.Infrastructure.Services;

namespace MusicInteraction.Infrastructure.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddExternalServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Get the UserService URL
        var userServiceUrl = configuration["Services:UserService:BaseUrl"]
                             ?? Environment.GetEnvironmentVariable("Services__UserService__BaseUrl");

        Console.WriteLine($"UserService URL: {userServiceUrl}");

        if (string.IsNullOrEmpty(userServiceUrl) || !Uri.TryCreate(userServiceUrl, UriKind.Absolute, out var validUri))
        {
            throw new InvalidOperationException($"Invalid UserService BaseUrl: {userServiceUrl}");
        }

        // Register UserService with a factory that creates HttpClient
        services.AddScoped<IUserService>(serviceProvider =>
        {
            var logger = serviceProvider.GetRequiredService<ILogger<UserService>>();
            
            // Create HttpClient manually
            var httpClient = new HttpClient()
            {
                BaseAddress = validUri,
                Timeout = TimeSpan.FromSeconds(30)
            };
            
            httpClient.DefaultRequestHeaders.Add("User-Agent", "MusicInteraction-Service/1.0");
            
            Console.WriteLine($"Manual HttpClient creation - BaseAddress: {httpClient.BaseAddress}");
            
            return new UserService(httpClient, logger);
        });

        return services;
    }
}