import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { AngleUpIcon, CloseIcon } from '@commercetools-uikit/icons';
import styles from './floating-chat.module.css';
import { formatMessageContent } from '../chat/chat-utils';
import { useChatConnector } from '../../hooks/use-chat-connector';

// LoadingIndicator component for showing typing state
const LoadingIndicator = () => (
  <div className={styles.typingDots}>
    <span className={styles.dot}></span>
    <span className={styles.dot}></span>
    <span className={styles.dot}></span>
  </div>
);

// Custom TextArea component with auto-resize capability
const CustomTextArea = React.forwardRef(({ value, onChange, onKeyDown, disabled, placeholder }, ref) => {
  return (
    <div className={styles.customTextAreaWrapper}>
      <textarea
        ref={ref}
        className={styles.customTextArea}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        rows={1}
      />
    </div>
  );
});

CustomTextArea.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
};

CustomTextArea.displayName = 'CustomTextArea';

// MessageItem component to render chat messages
const MessageItem = ({ message }) => {
  // Check if message is in main chat format or floating chat format
  const isMainChatFormat = message.sender !== undefined;
  
  // Extract role and content based on message format
  const role = isMainChatFormat ? message.sender : message.role;
  const content = message.content;
  
  // Determine message class based on role
  const getMessageClass = () => {
    if (role === 'user') return 'user';
    if (role === 'system' || role === 'error') return 'error';
    return 'ai';
  };

  const messageClass = getMessageClass();
  
  // Ensure content is a string to prevent type errors
  const safeContent = typeof content === 'string' ? content : 
    (content ? String(content) : 'No content available');
  
  // Only apply markdown for AI/Assistant messages, not for user messages
  const shouldRenderMarkdown = (role === 'ai' || role === 'assistant');
  
  return (
    <div className={`${styles.messageWrapper} ${styles[messageClass]}`}>
      <div className={`${styles.messageItem} ${styles[messageClass]}`}>
        {role === 'user' ? (
          <span>{safeContent}</span>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: formatMessageContent(safeContent, shouldRenderMarkdown) }} />
        )}
      </div>
    </div>
  );
};

MessageItem.propTypes = {
  message: PropTypes.shape({
    content: PropTypes.string.isRequired,
    role: PropTypes.string,
    sender: PropTypes.string,
  }).isRequired,
};

const FloatingChatWindow = ({ isOpen, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const textAreaRef = useRef(null);
  const isMounted = useRef(true);
  
  // Use the same chat connector as the main chat component
  const { messages, isLoading, isStreaming, error, sendMessage } = useChatConnector();
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isStreaming]);

  // Handle resizing text area based on content
  useEffect(() => {
    if (textAreaRef.current) {
      // Reset height first to get the proper new scrollHeight
      textAreaRef.current.style.height = 'auto';
      const scrollHeight = textAreaRef.current.scrollHeight;
      textAreaRef.current.style.height = 
        scrollHeight <= 120 ? `${scrollHeight}px` : '120px';
    }
  }, [inputValue]);

  // Focus the textarea when the window opens
  useEffect(() => {
    if (isOpen && textAreaRef.current && isMounted.current) {
      textAreaRef.current.focus();
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleSendMessage = (e) => {
    e?.preventDefault();
    
    if (!inputValue.trim() || isLoading || isStreaming) return;
    
    // Use the sendMessage function from the hook
    sendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.floatingChatWindow}>
      <div className={styles.chatHeader}>
        <Text.Headline as="h2" isBold>AI Assistant</Text.Headline>
        <button 
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close chat"
        >
          <CloseIcon size="medium" />
        </button>
      </div>
      
      <div className={styles.chatWindowMessages}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <Text.Body>How can I help you today?</Text.Body>
          </div>
        ) : (
          messages.map((message, idx) => (
            <MessageItem 
              key={message.id || idx} 
              message={message}
            />
          ))
        )}
        
        {isStreaming && (
          <div className={styles.inlineTypingIndicator}>
            <LoadingIndicator />
          </div>
        )}
        
        {error && (
          <div className={styles.errorMessage}>
            <Text.Body tone="critical">
              There was an error connecting to the AI service. Please try again later.
            </Text.Body>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className={styles.chatWindowInput}>
        <form className={styles.inputForm} onSubmit={handleSendMessage}>
          <div className={styles.inputField}>
            <CustomTextArea 
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              ref={textAreaRef}
              disabled={isLoading || isStreaming}
              placeholder="Type your message here..."
              maxRows={4}
            />
            <button 
              type="submit" 
              className={styles.sendButton}
              disabled={!inputValue.trim() || isLoading || isStreaming}
              aria-label="Send message"
              title="Send message"
            >
              <AngleUpIcon 
                size="small" 
                className={styles.sendIcon} 
                color="inherit"
              />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

FloatingChatWindow.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

const FloatingChat = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => {
    setIsOpen(prev => !prev);
  };

  return (
    <div className={styles.floatingChatContainer}>
      {isOpen && (
        <FloatingChatWindow 
          isOpen={isOpen}
          onClose={toggleChat}
        />
      )}
      
      <button 
        className={styles.chatBubble}
        onClick={toggleChat}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        title={isOpen ? "Close chat" : "Open chat"}
      >
        Chat
      </button>
    </div>
  );
};

export default FloatingChat; 