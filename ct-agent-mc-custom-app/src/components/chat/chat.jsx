import { useState, useRef, useEffect } from 'react';
import { useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import Constraints from '@commercetools-uikit/constraints';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextField from '@commercetools-uikit/text-field';
import PrimaryButton from '@commercetools-uikit/primary-button';
import { useChatConnector } from '../../hooks/use-chat-connector';
import MessageMetadata from './message-metadata';
import messages from './messages';
import styles from './chat.module.css';

const LoadingIndicator = () => (
  <div className={`${styles.messageItem} ${styles.aiMessage} ${styles.loadingContainer}`}>
    <div className={styles.typingDots}>
      <div className={styles.dot}></div>
      <div className={styles.dot}></div>
      <div className={styles.dot}></div>
    </div>
  </div>
);

const MessageItem = ({ message }) => {
  const isUserMessage = message.sender === 'user';
  const isSystemMessage = message.sender === 'system';
  
  let messageClassName = styles.messageItem;
  if (isUserMessage) {
    messageClassName += ` ${styles.userMessage}`;
  } else if (isSystemMessage) {
    messageClassName += ` ${styles.systemMessage}`;
  } else {
    messageClassName += ` ${styles.aiMessage}`;
  }
  
  return (
    <div className={styles.messageWrapper}>
      <div className={messageClassName}>
        <Text.Body tone={isSystemMessage ? 'critical' : isUserMessage ? 'inherit' : 'inherit'}>
          {message.content}
        </Text.Body>
      </div>
      
      {/* Only show metadata for AI messages */}
      {message.sender === 'ai' && message.metadata && (
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
};

const Chat = () => {
  const intl = useIntl();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const { messages: chatMessages, isLoading, error, sendMessage } = useChatConnector();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Constraints.Horizontal max={16}>
      <Spacings.Stack scale="xl">
        <Text.Headline as="h1" intlMessage={messages.title} />
        <Text.Subheadline as="h4" intlMessage={messages.subtitle} />
        
        <div className={styles.chatContainer}>
          <div className={styles.messagesContainer}>
            {chatMessages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
            
            {isLoading && <LoadingIndicator />}
            
            {error && !chatMessages.some(msg => msg.sender === 'system') && (
              <div className={`${styles.messageItem} ${styles.systemMessage}`}>
                <Text.Body tone="critical" intlMessage={messages.errorMessage} />
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
                <TextField
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder={intl.formatMessage(messages.inputPlaceholder)}
                  horizontalConstraint="scale"
                  isDisabled={isLoading}
                  onKeyDown={handleKeyPress}
                />
              </div>
              <PrimaryButton
                onClick={handleSendMessage}
                isDisabled={!inputValue.trim() || isLoading}
                label={intl.formatMessage(messages.sendButton)}
                type="submit"
              />
            </form>
          </div>
        </div>
      </Spacings.Stack>
    </Constraints.Horizontal>
  );
};

Chat.displayName = 'Chat';

export default Chat; 