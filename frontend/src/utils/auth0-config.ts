import auth0 from 'auth0-js';

// Auth0 configuration
const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || '',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
  redirectUri: `${window.location.origin}/callback`,
  audience: import.meta.env.VITE_AUTH0_AUDIENCE || '',
};

// Initialize Auth0 WebAuth
export const auth0Client = new auth0.WebAuth({
  domain: auth0Config.domain,
  clientID: auth0Config.clientId,
  redirectUri: auth0Config.redirectUri,
  responseType: 'code',
  audience: auth0Config.audience,
  scope: 'openid profile email offline_access'
});

// Helper function to handle the Auth0 login
export const handleAuth0Login = (connection: string = 'google-oauth2') => {
  console.log("Starting Auth0 login with connection:", connection);

  auth0Client.authorize({
    connection,
    prompt: 'login'
  });

  // This will redirect the browser, so no return value is needed
};

// Updated function to handle the authentication callback for authorization code flow
export const handleAuthCallback = () => {
  return new Promise<{ code: string, state?: string }>((resolve, reject) => {
    // Parse the URL parameters to get the authorization code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (error) {
      console.error('Auth0 callback error:', error, errorDescription);
      reject(new Error(`Auth0 error: ${error} - ${errorDescription}`));
      return;
    }

    if (!code) {
      console.error('No authorization code received');
      reject(new Error('No authorization code received from Auth0'));
      return;
    }

    resolve({
      code,
      state: state || undefined
    });
  });
};

// Function to handle Auth0 logout (unchanged)
export const handleAuth0Logout = async () => {
  try {
    auth0Client.logout({
      returnTo: window.location.origin
    });

    return true;
  } catch (error) {
    console.error('Auth0 logout error:', error);
    return false;
  }
};

export default auth0Config;