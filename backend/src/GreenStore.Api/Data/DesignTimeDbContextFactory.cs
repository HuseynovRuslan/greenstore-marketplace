using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace GreenStore.Api.Data;

/// <summary>
/// Used by <c>dotnet ef</c> (migrations add / script) so it does not have to start the web host. Reads
/// <c>ConnectionStrings__Default</c> from the environment, otherwise the local development database.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    private const string DevelopmentConnection = "Host=localhost;Port=5432;Database=greenstore;Username=greenstore;Password=greenstore_dev";

    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable($"ConnectionStrings__{DatabaseSetup.ConnectionStringName}");
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, string.IsNullOrWhiteSpace(connectionString) ? DevelopmentConnection : connectionString);
        return new AppDbContext(options.Options);
    }
}
