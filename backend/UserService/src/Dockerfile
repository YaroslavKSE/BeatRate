FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy all the source code
COPY . .

# Navigate to solution directory and restore dependencies
WORKDIR /app/UserService.API
RUN dotnet restore "UserService.API.sln"

# Build the solution
RUN dotnet build "UserService.API.sln" -c Release -o /app/build

# Publish the application
FROM build AS publish
WORKDIR /app/UserService.API
RUN dotnet publish "UserService.API.sln" -c Release -o /app/publish

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

ENTRYPOINT ["dotnet", "UserService.API.dll"]