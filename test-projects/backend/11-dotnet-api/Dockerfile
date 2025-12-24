FROM mcr.microsoft.com/dotnet/sdk:7.0 AS builder

WORKDIR /app

COPY *.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:7.0

WORKDIR /app

COPY --from=builder /app/out .

EXPOSE 80

ENTRYPOINT ["dotnet", "api.dll"]
