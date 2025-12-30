package main

import (
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()
	r.GET("/api", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "Go + React API"})
	})
	r.Run("0.0.0.0:8080")
}
