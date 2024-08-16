const handleLogout = async (globApp) => {
    try {
        const response = await fetch('/api/logout/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
            }
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success) {
            console.log('Logged out successfully');
            clearAuthData();
			closeAllChatSockets();
			globApp.clearS();
            window.location.href = '#login';
        } else {
            console.error('Logout failed', data.error);
        }
    } catch (error) {
        console.error('Error during logout:', error);
    }
};

const clearAuthData = () => {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
};

const closeAllChatSockets = () => {
    for (const socketId in chatSockets) {
        if (chatSockets[socketId] && chatSockets[socketId].readyState === WebSocket.OPEN) {
            chatSockets[socketId].close(); // Close the WebSocket connection
        }
    }

    // Optionally, clear the chatSockets object
    chatSockets = {};
};