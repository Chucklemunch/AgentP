export interface Message {
  role: 'user' | 'perry';
  content: string;
}

export interface ChatResponse {
  response: string;
  history: unknown[];
}
