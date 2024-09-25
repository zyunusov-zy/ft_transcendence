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