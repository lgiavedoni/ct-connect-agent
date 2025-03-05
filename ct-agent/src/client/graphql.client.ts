import { readConfiguration } from '../utils/config.utils';
import { logger } from '../utils/logger.utils';

class CommercetoolsGraphQLClient {
  private tokenCache: { token: string; expiresAt: number } | null;
  private config: ReturnType<typeof readConfiguration>;

  constructor() {
    this.tokenCache = null;
    this.config = readConfiguration();
  }

  async getAccessToken() {
    // if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
    //   return this.tokenCache.token;
    // } 

    // Log authentication request details
    logger.info('Authenticating with commercetools', {
      authUrl: this.config.authUrl,
      clientId: this.config.clientId,
      projectKey: this.config.projectKey,
      scope: this.config.scope || '',
      requestBody: `grant_type=client_credentials&scope=${encodeURIComponent(this.config.scope || '')}`
    });

    const response = await fetch(`${this.config.authUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(this.config.scope || '')}`,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.message || 
        `Authentication failed (${response.status}): Please check your credentials` 
      );
    }

    const data = await response.json();
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000 - 60000), // Expire 1 minute early
    };
    
    return this.tokenCache.token;
  }

  async query(query: string, variables: Record<string, any> = {}) {
    const token = await this.getAccessToken();
    
    try {
      const response = await fetch(`${this.config.apiUrl}/${this.config.projectKey}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query,
          variables
        })
      });

      const data = await response.json();
      
      if (data.errors) {
        const graphqlErrors = data.errors
          .map((e: any) => {
            let message = e.message;
            if (e.locations) {
              message += ` (at line ${e.locations[0].line}, column ${e.locations[0].column})`;
            }
            if (e.extensions?.code) {
              message += ` [${e.extensions.code}]`;
            }
            return message;
          })
          .join('\n');
        throw new Error(`GraphQL Validation Error:\n${graphqlErrors}`);
      }
      
      return data.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`GraphQL Error: ${error.message}`);
      }
      
      // Fallback for non-Error objects
      throw new Error(`GraphQL Error: ${String(error)}`);
    }
  }
}

export default new CommercetoolsGraphQLClient();

