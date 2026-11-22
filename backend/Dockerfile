# GreenStore API image (ARCHITECTURE.md §16). UNTESTED: written on a machine without a Docker daemon, so it has never
# been built. Build it once on a machine with Docker before relying on it (docs/handoff/backend-status.md).
#
# Build context is backend/:
#   docker build -t greenstore-api backend
# Deploy step (applies migrations and the reference seed, then exits):
#   docker run --rm -e ConnectionStrings__Default=... greenstore-api migrate
# Run:
#   docker run -p 5080:8080 -e ASPNETCORE_ENVIRONMENT=Production -e ConnectionStrings__Default=... greenstore-api

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, so the package layer is cached while only source files change.
COPY global.json Directory.Build.props Directory.Packages.props .editorconfig ./
COPY src/GreenStore.Api/GreenStore.Api.csproj src/GreenStore.Api/
RUN dotnet restore src/GreenStore.Api/GreenStore.Api.csproj

COPY src/GreenStore.Api/ src/GreenStore.Api/
# The seed JSON files are published next to the binaries (GreenStore.Api.csproj, Data/Seed/Seeder.cs).
COPY seed/ seed/
RUN dotnet publish src/GreenStore.Api/GreenStore.Api.csproj -c Release -o /app --no-restore

# The default (Debian/Ubuntu) runtime image ships ICU, which the search normalisation needs
# (InvariantGlobalization=false). Do not switch to a chiseled or Alpine image without checking ICU and libvips.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    Media__LocalPath=/data/media
# Local photo storage (Media:Storage=local). Mount a volume here, or use S3 in Staging and Production (README §13).
RUN mkdir -p /data/media && chown "$APP_UID" /data/media
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
# Health checks for the orchestrator: GET /health/live and GET /health/ready (the image has no curl).
ENTRYPOINT ["dotnet", "GreenStore.Api.dll"]
