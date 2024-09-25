async function Auth42()
{
	try {
		console.log("EEEEEEEEEEEEEEEEEEEEEEEEEEEEE");
        const response = await fetch('/api/oauth/config/');
        const config = await response.json();
        
        const clientId = config.client_id;
        const redirectUri = encodeURIComponent(config.redirect_uri);
        const authUrl = `${config.auth_url}?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=public`;
        
        // Redirect the user to the 42 authorization page
        window.location.href = authUrl;
    } catch (error) {
        console.error('Error fetching OAuth configuration:', error);
    }
}

async function refreshAccessToken() {
    try {
        const response = await fetch('api/token/refresh/', {
            method: 'POST',
            credentials: 'include', // Ensure cookies (including refresh token) are sent
        });

        if (!response.ok) {
            throw new Error('Failed to refresh access token');
        }

        const data = await response.json();
        
        if (data.success) {
            console.log("Token refreshed successfully");
            return true; // Return true indicating successful refresh
        } else {
            console.error("Failed to refresh token", data.message);
            return false;
        }
    } catch (error) {
        console.error("Error refreshing token", error);
        return false;
    }
}

// Function to get the access token expiry time from cookies
function getJWTCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return null;
}

function getAccessTokenExpiryFromCookie() {
    const expiryTime = getJWTCookie('access_token_expiry');
    if (expiryTime) {
        return new Date(expiryTime).getTime(); // Convert to timestamp
    }
    return null;
}

// Function to check if the access token has expired
function isAccessTokenExpired() {
    const accessTokenExpiry = getAccessTokenExpiryFromCookie();
    const currentTime = Date.now();
    
    if (!accessTokenExpiry) {
        return true; // If no expiry time is set, assume the token has expired
    }

    return currentTime >= accessTokenExpiry;
}

// Function to handle refreshing the access token if it is expired before making API calls
async function ensureValidAccessToken() {
    if (isAccessTokenExpired()) {
        console.log('Access token expired. Attempting to refresh...');
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            throw new Error('Failed to refresh access token');
        }
    }
}

