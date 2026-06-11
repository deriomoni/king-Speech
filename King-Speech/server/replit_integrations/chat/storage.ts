export interface Conversation {
  id: number;
  title: string;
  createdAt: Date;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
}

export interface IChatStorage {
  getConversation(id: number): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<ChatMessage[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<ChatMessage>;
}

let nextConversationId = 1;
let nextMessageId = 1;
const conversations = new Map<number, Conversation>();
const messages = new Map<number, ChatMessage[]>();

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    return conversations.get(id);
  },

  async getAllConversations() {
    return [...conversations.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  },

  async createConversation(title: string) {
    const conversation: Conversation = {
      id: nextConversationId++,
      title,
      createdAt: new Date(),
    };
    conversations.set(conversation.id, conversation);
    messages.set(conversation.id, []);
    return conversation;
  },

  async deleteConversation(id: number) {
    conversations.delete(id);
    messages.delete(id);
  },

  async getMessagesByConversation(conversationId: number) {
    return [...(messages.get(conversationId) ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const message: ChatMessage = {
      id: nextMessageId++,
      conversationId,
      role,
      content,
      createdAt: new Date(),
    };
    const list = messages.get(conversationId) ?? [];
    list.push(message);
    messages.set(conversationId, list);
    return message;
  },
};
