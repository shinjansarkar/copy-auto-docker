defmodule PhoenixApi do
  use Application

  def start(_type, _args) do
    children = [
      {Plug.Cowboy, scheme: :http, plug: PhoenixApi.Router, options: [port: 4000]}
    ]

    opts = [strategy: :one_for_one, name: PhoenixApi.Supervisor]
    Supervisor.start_link(children, opts)
  end
end

defmodule PhoenixApi.Router do
  use Plug.Router

  plug :match
  plug :dispatch

  get "/" do
    send_resp(conn, 200, ~s({"message": "Elixir Phoenix API - Testing Auto-Docker Extension"}))
  end

  get "/health" do
    send_resp(conn, 200, ~s({"status": "healthy"}))
  end

  match _ do
    send_resp(conn, 404, "Not found")
  end
end
