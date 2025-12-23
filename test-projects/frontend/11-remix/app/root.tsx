import { Outlet } from "@remix-run/react";

export default function App() {
  return (
    <html>
      <head>
        <title>Remix App</title>
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  );
}
