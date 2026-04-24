package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	gorilla "github.com/gorilla/websocket"
	"github.com/univote/backend/internal/models"
)

var upgrader = gorilla.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // En production, restreindre au domaine frontend
	},
}

// Client représente un client WebSocket connecté.
type Client struct {
	hub     *Hub
	conn    *gorilla.Conn
	send    chan []byte
	eventID string
}

// Hub gère les connexions WebSocket par événement.
type Hub struct {
	clients    map[string]map[*Client]bool // eventID → set of clients
	broadcast  chan EventMessage
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// EventMessage contient un message à broadcaster à un événement.
type EventMessage struct {
	EventID string
	Data    []byte
}

// NewHub crée un nouveau Hub WebSocket.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		broadcast:  make(chan EventMessage, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run lance la boucle principale du hub.
func (h *Hub) Run() {
	log.Println("🔌 WebSocket Hub démarré")

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, ok := h.clients[client.eventID]; !ok {
				h.clients[client.eventID] = make(map[*Client]bool)
			}
			h.clients[client.eventID][client] = true
			count := len(h.clients[client.eventID])
			h.mu.Unlock()
			log.Printf("🔌 Client connecté à l'event %s (%d clients)", client.eventID, count)

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.clients[client.eventID]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.send)
					if len(clients) == 0 {
						delete(h.clients, client.eventID)
					}
				}
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			clients := h.clients[msg.EventID]
			h.mu.RUnlock()

			for client := range clients {
				select {
				case client.send <- msg.Data:
				default:
					h.mu.Lock()
					delete(h.clients[msg.EventID], client)
					close(client.send)
					h.mu.Unlock()
				}
			}
		}
	}
}

// BroadcastToEvent envoie un message à tous les clients d'un événement.
func (h *Hub) BroadcastToEvent(eventID string, msg models.WebSocketMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.broadcast <- EventMessage{EventID: eventID, Data: data}
}

// HandleWebSocket gère une nouvelle connexion WebSocket.
// GET /ws/events/:id/scores
func (h *Hub) HandleWebSocket(c *gin.Context) {
	eventID := c.Param("id")
	if eventID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event ID requis"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("⚠️  Erreur upgrade WebSocket: %v", err)
		return
	}

	client := &Client{hub: h, conn: conn, send: make(chan []byte, 256), eventID: eventID}
	h.register <- client

	go client.writePump()
	go client.readPump()
}

// writePump envoie les messages au client.
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(gorilla.CloseMessage, []byte{})
				return
			}
			c.conn.WriteMessage(gorilla.TextMessage, message)

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(gorilla.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump lit les messages du client (ping/pong).
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}
