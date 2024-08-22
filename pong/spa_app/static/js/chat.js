function switchToChatBox() {
    document.querySelector('.chats-box').style.display = 'flex';
}

let chatSockets = {};

function openChatBox(friend) {
    let chatBox = document.getElementById(`chat-box-${friend}`);
    let background = document.getElementById('chatBoxBackground');

    if (!chatBox) {
        chatBox = createChatBox(friend);
    }

    // Open the chat box and show the background
    chatBox.classList.add('active');
    background.classList.add('active');

    // Fetch and display previous messages
    fetchMessages(friend);

    // Establish WebSocket connection if not already connected
    if (!chatSockets[friend]) {
        establishWebSocketConnection(friend);
    }

    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission !== 'granted') {
                console.warn('Notification permission not granted.');
            }
        });
    }
}

function createChatBox(friend) {
    const chatContainer = document.getElementById('chatsBox');

    const chatBox = document.createElement('div');
    chatBox.id = `chat-box-${friend}`; // Fixed ID attribute
    chatBox.className = 'chat-box';

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.className = 'close-button';
    closeButton.addEventListener('click', () => {
        closeChatBox(friend);
    });
    chatBox.appendChild(closeButton);

    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'messages';
    chatBox.appendChild(messagesContainer);

    const inputContainer = document.createElement('div');
    inputContainer.className = 'input-container';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type a message...';
    input.className = 'message-input';
    inputContainer.appendChild(input);

    const sendButton = document.createElement('button');
    sendButton.innerText = 'Send';
    sendButton.className = 'send-button';
    sendButton.addEventListener('click', () => sendMessage(friend));
    inputContainer.appendChild(sendButton);

    const blockButton = document.createElement('button');
    blockButton.innerText = 'Block';
    blockButton.className = 'block-button';
    blockButton.style.backgroundColor = 'red'; // Make the button red
    blockButton.addEventListener('click', () => {
        blockUser(friend, blockButton);
    });
    inputContainer.appendChild(blockButton);

    chatBox.appendChild(inputContainer);
    chatContainer.appendChild(chatBox);

    switchToChatBox(); // Make sure this function is defined elsewhere

    return chatBox;
}


async function fetchMessages(friend) {
    const response = await fetch(`/api/messages/${friend}/`);
    const messages = await response.json();
    const chatBox = document.getElementById(`chat-box-${friend}`);
    const messagesContainer = chatBox.querySelector('.messages');

    messagesContainer.innerHTML = '';


    console.log(messages);
    messages.forEach(message => {
        const messageElement = document.createElement('div');
        if (message.sender === friend) {
            messageElement.className = 'message friend-message';
        } else {
            messageElement.className = 'message my-message';
        }
        messageElement.innerHTML = `<strong>${message.sender}:</strong> ${message.content}`;
        messagesContainer.appendChild(messageElement);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Auto scroll to bottom
}

function sendMessage(friend) {
    const chatBox = document.getElementById(`chat-box-${friend}`);
    const input = chatBox.querySelector('.message-input');
    const messageContent = input.value;

    if (messageContent.trim() === '') return;

    const message = {
        recipient_username: friend,
        content: messageContent
    };

    // Send the message via WebSocket
    if (chatSockets[friend]) {
        console.log("HEEEEEEEWWWWWWWWWW");
        chatSockets[friend].send(JSON.stringify({
            'message': messageContent
        }));
    } else {
        // Fallback to HTTP POST if WebSocket is not available
        fetch('/api/message/send/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') // Ensure you pass the CSRF token correctly
            },
            body: JSON.stringify(message)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Message sent:', data);
            input.value = '';
        })
        .catch(error => console.error('Error sending message:', error));
    }
    input.value = '';
}


function establishWebSocketConnection(friend) {
    const socket = new WebSocket(`ws://${window.location.host}/ws/chat/${friend}/`);

    socket.onopen = function(event) {
        console.log('WebSocket connection opened:', event);
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        const message = data['message'];
        const sender = data['sender'];
        console.log('Message received:', data); // Add this line for debugging
        displayIncomingMessage(friend, message, sender);

        if (document.hidden || !chatBoxVisible(friend)) {
            showNotification(`New message from ${sender}`, message);
        }
    };


    socket.onclose = function(event) {
        console.log('WebSocket connection closed:', event);
        delete chatSockets[friend];
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };

    chatSockets[friend] = socket;
}

function displayIncomingMessage(friend, message, sender) {
    const chatBox = document.getElementById(`chat-box-${friend}`);
    if (!chatBox) {
        console.error(`Chat box for ${friend} not found.`); // Add this line for debugging
        return;
    }
    const messagesContainer = chatBox.querySelector('.messages');

    const messageElement = document.createElement('div');
    if (sender === friend) {
        messageElement.className = 'message friend-message';
    } else {
        messageElement.className = 'message my-message';
    }
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    messagesContainer.appendChild(messageElement);

    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Auto scroll to bottom
}

function showNotification(title, message) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: 'path/to/icon.png' // Optional: path to an icon image
        });
    }
}

function chatBoxVisible(friend) {
    const chatBox = document.getElementById(`chat-box-${friend}`);
    return chatBox && chatBox.style.display !== 'none';
}

function closeChatBox(friend) {
    const chatBox = document.getElementById(`chat-box-${friend}`);
    const background = document.getElementById('chatBoxBackground');

    if (chatBox) {
        chatBox.classList.remove('active');
        chatBox.remove(); // Remove the chat box from the DOM
    }

    // Hide the shadowed background
    background.classList.remove('active');
    document.querySelector('.chats-box').style.display = 'none';

}

const getCookies = (name) => {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
};