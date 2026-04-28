# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

# Copy csproj and restore
COPY src/Resala.Backend/*.csproj ./src/Resala.Backend/
RUN dotnet restore src/Resala.Backend/Resala.Backend.csproj

# Copy everything else and build
COPY src/Resala.Backend/ ./src/Resala.Backend/
WORKDIR /app/src/Resala.Backend
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Expose port and start
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "Resala.Backend.dll"]
