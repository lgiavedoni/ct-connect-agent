# AI Chat Component

This component provides a chat interface for interacting with an AI assistant.

## Features

- Real-time chat interface
- Integration with external AI API
- Loading indicators
- Error handling
- Responsive design

## Implementation Details

This component uses the Merchant Center Proxy Router to connect to an external API. This is the recommended approach for integrating with external APIs in commercetools Merchant Center custom applications.

The implementation follows the official commercetools documentation for [integrating with your own API](https://docs.commercetools.com/merchant-center-customizations/concepts/integrate-with-your-own-api).

## API Integration

The component makes POST requests to the specified API endpoint using the following format:

### Request Format

```json
{
  "human_request": "User message text"
}
```

### Response Format

The API is expected to return responses with the following structure:

```json
{
  "response": "AI assistant response text"
}
```

## Environment Variables

The chat component is configured to use the following environment variables:

- `REACT_APP_AI_AGENT_API_URL`: The URL of the AI agent API endpoint (default: `http://localhost:3005/agent`)

## Backend Requirements

For the API integration to work properly, your backend server must:

1. Be running and accessible at the URL specified in the environment variable
2. Accept POST requests with JSON content
3. Return responses in the expected format

## Usage

```jsx
import Chat from '../components/chat';

const MyComponent = () => {
  return <Chat />;
};
```

## Customization

The chat component can be customized by modifying the CSS in `chat.module.css`. 