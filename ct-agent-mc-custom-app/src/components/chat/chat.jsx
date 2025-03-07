import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import Constraints from '@commercetools-uikit/constraints';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { AngleUpIcon } from '@commercetools-uikit/icons';
import { useChatConnector } from '../../hooks/use-chat-connector';
import MessageMetadata from './message-metadata';
import messages from './messages';
import styles from './chat.module.css';
import { SecondaryButton, PrimaryButton } from '@commercetools-uikit/buttons';
import { SendIcon } from '@commercetools-uikit/icons';

const LoadingIndicator = () => (
  <div className={styles.loadingContainer}>
    <div className={styles.typingDots}>
      <div className={styles.dot}></div>
      <div className={styles.dot}></div>
      <div className={styles.dot}></div>
    </div>
  </div>
);

// Custom markdown parser function
const parseMarkdown = (text) => {
  if (!text) return '';

  // First, handle the confirmation tag if present
  text = text.replace('#CONFIRMATION_NEEDED', '');

  // Process lists first to handle them properly
  let processedLists = text;
  
  // Process bullet lists (both * and - style)
  const bulletListRegex = /^[\s]*[-*][\s]+(.*?)$/gm;
  const bulletMatches = [...processedLists.matchAll(bulletListRegex)];
  
  if (bulletMatches.length > 0) {
    // Start a list
    processedLists = '<ul>\n';
    
    // Process each list item
    let lastIndex = 0;
    let inList = false;
    
    [...text.matchAll(bulletListRegex)].forEach(match => {
      const [fullMatch, content] = match;
      const startIndex = match.index;
      
      // Add non-list content before this item
      if (startIndex > lastIndex) {
        const nonListContent = text.substring(lastIndex, startIndex);
        if (nonListContent.trim()) {
          processedLists += inList ? '</ul>\n' + nonListContent + '\n<ul>\n' : nonListContent + '\n<ul>\n';
        }
      }
      
      // Add the list item
      processedLists += `<li>${content}</li>\n`;
      lastIndex = startIndex + fullMatch.length;
      inList = true;
    });
    
    // Close the list and add any remaining content
    processedLists += '</ul>\n';
    if (lastIndex < text.length) {
      processedLists += text.substring(lastIndex);
    }
  }

  // Replace headers
  let formattedText = processedLists
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // Bold and italic - process these before line breaks to prevent unwanted breaks
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Handle paragraphs - wrap content in p tags if it's not already in a tag
  // Split by double newlines to create paragraphs
  const paragraphs = formattedText.split(/\n\n+/);
  let processedText = '';
  
  paragraphs.forEach(paragraph => {
    if (paragraph.trim()) {
      // Replace single newlines with spaces within paragraphs
      // This prevents unwanted line breaks within paragraphs
      const processedParagraph = paragraph.replace(/\n/g, ' ');
      
      // Check if the paragraph is already wrapped in HTML tags
      if (!/^<(\w+)[^>]*>.*<\/\1>$/s.test(processedParagraph)) {
        processedText += `<p>${processedParagraph}</p>`;
      } else {
        processedText += processedParagraph;
      }
    }
  });

  return processedText;
};

// Move formatMessageContent outside of MessageItem component so it can be used by both components
const formatMessageContent = (content) => {
  if (!content) return '';
  
  // Parse markdown and render as HTML
  const parsedMarkdown = parseMarkdown(content);
  
  return (
    <div 
      className={styles.markdownContent}
      dangerouslySetInnerHTML={{ __html: parsedMarkdown }}
    />
  );
};

const MessageItem = ({ message, isLastInGroup, onConfirmationResponse }) => {
  const isUserMessage = message.sender === 'user';
  const isSystemMessage = message.sender === 'system';
  const [confirmationResponse, setConfirmationResponse] = useState(null);
  const isMounted = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Check if this is a confirmation message
  const isConfirmationMessage = !isUserMessage && 
    message.content.includes('#CONFIRMATION_NEEDED');
  
  const handleConfirmation = (confirmed) => {
    if (isMounted.current) {
      setConfirmationResponse(confirmed);
      if (onConfirmationResponse) {
        onConfirmationResponse(message.id, confirmed);
      }
    }
  };
  
  if (isSystemMessage) {
    return (
      <div className={styles.messageWrapper + ' ' + styles.error}>
        <div className={styles.messageItem + ' ' + styles.error}>
          <Text.Body tone="critical">
            {formatMessageContent(message.content)}
          </Text.Body>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`${styles.messageWrapper} ${styles[message.sender]}`}>
      <div className={`${styles.messageItem} ${styles[message.sender]} ${isConfirmationMessage ? styles.confirmation : ''}`}>
        {isUserMessage ? (
          <Text.Body tone="inverted">
            {formatMessageContent(message.content)}
          </Text.Body>
        ) : (
          <Text.Body>
            {formatMessageContent(message.content)}
          </Text.Body>
        )}
        
        {isConfirmationMessage && confirmationResponse === null && (
          <div className={styles.confirmationButtons}>
            <Spacings.Stack scale="s">
              <Spacings.Inline scale="s" justifyContent="flex-end">
                <SecondaryButton
                  label="No"
                  onClick={() => handleConfirmation(false)}
                />
                <PrimaryButton
                  label="Yes"
                  onClick={() => handleConfirmation(true)}
                />
              </Spacings.Inline>
            </Spacings.Stack>
          </div>
        )}
        
        {isConfirmationMessage && confirmationResponse !== null && (
          <div className={styles.confirmationResponse}>
            <Text.Body tone={confirmationResponse ? 'positive' : 'critical'}>
              {confirmationResponse ? 'Confirmed' : 'Cancelled'}
            </Text.Body>
          </div>
        )}
      </div>
      
      {!isUserMessage && message.metadata && isLastInGroup && (
        <MessageMetadata metadata={message.metadata} />
      )}
    </div>
  );
};

