FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy all the source code
COPY . .

# Restore dependencies
RUN dotnet restore "MusicCatalogService.API/MusicCatalogService.API.csproj"

# Build the solution
RUN dotnet build "MusicCatalogService.API/MusicCatalogService.API.csproj" -c Release -o /app/build

# Publish the application
FROM build AS publish
RUN dotnet publish "MusicCatalogService.API/MusicCatalogService.API.csproj" -c Release -o /app/publish

# Final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Install wget for health checks
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish .

# Configure environment variables
ENV ASPNETCORE_URLS=http://+:80

# Expose port 80
EXPOSE 80

ENTRYPOINT ["dotnet", "MusicCatalogService.API.dll"]