import { GraphQLClient } from 'graphql-request';
import dotenv from 'dotenv';

dotenv.config();

class CommercetoolsGraphQLClient {
  private projectKey: string;
  private clientId: string;
  private clientSecret: string;
  private scope: string;
  private region: string;
  private authUrl: string;
  private apiUrl: string;
  private tokenCache: { token: string; expiresAt: number } | null;

  constructor() {
    this.projectKey = process.env.CTP_PROJECT_KEY || '';
    this.clientId = process.env.CTP_CLIENT_ID || '';
    this.clientSecret = process.env.CTP_CLIENT_SECRET || '';
    this.scope = process.env.CTP_SCOPE || '';
    this.region = process.env.CTP_REGION || '';
    
    this.authUrl = `https://auth.${this.region}.commercetools.com/oauth/token`;
    this.apiUrl = `https://api.${this.region}.commercetools.com`;
    this.tokenCache = null;
  }

  async getAccessToken() {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    const response = await fetch(`${this.authUrl}?grant_type=client_credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      body: `scope=${encodeURIComponent(this.scope)}`,
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
    const client = new GraphQLClient(
      `${this.apiUrl}/${this.projectKey}/graphql`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    try {
      return await client.request(query, variables);
    } catch (error: unknown) {
      // Debug log to see the full error structure
      // console.log('GraphQL Error Debug:', error);

      if (error instanceof Error) {
        const clientError = error as any;
        
        // If we get a 400 error, fetch the response directly to get the error details
        if (clientError.response?.status === 400) {
          try {
            const response = await fetch(`${this.apiUrl}/${this.projectKey}/graphql`, {
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

            const errorData = await response.json();
            
            if (errorData.errors) {
              const graphqlErrors = errorData.errors
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
          } catch (fetchError) {
            // If the direct fetch fails, fall back to a basic error message
            throw new Error(`GraphQL Request Error (400): Invalid query syntax.\nQuery: ${query}. \nError: ${fetchError}`);
          }
        }

        // Fallback error with the complete error message
        throw new Error(`GraphQL Error: ${error.message}`);
      }
      
      // Fallback for non-Error objects
      throw new Error(`GraphQL Error: ${String(error)}`);
    }
  }
}

export default new CommercetoolsGraphQLClient();

