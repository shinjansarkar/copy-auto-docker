defmodule PhoenixApi.MixProject do
  use Mix.Project

  def project do
    [
      app: :phoenix_api,
      version: "1.0.0",
      elixir: "~> 1.14",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      mod: {PhoenixApi.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  defp deps do
    [
      {:phoenix, "~> 1.7.0"},
      {:plug_cowboy, "~> 2.6"}
    ]
  end
end
