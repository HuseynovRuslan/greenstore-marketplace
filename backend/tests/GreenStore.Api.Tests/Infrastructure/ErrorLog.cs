using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>A logger provider that collects the messages logged at Error level or above.</summary>
internal sealed class ErrorLog : ILoggerProvider
{
    private readonly ConcurrentQueue<LoggedError> errors = new();

    public IReadOnlyCollection<LoggedError> Errors => errors;

    public ILogger CreateLogger(string categoryName) => new Logger(this, categoryName);

    public void Dispose()
    {
    }

    private sealed class Logger(ErrorLog log, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Error;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (IsEnabled(logLevel))
            {
                log.errors.Enqueue(new LoggedError(category, formatter(state, exception)));
            }
        }
    }
}

internal sealed record LoggedError(string Category, string Message);
