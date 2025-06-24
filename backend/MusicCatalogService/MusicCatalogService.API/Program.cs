using System.Threading.RateLimiting;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;
using MusicCatalogService.Core.Interfaces;
using MusicCatalogService.Core.Models;
using MusicCatalogService.Core.Models.Spotify;
using MusicCatalogService.Core.Services;
using MusicCatalogService.Infrastructure.Clients;
using MusicCatalogService.Infrastructure.Configuration;
using MusicCatalogService.Infrastructure.Repositories;
using MusicCatalogService.Infrastructure.Services;


var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register serializers for special types
BsonSerializer.RegisterSerializer(new GuidSerializer(GuidRepresentation.Standard));

// MongoDB configuration
builder.Services.Configure<MongoDbSettings>(
    builder.Configuration.GetSection("MongoDb"));

// Register repositories
builder.Services.AddSingleton<ICatalogRepository, MongoCatalogRepository>();

// Configure Spotify settings
builder.Services.Configure<SpotifySettings>(
    builder.Configuration.GetSection("Spotify"));

// Configure MongoDB serialization before registering services
BsonClassMap.RegisterClassMap<CatalogItemBase>(cm =>
{
    cm.AutoMap();
    cm.SetIsRootClass(true);
});

BsonClassMap.RegisterClassMap<Album>();
BsonClassMap.RegisterClassMap<Track>();
BsonClassMap.RegisterClassMap<Artist>();
BsonClassMap.RegisterClassMap<SimplifiedArtist>();

// Register services
builder.Services.AddScoped<ITrackService, TrackService>();
builder.Services.AddScoped<IAlbumService, AlbumService>();
builder.Services.AddScoped<IArtistService, ArtistService>();
builder.Services.AddScoped<ISearchService, SearchService>();
builder.Services.AddScoped<IPreviewService, PreviewService>();
builder.Services.AddScoped<ILocalSearchRepository, LocalSearchRepository>();

// Register Redis Cache
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "MusicCatalog:";
});
builder.Services.AddScoped<ICacheService, DistributedCacheService>();

// Register HTTP clients
builder.Services.AddSingleton<ISpotifyTokenService, SpotifyTokenService>();
builder.Services.AddHttpClient<ISpotifyApiClient, SpotifyApiClient>();

// Register Spotify Preview Extractor with its own HttpClient
builder.Services.AddHttpClient<ISpotifyPreviewExtractor, SpotifyPreviewExtractor>(client =>
{
    // Configure HttpClient specifically for Spotify embed requests
    client.DefaultRequestHeaders.Add("User-Agent", 
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
    client.Timeout = TimeSpan.FromSeconds(30); // Set reasonable timeout for web scraping
});

// Configure rate limiting
var spotifySettings = builder.Configuration.GetSection("Spotify").Get<SpotifySettings>();
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(_ =>
    {
        return RateLimitPartition.GetFixedWindowLimiter("global", _ =>
            new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                PermitLimit = spotifySettings?.RateLimitPerMinute ?? 1000,
                QueueLimit = 100,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            });
    });

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            """{"error": "Too many requests. Please try again later."}""",
            token);
    };
});

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        // Get allowed origins from configuration based on environment
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

// Basic health checks
builder.Services.AddHealthChecks();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseCors("CorsPolicy");
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();

app.MapHealthChecks("/health");

app.Run();