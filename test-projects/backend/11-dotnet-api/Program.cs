var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

app.MapGet("/", () => new { message = ".NET API - Testing Auto-Docker Extension" });
app.MapGet("/health", () => new { status = "healthy" });

app.Run("http://0.0.0.0:5000");
