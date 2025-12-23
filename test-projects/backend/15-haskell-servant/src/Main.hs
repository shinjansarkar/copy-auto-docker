{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TypeOperators #-}
{-# LANGUAGE DeriveGeneric #-}

module Main where

import Network.Wai.Handler.Warp
import Servant
import Data.Aeson
import GHC.Generics

data Message = Message { message :: String } deriving (Generic, Show)
data Health = Health { status :: String } deriving (Generic, Show)

instance ToJSON Message
instance ToJSON Health

type API = Get '[JSON] Message
      :<|> "health" :> Get '[JSON] Health

server :: Server API
server = return (Message "Haskell Servant API - Testing Auto-Docker Extension")
    :<|> return (Health "healthy")

api :: Proxy API
api = Proxy

app :: Application
app = serve api server

main :: IO ()
main = run 8080 app
