export function clearAllConversations() {
  return {};
}

export function clearConversation(allMessages, chatKey) {
  const next = { ...allMessages };
  delete next[chatKey];
  return next;
}

export function deleteConversationMessage(allMessages, chatKey, messageId) {
  const messages = (allMessages[chatKey] || []).filter(message => message.id !== messageId);
  return { ...allMessages, [chatKey]: messages };
}
