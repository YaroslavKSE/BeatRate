FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy all source code
COPY . .

# Restore dependencies
RUN dotnet restore "MusicLists.Presentation/MusicLists.Presentation.csproj"

# Build the project
RUN dotnet build "MusicLists.Presentation/MusicLists.Presentation.csproj" -c Release -o /app/build

# Publish the application
FROM build AS publish
RUN dotnet publish "MusicLists.Presentation/MusicLists.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Install wget for health checks
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish .

# Configure environment variables
ENV ASPNETCORE_URLS=http://+:80
ENV ASPNETCORE_HTTP_PORTS=80

# Expose port 80
EXPOSE 80

ENTRYPOINT ["dotnet", "MusicLists.Presentation.dll"]