(function() {
  // Constants
  const POLLING_INTERVAL_MS = 1000;
  const MAX_TEXTAREA_HEIGHT = 120;
  const AUTH_TOKEN_KEY = 'ct_auth_token';
  const URL_CHECK_INTERVAL_MS = 500;
  const API_URL = 'https://92c0-188-26-215-219.ngrok-free.app';
  
  // Utility functions for markdown parsing
  const parseMarkdown = (text) => {
    if (!text || typeof text !== 'string') return '';

    // Make a copy of the original text for rendering
    let displayText = text;
    
    // Remove confirmation tag from display text only
    displayText = displayText.replace('#CONFIRMATION_NEEDED', '');

    // Process lists first to handle them properly
    let processedLists = displayText;
    
    // Process bullet lists (both * and - style)
    const bulletListRegex = /^[\s]*[-*][\s]+(.*?)$/gm;
    const bulletMatches = [...processedLists.matchAll(bulletListRegex)];
    
    if (bulletMatches.length > 0) {
      // Start a list
      processedLists = '<ul>\n';
      
      // Process each list item
      let lastIndex = 0;
      let inList = false;
      
      [...displayText.matchAll(bulletListRegex)].forEach(match => {
        const [fullMatch, content] = match;
        const startIndex = match.index;
        
        // Add non-list content before this item
        if (startIndex > lastIndex) {
          const nonListContent = displayText.substring(lastIndex, startIndex);
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
      if (lastIndex < displayText.length) {
        processedLists += displayText.substring(lastIndex);
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

  // Format message content function
  const formatMessageContent = (content, shouldRenderMarkdown = false) => {
    if (!content) return '';
    if (typeof content !== 'string') {
      try {
        return String(content);
      } catch (e) {
        return '';
      }
    }
    
    if (shouldRenderMarkdown) {
      return parseMarkdown(content);
    }
    
    return content;
  };

  // Create response parser
  const parseResponseText = (responseText) => {
    console.log('Parsing response text:', responseText);
    
    if (!responseText || typeof responseText !== 'string') {
      console.log('Invalid response text');
      return null;
    }
    
    try {
      // Split by newlines and process each line
      const lines = responseText.split('\n').filter(line => line.trim());
      
      // Look for the full_ai_response type first
      const fullAiResponseLine = lines.find(line => line.includes('"type":"full_ai_response"'));
      if (fullAiResponseLine) {
        try {
          const parsedData = JSON.parse(fullAiResponseLine);
          if (parsedData.type === 'full_ai_response' && parsedData.response) {
            
            // Check if stepsPromise is available
            if (parsedData.response.stepsPromise && 
                parsedData.response.stepsPromise.status &&
                parsedData.response.stepsPromise.status.type === 'resolved' &&
                parsedData.response.stepsPromise.status.value) {
              
              const steps = parsedData.response.stepsPromise.status.value;
              
              // Get the text from textPromise if available
              let answer = '';
              if (parsedData.response.textPromise && 
                  parsedData.response.textPromise.status &&
                  parsedData.response.textPromise.status.type === 'resolved') {
                answer = parsedData.response.textPromise.status.value;
              } else if (parsedData.response.fullText) {
                answer = parsedData.response.fullText;
              }
              
              return {
                answer,
                steps
              };
            }
            
            // Fallback to fullText if available
            if (parsedData.response.fullText) {
              return {
                answer: parsedData.response.fullText
              };
            }
          }
        } catch (e) {
          console.error('Error parsing full_ai_response line:', e);
        }
      }
      
      // Look for the complete response if no full_ai_response found
      const completeLine = lines.find(line => line.includes('"type":"complete"'));
      if (completeLine) {
        try {
          const parsedData = JSON.parse(completeLine);
          if (parsedData.type === 'complete' && parsedData.response) {
            return parsedData.response;
          }
        } catch (e) {
          console.error('Error parsing complete line:', e);
        }
      }
      
      // If no complete response found, try to find any JSON object with an answer field
      for (const line of lines.reverse()) { // Check in reverse to get the last one first
        try {
          const parsedLine = JSON.parse(line);
          if (parsedLine.response && parsedLine.response.answer) {
            return parsedLine.response;
          } else if (parsedLine.answer) {
            return parsedLine;
          }
        } catch (e) {
          // Ignore parsing errors for individual lines
        }
      }
      
      // If we still haven't found anything, try to parse the entire response as one JSON
      try {
        const parsedFull = JSON.parse(responseText);
        if (parsedFull.answer || (parsedFull.response && parsedFull.response.answer)) {
          return parsedFull.response || parsedFull;
        }
      } catch (e) {
        console.error('Error parsing full response:', e);
      }
      
      return null;
    } catch (error) {
      console.error('Error processing response text:', error);
      return null;
    }
  };

  // Create message from response function
  const createMessageFromResponse = (response) => {
    let responseData;
    
    try {
      // Handle string responses that might be JSON
      if (typeof response === 'string') {
        responseData = parseResponseText(response);
        if (!responseData) {
          // If parsing fails, treat as plain text
          responseData = { answer: response };
        }
      } else if (response?.type === 'complete' && response.response) {
        responseData = response.response;
      } else if (response?.type === 'full_ai_response' && response.response) {
        responseData = {
          answer: response.response.fullText || '',
          steps: response.response.stepsPromise?.status?.value || []
        };
      } else if (response?.response && typeof response.response === 'object') {
        responseData = response.response;
      } else {
        responseData = response;
      }
    } catch (error) {
      console.error('Error processing response:', error);
      responseData = { answer: 'Sorry, there was an error processing the response.' };
    }
    
    // Extract content and metadata
    const content = responseData?.answer || 'Sorry, I didn\'t get a valid response.';
    
    const message = {
      id: `ai-${Date.now()}`,
      content: content,
      timestamp: new Date().toISOString(),
      role: 'assistant',
      metadata: {
        graphql_queries: responseData?.graphql_queries || [],
        entities: responseData?.entities || [],
        steps: responseData?.steps || [],
      },
      // Add confirmation state
      needsConfirmation: content.includes('#CONFIRMATION_NEEDED'),
      confirmationResponse: undefined
    };
    
    return message;
  };
  
  // Main class for the floating chat
  class FloatingChat {
    constructor() {
      // State management
      this.state = {
        isOpen: false,
        isLoading: false,
        isStreaming: false,
        error: null,
        messages: [],
        lastChunkId: -1,
        currentRequestId: null,
        currentUrl: window.location.href // Track current URL
      };
      
      // DOM elements
      this.elements = {
        container: null,
        chatWindow: null,
        messagesContainer: null,
        inputTextarea: null,
        sendButton: null,
        chatButton: null
      };
      
      // URL tracking
      this.urlCheckInterval = null;
      
      // API configuration
      this.setupApiConfig();
      
      // Initialize the chat
      this.initialize();
    }
    
    setupApiConfig() {
      // Make API URL dynamic based on current location
      const currentLocation = window.location.href;
      const urlObject = new URL(currentLocation);
      // Convert "mc" to "mc-api" in the hostname
      const apiHostname = urlObject.hostname.replace('mc.', 'mc-api.');
      this.API_URL = `${urlObject.protocol}//${apiHostname}/proxy/forward-to`;
      
      // Extract project key from URL path
      // URL format: https://mc.[region].gcp.commercetools.com/[project-key]/[resource-type]
      const pathParts = urlObject.pathname.split('/').filter(part => part.trim() !== '');
      this.projectKey = pathParts.length > 0 ? pathParts[0] : "luciano-test"; // Fallback to default if not found
      
      // Generate a unique correlation ID
      this.correlationId = `mc/${this.projectKey}/${crypto.randomUUID()}`;
      
      // Get auth token from localStorage
      this.authToken = this.getAuthToken();
    }
    
    initialize() {
      this.createDOM();
      this.bindEvents();
      this.addInitialMessage();
      this.setupUrlChangeDetection();
      
      // Check if auth token exists, if not and chat is opened, prompt for it
      if (!this.hasAuthToken()) {
        // Replace the welcome message with the token request
        this.state.messages = []; // Clear existing messages
        this.promptForAuthToken();
      }
      
      console.log('Floating chat initialized with API URL:', this.API_URL);
    }
    
    createDOM() {
      // Create main container
      this.elements.container = document.createElement('div');
      this.elements.container.className = 'floating-chat-container';
      document.body.appendChild(this.elements.container);
      
      // Create chat button
      this.elements.chatButton = this.createButton('chat-bubble', 'Assistant');
      this.elements.container.appendChild(this.elements.chatButton);
    }
    
    createButton(className, text) {
      const button = document.createElement('button');
      button.className = className;
      button.textContent = text;
      return button;
    }
    
    createChatWindow() {
      // Create chat window if it doesn't exist
      if (this.elements.chatWindow) return;
      
      this.elements.chatWindow = document.createElement('div');
      this.elements.chatWindow.className = 'floating-chat-window';
      
      // Position the window relative to the chat button position
      if (this.elements.chatButton) {
        const buttonRight = this.elements.chatButton.style.right || '20px';
        this.elements.chatWindow.style.right = buttonRight;
      }
      
      // Create header
      const header = this.createChatHeader();
      
      // Create messages container
      this.elements.messagesContainer = document.createElement('div');
      this.elements.messagesContainer.className = 'chat-window-messages';
      
      // Create input area
      const inputArea = this.createInputArea();
      
      // Assemble the chat window
      this.elements.chatWindow.appendChild(header);
      this.elements.chatWindow.appendChild(this.elements.messagesContainer);
      this.elements.chatWindow.appendChild(inputArea);
      
      // Add to container
      this.elements.container.insertBefore(this.elements.chatWindow, this.elements.chatButton);
      
      // Focus the textarea
      setTimeout(() => this.elements.inputTextarea.focus(), 100);
    }
    
    createChatHeader() {
      const header = document.createElement('div');
      header.className = 'chat-header';
      
      const title = document.createElement('h2');
      title.textContent = 'AI Assistant';
      
      const closeButton = document.createElement('button');
      closeButton.className = 'close-button';
      closeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      closeButton.addEventListener('click', () => this.toggleChat());
      
      header.appendChild(title);
      header.appendChild(closeButton);
      
      return header;
    }
    
    createInputArea() {
      const inputArea = document.createElement('div');
      inputArea.className = 'chat-window-input';
      
      const form = document.createElement('form');
      form.className = 'input-form';
      
      const inputField = document.createElement('div');
      inputField.className = 'input-field';
      
      const textareaWrapper = document.createElement('div');
      textareaWrapper.className = 'custom-textarea-wrapper';
      
      this.elements.inputTextarea = document.createElement('textarea');
      this.elements.inputTextarea.className = 'custom-textarea';
      this.elements.inputTextarea.placeholder = 'Type your message here...';
      this.elements.inputTextarea.rows = 1;
      
      this.elements.sendButton = document.createElement('button');
      this.elements.sendButton.className = 'send-button';
      this.elements.sendButton.type = 'submit';
      this.elements.sendButton.innerHTML = `
        <svg class="send-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      
      textareaWrapper.appendChild(this.elements.inputTextarea);
      inputField.appendChild(textareaWrapper);
      inputField.appendChild(this.elements.sendButton);
      
      form.appendChild(inputField);
      inputArea.appendChild(form);
      
      // Bind events for the new elements
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSendMessage();
      });
      
      this.elements.inputTextarea.addEventListener('input', () => this.resizeTextarea());
      
      this.elements.inputTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
      
      return inputArea;
    }
    
    bindEvents() {
      this.elements.chatButton.addEventListener('click', () => this.toggleChat());
    }
    
    toggleChat() {
      this.state.isOpen = !this.state.isOpen;
      
      if (this.state.isOpen) {
        this.createChatWindow();
        
        // Check if auth token exists, if not, replace welcome message with token request
        if (!this.hasAuthToken()) {
          this.state.messages = []; // Clear existing messages
          this.promptForAuthToken();
        }
        
        this.renderMessages();
      } else {
        if (this.elements.chatWindow) {
          this.elements.container.removeChild(this.elements.chatWindow);
          this.elements.chatWindow = null;
        }
      }
    }
    
    addInitialMessage() {
      this.addMessage({
        id: 'system-welcome',
        content: 'Hello! I\'m your AI assistant. How can I help you today?',
        role: 'assistant'
      });
    }
    
    addMessage(messageData) {
      const message = {
        id: messageData.id || `${messageData.role}-${Date.now()}`,
        content: messageData.content,
        timestamp: messageData.timestamp || new Date().toISOString(),
        role: messageData.role,
        metadata: messageData.metadata || {
          graphql_queries: [],
          entities: [],
          steps: [],
        }
      };
      
      this.state.messages.push(message);
      return message;
    }
    
    promptForAuthToken() {
      this.addMessage({
        id: 'system-token-request',
        content: 'Please enter your authentication token to continue. It will be securely stored in your browser\'s local storage for future use.',
        role: 'assistant'
      });
      
      this.renderMessages();
    }
    
    updateMessage(id, updates) {
      this.state.messages = this.state.messages.map(msg => {
        if (msg.id === id) {
          return { ...msg, ...updates };
        }
        return msg;
      });
    }
    
    renderMessages() {
      if (!this.elements.messagesContainer) return;
      
      // Clear the container
      this.elements.messagesContainer.innerHTML = '';
      
      if (this.state.messages.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'How can I help you today?';
        this.elements.messagesContainer.appendChild(emptyState);
        return;
      }
      
      // Render each message
      this.state.messages.forEach(message => {
        this.renderMessageItem(message);
      });
      
      // Render the typing indicator if streaming
      if (this.state.isStreaming) {
        this.renderTypingIndicator();
      }
      
      // Render error message if any
      if (this.state.error) {
        this.renderErrorMessage();
      }
      
      // Scroll to bottom
      this.scrollToBottom();
    }
    
    renderMessageItem(message) {
      const messageWrapper = document.createElement('div');
      messageWrapper.className = `message-wrapper ${message.role === 'user' ? 'user' : message.role === 'system' || message.role === 'error' ? 'error' : 'ai'}`;
      
      const messageItem = document.createElement('div');
      messageItem.className = `message-item ${message.role === 'user' ? 'user' : message.role === 'system' || message.role === 'error' ? 'error' : 'ai'}`;
      
      // Check if this is a confirmation message (for AI messages only)
      const isConfirmationMessage = message.role === 'assistant' && 
        (message.needsConfirmation || message.content.includes('#CONFIRMATION_NEEDED'));
      
      // Add confirmation class if needed
      if (isConfirmationMessage) {
        messageItem.classList.add('confirmation');
      }
      
      // For user messages, just use the content as-is
      if (message.role === 'user') {
        messageItem.textContent = message.content;
      } else {
        // For AI messages, render with markdown
        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-message-content';
        contentDiv.innerHTML = formatMessageContent(message.content, true);
        messageItem.appendChild(contentDiv);
        
        // Add confirmation buttons if this is a confirmation message without a response yet
        if (isConfirmationMessage && message.confirmationResponse === undefined) {
          const buttonsContainer = document.createElement('div');
          buttonsContainer.className = 'confirmation-buttons';
          
          const noButton = document.createElement('button');
          noButton.className = 'confirmation-button no-button';
          noButton.textContent = 'No';
          noButton.addEventListener('click', () => this.handleConfirmationResponse(message.id, false));
          
          const yesButton = document.createElement('button');
          yesButton.className = 'confirmation-button yes-button';
          yesButton.textContent = 'Yes';
          yesButton.addEventListener('click', () => this.handleConfirmationResponse(message.id, true));
          
          buttonsContainer.appendChild(noButton);
          buttonsContainer.appendChild(yesButton);
          messageItem.appendChild(buttonsContainer);
        }
        
        // Show confirmation response if it exists
        if (isConfirmationMessage && message.confirmationResponse !== undefined) {
          const responseContainer = document.createElement('div');
          responseContainer.className = 'confirmation-response';
          
          const responseText = document.createElement('span');
          responseText.textContent = message.confirmationResponse ? 'Confirmed' : 'Cancelled';
          responseText.className = message.confirmationResponse ? 'positive' : 'negative';
          
          responseContainer.appendChild(responseText);
          messageItem.appendChild(responseContainer);
          
          // Add timestamp info for the confirmation
          if (message.confirmationTimestamp) {
            const confirmationLog = document.createElement('div');
            confirmationLog.className = 'confirmation-log';
            confirmationLog.textContent = `Action ${message.confirmationResponse ? 'confirmed' : 'cancelled'} at ${this.formatTimestamp(message.confirmationTimestamp)}`;
            messageItem.appendChild(confirmationLog);
          }
        }
      }
      
      messageWrapper.appendChild(messageItem);
      this.elements.messagesContainer.appendChild(messageWrapper);
    }
    
    renderTypingIndicator() {
      const typingIndicator = document.createElement('div');
      typingIndicator.className = 'inline-typing-indicator';
      
      const dots = document.createElement('div');
      dots.className = 'typing-dots';
      
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dots.appendChild(dot);
      }
      
      typingIndicator.appendChild(dots);
      this.elements.messagesContainer.appendChild(typingIndicator);
    }
    
    renderErrorMessage() {
      const errorMessage = document.createElement('div');
      errorMessage.className = 'error-message';
      errorMessage.textContent = 'There was an error connecting to the AI service. Please try again later.';
      this.elements.messagesContainer.appendChild(errorMessage);
    }
    
    resizeTextarea() {
      const textarea = this.elements.inputTextarea;
      // Reset height first
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = scrollHeight <= MAX_TEXTAREA_HEIGHT ? `${scrollHeight}px` : `${MAX_TEXTAREA_HEIGHT}px`;
    }
    
    scrollToBottom() {
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
      }
    }
    
    sanitizeMessageContent(content) {
      // If content is just a single special character, add a space
      if (content.length === 1 && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(content)) {
        return content + ' ';  // Add a space to prevent issues with single special characters
      }
      return content;
    }
    
    async handleSendMessage() {
      const messageText = this.elements.inputTextarea.value.trim();
      
      if (!messageText || this.state.isLoading || this.state.isStreaming) return;
      
      // Clear the input
      this.elements.inputTextarea.value = '';
      this.resizeTextarea();

      // Check if we're waiting for an auth token
      const isAwaitingToken = !this.hasAuthToken() && 
        this.state.messages.some(msg => msg.id === 'system-token-request');
      
      if (isAwaitingToken) {
        this.handleTokenSubmission(messageText);
        return;
      }
      
      // Normal message flow
      await this.sendUserMessage(messageText);
    }
    
    handleTokenSubmission(tokenText) {
      // Add masked user message to the chat
      this.addMessage({
        content: '••••••••••••••••', // Mask the token in the UI
        role: 'user'
      });
      
      // Try to save the token
      const tokenSaved = this.saveAuthToken(tokenText);
      
      if (tokenSaved) {
        // Add confirmation message
        this.addMessage({
          content: 'Thank you! Your authentication token has been securely saved to your browser\'s local storage. You can now use the chat normally.',
          role: 'assistant'
        });
      } else {
        // Add error message if token format seems invalid
        this.addMessage({
          content: 'The token format appears to be invalid. Please make sure you\'re entering a valid authentication token and try again.',
          role: 'assistant'
        });
      }
      
      this.renderMessages();
    }
    
    async sendUserMessage(messageText) {
      // Add user message to the chat
      const userMessage = this.addMessage({
        content: messageText,
        role: 'user'
      });
      
      this.state.isLoading = true;
      this.state.error = null;
      this.state.isStreaming = false;
      
      // Check if we have an auth token before attempting to send messages
      if (!this.hasAuthToken()) {
        this.state.isLoading = false;
        this.promptForAuthToken();
        return;
      }
      
      // Render the updated messages
      this.renderMessages();
      
      try {
        await this.sendMessageToAPI(userMessage);
      } catch (error) {
        console.error('Error sending message:', error);
        
        this.state.error = error;
        this.state.isStreaming = false;
        this.state.isLoading = false;
        
        // Add error message to chat
        this.addMessage({
          id: `error-${Date.now()}`,
          content: `Error: Failed to fetch. Make sure your API server is running at ${this.API_URL} and is properly configured to accept requests.`,
          role: 'error'
        });
        
        this.renderMessages();
      }
    }
    
    async sendMessageToAPI(userMessage) {
      // Convert existing messages to the format expected by the API
      const chatHistory = this.formatMessagesForAPI();
      
      // Create and add a streaming AI response placeholder
      const streamingMessageId = `ai-${Date.now()}`;
      const streamingMessage = this.addMessage({
        id: streamingMessageId,
        content: '',
        role: 'assistant',
        isStreaming: true
      });
      
      this.state.isStreaming = true;
      
      // Generate a unique request ID
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      this.state.currentRequestId = requestId;
      
      // Render with the placeholder
      this.renderMessages();
      
      // Start the streaming process
      await this.startRealTimeStreaming(streamingMessageId, requestId, chatHistory);
    }
    
    formatMessagesForAPI() {
      // Convert existing messages to the format expected by the API
      const chatHistory = this.state.messages.map(msg => ({
        id: msg.id,
        createdAt: new Date(msg.timestamp),
        content: msg.role === 'user' ? this.sanitizeMessageContent(msg.content) : msg.content,
        role: msg.role
      }));

      // Add context information about the current URL
      const currentUrl = window.location.href;
      const contextMessage = `I am currently looking at the following URL: ${currentUrl}\n\nThis URL follows commercetools Merchant Center structure which typically includes the project key followed by resource types and IDs. For example:\n- /[project-key]/products (list of products)\n- /[project-key]/products/[product-id] (specific product)\n- /[project-key]/products/[product-id]/variants/[variant-id]/prices/[price-id] (specific price within a variant)\n\nPlease use this context to provide relevant assistance for what I'm currently viewing.`;
      
      chatHistory.push({
        id: 'system-context',
        content: contextMessage,
        createdAt: new Date().toISOString(),
        role: 'user'
      });
      
      return chatHistory;
    }
    
    getRequestHeaders() {
      return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Version': 'v2',
        'Origin': 'https://mc.us-central1.gcp.commercetools.com',
        'x-application-id': 'cm7ymoprv000lz101dzlg8sw5:chat',
        'x-correlation-id': this.correlationId,
        'x-forward-to': API_URL + '/agent',
        'x-forward-to-audience-policy': 'forward-url-full-path',
        'x-project-key': this.projectKey,
        'Authorization': `Bearer ${this.authToken}`
      };
    }
    
    getStreamingHeaders() {
      // Add the streaming endpoint
      const headers = this.getRequestHeaders();
      headers['x-forward-to'] = API_URL + '/agent/stream';
      return headers;
    }
    
    async startRealTimeStreaming(streamingMessageId, requestId, chatHistory) {
      try {
        // Reset the last chunk ID
        this.state.lastChunkId = -1;
        
        // Start the processing on the server
        try {
          const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: this.getRequestHeaders(),
            body: JSON.stringify({
              messages: chatHistory,
              requestId,
            }),
          });
          
          // Handle authentication errors
          if (this.handleAuthErrors(response, streamingMessageId)) {
            return;
          }
          
          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }
        } catch (startError) {
          if (this.handleStartError(startError, streamingMessageId)) {
            return;
          }
          throw startError;
        }
        
        // Start polling for updates
        this.setupPolling(streamingMessageId, requestId);
      } catch (error) {
        console.error('Error starting real-time streaming:', error);
        this.state.error = error;
        this.state.isStreaming = false;
        this.state.isLoading = false;
        this.renderMessages();
      }
    }
    
    handleAuthErrors(response, streamingMessageId) {
      if (response.status === 401 || response.status === 403) {
        // Token is invalid or expired
        this.clearAuthToken();
        
        // Update the UI with an authentication error message
        this.updateMessage(streamingMessageId, {
          content: 'Your authentication token appears to be invalid or has expired. Please provide a new token.',
          isStreaming: false
        });
        
        // Add a prompt to re-enter the token
        this.promptForAuthToken();
        
        this.state.isStreaming = false;
        this.state.isLoading = false;
        this.renderMessages();
        return true;
      }
      return false;
    }
    
    handleStartError(startError, streamingMessageId) {
      if (startError.message && startError.message.includes('502')) {
        // Update the UI for a gateway error
        this.updateMessage(streamingMessageId, {
          content: 'Sorry, I encountered a server connection issue (502 Bad Gateway). This can happen with certain inputs. Please try again with a different message.',
          isStreaming: false
        });
        
        this.state.isStreaming = false;
        this.state.isLoading = false;
        this.renderMessages();
        return true;
      }
      return false;
    }
    
    setupPolling(streamingMessageId, requestId) {
      // Clear any existing polling interval
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }
      
      // Define the polling function
      const pollForChunks = async () => {
        if (this.state.currentRequestId !== requestId) {
          // Request changed, stop polling
          this.stopPolling();
          return null;
        }
        
        try {
          await this.fetchStreamingChunks(streamingMessageId, requestId);
        } catch (error) {
          this.handlePollingError(error);
        }
      };
      
      // Start polling - check every 1 second
      this.pollingInterval = setInterval(pollForChunks, POLLING_INTERVAL_MS);
      
      // Also call immediately for the first time
      pollForChunks();
    }
    
    stopPolling() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
    }
    
    async fetchStreamingChunks(streamingMessageId, requestId) {
      try {
        // Request new chunks
        const response = await fetch(this.API_URL, {
          method: 'POST',
          headers: this.getStreamingHeaders(),
          body: JSON.stringify({
            requestId: requestId,
            since: this.state.lastChunkId
          }),
        });
        
        // Handle authentication errors
        if (this.handleAuthErrors(response, streamingMessageId)) {
          this.stopPolling();
          return;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        const streamResponse = await response.json();
        this.processStreamResponse(streamResponse, streamingMessageId);
        
      } catch (error) {
        throw error;
      }
    }
    
    processStreamResponse(streamResponse, streamingMessageId) {
      // Stop polling if the backend tells us to
      if (streamResponse.stopPolling) {
        this.stopPolling();
      }
      
      // Process any new chunks
      if (streamResponse.chunks && streamResponse.chunks.length > 0) {
        this.processChunks(streamResponse.chunks, streamingMessageId);
      }
      
      // Handle final response
      if ((streamResponse.stopPolling || streamResponse.isComplete) && 
           streamResponse.finalResponse) {
        this.processFinalResponse(streamResponse.finalResponse, streamingMessageId);
      }
      
      // Handle completion
      if (streamResponse.isComplete) {
        this.handleStreamingComplete(streamResponse, streamingMessageId);
      }
    }
    
    processChunks(chunks, streamingMessageId) {
      let newContent = '';
      
      // Find the highest chunk ID
      let highestChunkId = this.state.lastChunkId;
      
      // Collect content from all chunks
      chunks.forEach(chunk => {
        if (chunk.id > this.state.lastChunkId) {
          newContent += chunk.content || '';
          highestChunkId = Math.max(highestChunkId, chunk.id);
        }
      });
      
      // Update the last chunk ID
      this.state.lastChunkId = highestChunkId;
      
      // Only update if we have new content
      if (newContent) {
        // Update the streaming message
        this.updateMessage(streamingMessageId, {
          content: (this.state.messages.find(msg => msg.id === streamingMessageId)?.content || '') + newContent,
        });
        
        // Re-render the messages
        this.renderMessages();
      }
    }
    
    processFinalResponse(finalResponse, streamingMessageId) {
      // Create a message using the response parser
      const parsedMessage = createMessageFromResponse(finalResponse);
      
      // Use the complete answer for final display
      this.updateMessage(streamingMessageId, {
        content: parsedMessage.content,
        metadata: parsedMessage.metadata,
        isStreaming: false,
      });
      
      this.renderMessages();
    }
    
    handleStreamingComplete(streamResponse, streamingMessageId) {
      // Stop polling - we're done
      this.stopPolling();
      
      // Update state
      this.state.isStreaming = false;
      this.state.isLoading = false;
      
      // If we have a final response, update the message with the full content
      if (streamResponse.finalResponse) {
        // Get the answer from the final response
        const fullContent = streamResponse.finalResponse.answer || '';
        
        this.updateMessage(streamingMessageId, {
          content: fullContent,
          metadata: {
            graphql_queries: streamResponse.finalResponse.graphql_queries || [],
            entities: streamResponse.finalResponse.entities || [],
          },
          isStreaming: false,
        });
      } else {
        // Just mark as not streaming if there's no final response
        this.updateMessage(streamingMessageId, {
          isStreaming: false,
        });
      }
      
      this.renderMessages();
    }
    
    handlePollingError(error) {
      console.error('Error during polling:', error);
      
      // Only stop on fatal errors
      if (error.message && (
          error.message.includes('NetworkError') || 
          error.message.includes('Failed to fetch'))) {
        
        this.stopPolling();
        
        this.state.error = error;
        this.state.isStreaming = false;
        this.state.isLoading = false;
        this.renderMessages();
      }
    }
    
    // Authentication methods
    getAuthToken() {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    
    saveAuthToken(token) {
      if (token && token.trim() !== '') {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        this.authToken = token;
        return true;
      }
      return false;
    }
    
    clearAuthToken() {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      this.authToken = null;
    }
    
    hasAuthToken() {
      return !!this.getAuthToken();
    }
    
    setupUrlChangeDetection() {
      // Clear any existing interval first
      if (this.urlCheckInterval) {
        clearInterval(this.urlCheckInterval);
      }
      
      // Set up an interval to check for URL changes
      this.urlCheckInterval = setInterval(() => {
        const currentUrl = window.location.href;
        
        // If URL has changed
        if (currentUrl !== this.state.currentUrl) {
          console.log('URL changed from:', this.state.currentUrl);
          console.log('URL changed to:', currentUrl);
          
          // Update the current URL in state
          this.state.currentUrl = currentUrl;
          
          // Reconfigure the API with the new URL
          this.setupApiConfig();
          
          // Adjust button position based on whether we're in a panel view
          this.adjustButtonPosition(currentUrl);
          
          // If we're in the middle of a conversation, add a system message about the page change
          if (this.state.messages.length > 1) {
            this.addMessage({
              id: `system-url-change-${Date.now()}`,
              content: `I notice you've navigated to a new page: ${currentUrl}`,
              role: 'assistant'
            });
            
            // Only render messages if chat is open
            if (this.state.isOpen) {
              this.renderMessages();
            }
          }
        } else {
          // Even if URL hasn't changed, check for panel changes
          // (some panels might be opened without changing the URL)
          this.adjustButtonPosition(currentUrl);
        }
      }, URL_CHECK_INTERVAL_MS);
      
      // Run once immediately to set the initial state
      this.adjustButtonPosition(window.location.href);
    }
    
    adjustButtonPosition(url) {
      if (!this.elements.chatButton) return;
      
      // Check for panel by looking at both URL patterns and DOM elements
      const isPanelByUrl = url.includes('/variants/') || 
                           url.includes('/variant-details/') || 
                           url.includes('/edit/') ||
                           url.includes('modal=true');
                          
      // Check for panels by looking for specific DOM elements
      const isPanelByDom = document.querySelector('.modal-overlay') !== null ||
                           document.querySelector('.ct-panel') !== null ||
                           document.querySelector('[data-testid="side-panel"]') !== null ||
                           document.querySelector('.side-panel') !== null ||
                           document.querySelector('.panel-container') !== null;
      
      // If either detection method finds a panel, we're in panel view
      const isPanelView = isPanelByUrl || isPanelByDom;
      
      if (isPanelView) {
        // For panel view, just add the panel-mode class for styling
        // but don't change the position - just ensure high z-index in CSS
        this.elements.chatButton.classList.add('panel-mode');
      } else {
        // Remove panel mode class when not in panel view
        this.elements.chatButton.classList.remove('panel-mode');
      }
    }
    
    // Add method to handle cleanup
    cleanup() {
      // Clear URL checking interval
      if (this.urlCheckInterval) {
        clearInterval(this.urlCheckInterval);
        this.urlCheckInterval = null;
      }
      
      // Clear polling interval
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
    }
    
    // Add method to handle confirmation responses
    handleConfirmationResponse(messageId, confirmed) {
      const timestamp = new Date().toISOString();
      
      // Update the message with the confirmation response
      this.state.messages = this.state.messages.map(msg => {
        if (msg.id === messageId) {
          return { 
            ...msg, 
            confirmationResponse: confirmed,
            confirmationTimestamp: timestamp
          };
        }
        return msg;
      });
      
      // Render the updated messages
      this.renderMessages();
      
      // If confirmed, send a follow-up message to proceed
      if (confirmed) {
        this.sendUserMessage("Yes, proceed.");
      } else {
        this.sendUserMessage("No, don't proceed.");
      }
    }
    
    // Format timestamp for display
    formatTimestamp(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
  
  // Create and initialize the floating chat
  window.floatingChat = new FloatingChat();
  console.log('Floating chat loaded successfully!');
  
  // Add event listener for page unload to clean up resources
  window.addEventListener('beforeunload', () => {
    if (window.floatingChat) {
      window.floatingChat.cleanup();
    }
  });
})();