MessageItem.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.string.isRequired,
    sender: PropTypes.oneOf(['user', 'ai', 'system']).isRequired,
    metadata: PropTypes.shape({
      graphql_queries: PropTypes.array,
      entities: PropTypes.array,
    }),
  }).isRequired,
  isLastInGroup: PropTypes.bool.isRequired,
  onConfirmationResponse: PropTypes.func,
};

// Custom TextArea component
const CustomTextArea = forwardRef(({ value, onChange, placeholder, onKeyDown, disabled }, ref) => {
  const textareaRef = useRef(null);
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }));
  
  // Auto-resize the textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);
  
  return (
    <div className={styles.customTextAreaWrapper}>
      <textarea
        ref={textareaRef}
        className={styles.customTextArea}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        disabled={disabled}
        rows={3}
      />
    </div>
  );
});

CustomTextArea.displayName = 'CustomTextArea';

CustomTextArea.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  onKeyDown: PropTypes.func,
  disabled: PropTypes.bool,
};

// Welcome screen component
const WelcomeScreen = ({ onStartChat }) => {
  const intl = useIntl();
  const [inputValue, setInputValue] = useState('');
  const textAreaRef = useRef(null);
  
  // Focus the textarea when component mounts
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, []);
  
  const handleStartChat = () => {
    if (inputValue.trim()) {
      onStartChat(inputValue);
    }
  };
  
  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleStartChat();
    }
  };
  
  return (
    <div className={styles.welcomeScreenContainer}>
      <div className={styles.welcomeContent}>
        <h1 className={styles.welcomeTitle}>
          {intl.formatMessage(messages.title)}
        </h1>
        <h2 className={styles.welcomeSubtitle}>
          Hello! I'm your AI assistant for commercetools. How can I help you today?
        </h2>
        
        <div className={styles.welcomeInputContainer}>
          <form 
            className={styles.inputForm} 
            onSubmit={(event) => {
              event.preventDefault();
              handleStartChat();
            }}
          >
            <div className={styles.welcomeInputField}>
              <CustomTextArea
                ref={textAreaRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Ask me anything about your products, orders, customers, or any other commercetools data."
                onKeyDown={handleKeyPress}
              />
              <button
                type="submit"
                className={styles.sendButton}
                disabled={!inputValue.trim()}
                aria-label="Send message"
              >
                <AngleUpIcon className={styles.sendIcon} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

WelcomeScreen.propTypes = {
  onStartChat: PropTypes.func.isRequired,
};

const Chat = () => {
  const intl = useIntl();
  const [inputValue, setInputValue] = useState('');
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const messagesEndRef = useRef(null);
  const textAreaRef = useRef(null);
  const { messages: chatMessages, isLoading, error, sendMessage } = useChatConnector();
  const [pendingConfirmations, setPendingConfirmations] = useState({});
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && isMounted.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);
  
  // Focus the textarea when loading completes
  useEffect(() => {
    if (!isLoading && textAreaRef.current && hasStartedChat && isMounted.current) {
      textAreaRef.current.focus();
    }
  }, [isLoading, hasStartedChat]);

  const handleSendMessage = () => {
    if (inputValue.trim() && !isLoading && isMounted.current) {
      sendMessage(inputValue);
      setInputValue('');
      // Focus will be handled by the effect when loading completes
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleStartChat = (initialMessage) => {
    if (isMounted.current) {
      setHasStartedChat(true);
      sendMessage(initialMessage);
      // Focus will be set on the main chat textarea after transitioning
    }
  };
  
  const handleConfirmationResponse = (messageId, confirmed) => {
    if (isMounted.current) {
      setPendingConfirmations(prev => ({
        ...prev,
        [messageId]: confirmed
      }));
      
      if (confirmed) {
        // Simulate user saying "yes" by sending a confirmation message
        sendMessage("Yes, proceed.");
      }
    }
  };
  
  // If chat hasn't started, show welcome screen
  if (!hasStartedChat && chatMessages.length <= 1) {
    return <WelcomeScreen onStartChat={handleStartChat} />;
  }

  return (
    <div className={styles.chatPageContainer}>
      <div className={styles.chatContainer}>
        <div className={styles.messagesContainer}>
          {chatMessages.map((message, index) => (
            <MessageItem 
              key={message.id} 
              message={message}
              isLastInGroup={index === chatMessages.length - 1 || 
                chatMessages[index + 1]?.sender !== message.sender}
              onConfirmationResponse={handleConfirmationResponse}
            />
          ))}
          
          {isLoading && <LoadingIndicator />}
          
          {error && !chatMessages.some(msg => msg.sender === 'system') && (
            <div className={styles.messageWrapper + ' ' + styles.error}>
              <div className={styles.messageItem + ' ' + styles.error}>
                <Text.Body tone="critical">
                  {formatMessageContent(intl.formatMessage(messages.errorMessage))}
                </Text.Body>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div className={styles.inputContainer}>
          <form 
            className={styles.inputForm} 
            onSubmit={(event) => {
              event.preventDefault();
              handleSendMessage();
            }}
          >
            <div className={styles.inputField}>
              <CustomTextArea
                ref={textAreaRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Ask me anything about your products, orders, customers, or any other commercetools data."
                onKeyDown={handleKeyPress}
                disabled={isLoading}
              />
              <button
                type="submit"
                className={styles.sendButton}
                disabled={!inputValue.trim() || isLoading}
                aria-label="Send message"
              >
                <AngleUpIcon className={styles.sendIcon} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

Chat.displayName = 'Chat';

export default Chat; 