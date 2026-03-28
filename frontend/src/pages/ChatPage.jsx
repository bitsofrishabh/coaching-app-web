import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Eye, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";

export function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get("/coach/chats");
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error("Failed to load chats");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const loadMessages = async (clientId) => {
    try {
      const res = await api.get(`/coach/chat/${clientId}/messages`);
      setMessages(res.data.messages || []);
      setSelectedConv(conversations.find((c) => c.client_id === clientId));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      toast.error("Failed to load messages");
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv) return;

    setSending(true);
    try {
      const res = await api.post(`/coach/chat/${selectedConv.client_id}/send`, {
        content: newMessage,
        message_type: "text"
      });
      setMessages([...messages, res.data]);
      setNewMessage("");
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      fetchConversations();
    } catch (err) {
      toast.error("Failed to send message");
    }
    setSending(false);
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6 animate-fade-in" data-testid="chat-page">
      <Card className="w-80 shrink-0 border-border/40 bg-card/50 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-['Manrope'] text-lg">Messages</CardTitle>
            {totalUnread > 0 && (
              <Badge className="bg-primary text-primary-foreground">{totalUnread}</Badge>
            )}
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : conversations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv.client_id)}
                  data-testid={`chat-conv-${conv.client_id}`}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    selectedConv?.id === conv.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {conv.client_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{conv.client_name}</p>
                      {conv.unread_count > 0 && (
                        <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.last_message.sender_type === "coach" ? "You: " : ""}
                        {conv.last_message.content}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex-1 border-border/40 bg-card/50 flex flex-col">
        {selectedConv ? (
          <>
            <div className="p-4 border-b border-border/50 flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary/20 text-primary">
                  {selectedConv.client_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedConv.client_name}</p>
                <p className="text-xs text-muted-foreground">Client</p>
              </div>
              <div className="ml-auto">
                <Link to={`/clients/${selectedConv.client_id}`}>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-1" /> View Profile
                  </Button>
                </Link>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_type === "coach" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      msg.sender_type === "coach"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.sender_type === "coach" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <form onSubmit={sendMessage} className="p-4 border-t border-border/50 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                data-testid="chat-message-input"
                className="flex-1"
              />
              <Button type="submit" data-testid="send-message-btn" disabled={sending || !newMessage.trim()} className="bg-primary text-primary-foreground">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
